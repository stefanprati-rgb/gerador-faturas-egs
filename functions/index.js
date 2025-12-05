const { onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const puppeteer = require("puppeteer");

/**
 * Função para gerar PDF via Puppeteer (Headless Chrome).
 * Configurada com 2GB de RAM e Timeout maior para evitar crashes.
 */
exports.gerarFaturaPDF = onCall({
    memory: "2GiB",        // Aumentado: Chrome precisa de muita RAM
    timeoutSeconds: 300,   // Aumentado: 5 minutos para evitar timeout
    cors: true,            // Habilita CORS explicitamente para qualquer origem
    maxInstances: 10,      // Limita instâncias para controlar custos
}, async (request) => {

    // 1. Validação
    const { html } = request.data;
    if (!html) {
        logger.error("HTML content is missing");
        throw new Error("HTML content is required");
    }

    let browser = null;
    try {
        logger.info("Iniciando Puppeteer...");

        // 2. Configuração otimizada para Cloud Run (ambiente serverless)
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Usa /tmp em vez de /dev/shm (crítico para Docker)
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
            ]
        });

        const page = await browser.newPage();

        // Define o conteúdo HTML
        await page.setContent(html, {
            waitUntil: ['load', 'networkidle0'], // Espera carregar tudo (imagens, fontes)
            timeout: 60000 // 60 segundos de timeout para renderização
        });

        // Gera o PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });

        logger.info("PDF gerado com sucesso!");

        // 3. Retorno (O Firebase onCall serializa isso automaticamente)
        return {
            pdf: pdfBuffer.toString('base64')
        };

    } catch (error) {
        logger.error("Erro fatal ao gerar PDF:", error);
        // Lança um erro estruturado que o frontend consegue ler
        throw new Error(`Falha na geração do PDF: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});