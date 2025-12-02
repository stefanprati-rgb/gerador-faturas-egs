/**
 * Módulo de geração de PDFs
 */

import { formatCurrency, formatNumber, formatDate, formatMonthName, sanitizeFilename } from './formatters.js';

class PDFGenerator {
    constructor() {
        console.log('PDFGenerator instanciado');
        this.currentChart = null;
    }

    /**
     * Gera PDF de uma fatura
     * @param {object} client - Dados do cliente
     * @param {string} mesReferencia - Mês no formato YYYY-MM
     * @returns {Promise<{blob: Blob, filename: string}>}
     */
    async generatePDF(client, mesReferencia) {
        const element = document.getElementById('pdf-page');
        if (!element) {
            throw new Error('Template PDF não encontrado no DOM');
        }

        // Preencher template
        await this.fillTemplate(client, mesReferencia);

        // Gerar nome do arquivo
        const nomeClean = sanitizeFilename(client.nome.split(' ')[0]);
        const filename = `Fatura_${client.instalacao}_${nomeClean}.pdf`;

        // Configurações do html2pdf
        const opt = {
            margin: 0,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Gerar PDF
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    const worker = html2pdf().from(element).set(opt);
                    const pdf = await worker.toPdf().get('pdf');

                    // Remove páginas extras se houver
                    if (pdf.getNumberOfPages() > 1) {
                        for (let i = pdf.getNumberOfPages(); i > 1; i--) {
                            pdf.deletePage(i);
                        }
                    }

                    const blob = pdf.output('blob');
                    resolve({ blob, filename });
                } catch (error) {
                    reject(error);
                }
            }, 100);
        });
    }
    /**
     * Preenche o template HTML com dados do cliente
     * @param {object} client - Dados do cliente
     * @param {string} mesReferencia - Mês no formato YYYY-MM
     */
    async fillTemplate(client, mesReferencia) {
        const refDate = new Date(mesReferencia + '-02T00:00:00');
        const emissao = new Date(client.emissao_iso + 'T00:00:00');
        const venc = new Date(client.vencimento_iso + 'T00:00:00');

        const mesNome = refDate.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
        const mesCap = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);

        // Título
        const tituloEl = document.getElementById('pdf-titulo-p1');
        if (tituloEl) tituloEl.textContent = `Sua contribuição de ${mesCap} chegou`;

        // Dados do cliente
        document.getElementById('pdf-nome-cliente-p1').textContent = client.nome;
        document.getElementById('pdf-cpf-p1').textContent = `CPF/CNPJ: ${client.documento}`;
        document.getElementById('pdf-endereco-p1').textContent = client.endereco;
        document.getElementById('pdf-instalacao-p1').textContent = client.instalacao;
        document.getElementById('pdf-numconta-p1').textContent = client.num_conta || '';
        document.getElementById('pdf-emissao-p1').textContent = formatDate(emissao);

        // Valores principais
        document.getElementById('pdf-total-pagar').textContent = formatCurrency(client.totalPagar);
        document.getElementById('pdf-vencimento-p1').textContent = formatDate(venc, { day: '2-digit', month: 'long', year: 'numeric' });
        document.getElementById('pdf-economia-mes').textContent = formatCurrency(client.economiaMes);
        document.getElementById('pdf-economia-acumulada').textContent = formatCurrency(client.economiaTotal);
        document.getElementById('pdf-arvores').textContent = formatNumber(client.arvoresEquivalentes);
        document.getElementById('pdf-co2').textContent = `${formatNumber(client.co2Evitado)} kg`;

        // Rodapé
        document.getElementById('pdf-ref-foot').textContent = refDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '');
        document.getElementById('pdf-valor-foot').textContent = formatCurrency(client.totalPagar);
        document.getElementById('pdf-venc-foot').textContent = formatDate(venc);

        // Detalhamento contribuição
        document.getElementById('pdf-det-credito-qtd').textContent = formatNumber(client.det_credito_qtd);
        document.getElementById('pdf-det-credito-tar').textContent = client.det_credito_tar > 0 ? formatCurrency(client.det_credito_tar) : '—';
        document.getElementById('pdf-det-credito-total').textContent = formatCurrency(client.det_credito_total);
        document.getElementById('pdf-det-total-contrib').textContent = formatCurrency(client.totalPagar);

        // Distribuidora
        document.getElementById('pdf-dist-consumo-qtd').textContent = `${formatNumber(client.dist_consumo_qtd)} kWh`;
        document.getElementById('pdf-dist-consumo-tar').textContent = formatCurrency(client.dist_consumo_tar);
        document.getElementById('pdf-dist-consumo-total').textContent = formatCurrency(client.dist_consumo_total);
        document.getElementById('pdf-dist-comp-qtd').textContent = `${formatNumber(client.dist_comp_qtd)} kWh`;
        document.getElementById('pdf-dist-comp-tar').textContent = formatCurrency(client.dist_comp_tar);
        document.getElementById('pdf-dist-comp-total').textContent = `${client.dist_comp_total < 0 ? '-' : ''} ${formatCurrency(Math.abs(client.dist_comp_total))}`;
        document.getElementById('pdf-dist-outros').textContent = formatCurrency(client.dist_outros);
        document.getElementById('pdf-dist-total').textContent = formatCurrency(client.dist_total);

        // Comparativos
        document.getElementById('pdf-econ-total-sem').textContent = formatCurrency(client.econ_total_sem);
        document.getElementById('pdf-econ-tarifa-dist').textContent = formatNumber(client.dist_consumo_tar, 6);
        document.getElementById('pdf-econ-qtd-dist').textContent = `${formatNumber(client.dist_consumo_qtd)} kWh`;
        document.getElementById('pdf-econ-outros').textContent = formatCurrency(client.dist_outros);
        document.getElementById('pdf-econ-total-com').textContent = formatCurrency(client.econ_total_com);
        document.getElementById('pdf-econ-economia-final').textContent = formatCurrency(client.economiaMes);

        // Explicação do quadro "Com EGS"
        const expEl = document.getElementById('pdf-econ-exp-ev');
        const tEv = Number(client.det_credito_tar || 0);
        const qtdEv = formatNumber(client.det_credito_qtd);
        const totDt = formatCurrency(client.dist_total);
        const totContrib = formatCurrency(client.totalPagar);

        if (tEv <= 0) {
            expEl.innerHTML = `Boleto EGS ${totContrib} + Total Distribuidora ${totDt}`;
        } else {
            expEl.innerHTML = `(Tarifa R$ ${formatNumber(tEv, 6)} x Qtd. ${qtdEv}) + Total Distribuidora ${totDt}`;
        }

        // Resumo de economia
        const semGD = Number(client.econ_total_sem || 0);
        const comGD = Number(client.econ_total_com || 0);
        const econ = Number(client.economiaMes ?? (semGD - comGD));

        document.getElementById('pdf-econ-mes-valor').textContent = formatCurrency(econ);
        document.getElementById('pdf-econ-sem-gd').textContent = formatCurrency(semGD);
        document.getElementById('pdf-econ-com-gd').textContent = formatCurrency(comGD);
    }

    /**
     * Gera múltiplos PDFs e compacta em ZIP
     * @param {Array} clients - Lista de clientes
     * @param {string} mesReferencia - Mês no formato YYYY-MM
     * @param {Function} progressCallback - Callback de progresso (current, total)
     * @returns {Promise<Blob>} Blob do arquivo ZIP
     */
    async generateZIP(clients, mesReferencia, progressCallback) {
        const zip = new JSZip();

        for (let i = 0; i < clients.length; i++) {
            const client = clients[i];

            try {
                const { blob, filename } = await this.generatePDF(client, mesReferencia);
                zip.file(filename, blob);

                if (progressCallback) {
                    progressCallback(i + 1, clients.length);
                }
            } catch (error) {
                console.error(`Erro ao gerar PDF para ${client.nome}:`, error);
            }
        }

        return await zip.generateAsync({ type: 'blob' });
    }
}

export const pdfGenerator = new PDFGenerator();
