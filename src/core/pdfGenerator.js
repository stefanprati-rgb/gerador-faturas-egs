// src/core/pdfGenerator.js
/**
 * Módulo de geração de PDFs
 */

import { formatCurrency, formatNumber, formatDate, sanitizeFilename } from './formatters.js';
// Importamos o template aqui também para garantir autonomia
import { getPDFTemplate } from '../modules/gerador/pdfTemplate.js';

class PDFGenerator {
    constructor() {
        console.log('PDFGenerator instanciado');
    }

    /**
     * Gera PDF de uma fatura
     */
    async generatePDF(client, mesReferencia) {
        // 1. Tenta encontrar o template
        let element = document.getElementById('pdf-page');

        // 2. AUTO-REPARO: Se não encontrar, injeta agora mesmo
        if (!element) {
            console.warn('Template PDF ausente. Injetando sob demanda...');
            const wrapper = document.createElement('div');
            wrapper.innerHTML = getPDFTemplate();
            document.body.appendChild(wrapper);

            // Tenta buscar novamente
            element = document.getElementById('pdf-page');
        }

        // 3. Verificação final
        if (!element) {
            throw new Error('Falha crítica: Template PDF não pôde ser carregado.');
        }

        // Preencher template
        await this.fillTemplate(client, mesReferencia);

        // Gerar nome do arquivo (Padrão: Instalação_Nome_Data)
        // Solicitado: 1052027_IGREJA DO EVANGELHO QUADRANGULAR_20251204
        const nomeRaw = client.nome || 'Cliente';
        const instalacaoRaw = String(client.instalacao || '000000');

        // Sanitização customizada: Mantém espaços, remove caracteres inválidos e acentos
        const nomeClean = nomeRaw
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[<>:"/\\|?*]/g, '') // Remove chars inválidos de arquivo
            .replace(/\s+/g, ' ') // Normaliza espaços
            .trim();

        const instalacaoClean = instalacaoRaw.replace(/[<>:"/\\|?*]/g, '');

        // Data atual YYYYMMDD
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}${mm}${dd}`;

        const filename = `${instalacaoClean}_${nomeClean}_${dateStr}.pdf`;

        // Configurações do html2pdf
        const opt = {
            margin: [2, 2, 2, 2],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                scrollY: 0,
                scrollX: 0,
                windowHeight: element.scrollHeight,
                y: 0
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                compress: true
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Gerar PDF
        return new Promise((resolve, reject) => {
            setTimeout(async () => {
                try {
                    // Verifica se a lib html2pdf está carregada
                    if (typeof html2pdf === 'undefined') {
                        throw new Error('Biblioteca html2pdf não carregada.');
                    }

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
     */
    async fillTemplate(client, mesReferencia) {
        const refDate = new Date(mesReferencia + '-02T00:00:00');
        const emissao = new Date(client.emissao_iso + 'T00:00:00');
        const venc = new Date(client.vencimento_iso + 'T00:00:00');

        const mesNome = refDate.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
        const mesCap = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);

        // Helpers para segurança (evita erro se elemento não existir no template novo)
        const setText = (id, text) => {
            const el = document.getElementById(id);
            // [CORREÇÃO APLICADA] Defensiva: Garante que o texto é uma string (ou fallback)
            if (el) el.textContent = String(text ?? '');
        };
        const setHTML = (id, html) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        };

        // Título
        setText('pdf-titulo-p1', `Sua contribuição de ${mesCap} chegou`);

        // Dados do cliente
        setText('pdf-nome-cliente-p1', client.nome);
        setText('pdf-cpf-p1', `CPF/CNPJ: ${client.documento}`);
        setText('pdf-endereco-p1', client.endereco);
        setText('pdf-instalacao-p1', client.instalacao);
        setText('pdf-numconta-p1', client.num_conta || '');
        setText('pdf-emissao-p1', formatDate(emissao));

        // Valores principais
        setText('pdf-total-pagar', formatCurrency(client.totalPagar));
        setText('pdf-vencimento-p1', formatDate(venc, { day: '2-digit', month: 'long', year: 'numeric' }));
        setText('pdf-economia-mes', formatCurrency(client.economiaMes));
        setText('pdf-economia-acumulada', formatCurrency(client.economiaTotal));
        setText('pdf-arvores', formatNumber(client.arvoresEquivalentes));
        setText('pdf-co2', `${formatNumber(client.co2Evitado)} kg`);

        // Rodapé
        const refShort = refDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '');
        setText('pdf-ref-foot', refShort);
        setText('pdf-valor-foot', formatCurrency(client.totalPagar));
        setText('pdf-venc-foot', formatDate(venc));

        // Detalhamento contribuição
        setText('pdf-det-credito-qtd', formatNumber(client.det_credito_qtd));
        setText('pdf-det-credito-tar', client.det_credito_tar > 0 ? formatCurrency(client.det_credito_tar) : '—');
        setText('pdf-det-credito-total', formatCurrency(client.det_credito_total));
        setText('pdf-det-total-contrib', formatCurrency(client.totalPagar));

        // Distribuidora
        setText('pdf-dist-consumo-qtd', `${formatNumber(client.dist_consumo_qtd)} kWh`);
        setText('pdf-dist-consumo-tar', formatCurrency(client.dist_consumo_tar));
        setText('pdf-dist-consumo-total', formatCurrency(client.dist_consumo_total));
        setText('pdf-dist-comp-qtd', `${formatNumber(client.dist_comp_qtd)} kWh`);
        setText('pdf-dist-comp-tar', formatCurrency(client.dist_comp_tar));
        setText('pdf-dist-comp-total', `${client.dist_comp_total < 0 ? '-' : ''} ${formatCurrency(Math.abs(client.dist_comp_total))}`);
        setText('pdf-dist-outros', formatCurrency(client.dist_outros));
        setText('pdf-dist-total', formatCurrency(client.dist_total));

        // Comparativos
        setText('pdf-econ-total-sem', formatCurrency(client.econ_total_sem));
        setText('pdf-econ-tarifa-dist', formatNumber(client.dist_consumo_tar, 6));
        setText('pdf-econ-qtd-dist', `${formatNumber(client.dist_consumo_qtd)} kWh`);
        setText('pdf-econ-outros', formatCurrency(client.dist_outros));
        setText('pdf-econ-total-com', formatCurrency(client.econ_total_com));
        setText('pdf-econ-economia-final', formatCurrency(client.economiaMes));

        // Explicação do quadro "Com EGS"
        const tEv = Number(client.det_credito_tar || 0);
        const qtdEv = formatNumber(client.det_credito_qtd);
        const totDt = formatCurrency(client.dist_total);
        const totContrib = formatCurrency(client.totalPagar);

        if (tEv <= 0) {
            setHTML('pdf-econ-exp-ev', `Boleto EGS ${totContrib} + Total Distribuidora ${totDt}`);
        } else {
            setHTML('pdf-econ-exp-ev', `(Tarifa R$ ${formatNumber(tEv, 6)} x Qtd. ${qtdEv}) + Total Distribuidora ${totDt}`);
        }

        // Resumo de economia
        const semGD = Number(client.econ_total_sem || 0);
        const comGD = Number(client.econ_total_com || 0);
        const econ = Number(client.economiaMes || 0);

        setText('pdf-econ-mes-valor', formatCurrency(econ));
        setText('pdf-econ-sem-gd', formatCurrency(semGD));
        setText('pdf-econ-com-gd', formatCurrency(comGD));
    }

    /**
     * Gera múltiplos PDFs e compacta em ZIP
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