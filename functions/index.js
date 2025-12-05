const { onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const puppeteer = require("puppeteer");

exports.gerarFaturaPDF = onCall({ memory: "1GiB", timeoutSeconds: 120 }, async (request) => {
    const { html } = request.data;

    if (!html) {
        throw new Error("HTML content is required");
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' }); // Wait for CDN

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });

        return { pdf: pdfBuffer.toString('base64') };
    } catch (error) {
        logger.error("Error generating PDF", error);
        throw new Error("Failed to generate PDF: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
});
