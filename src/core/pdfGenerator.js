// src/core/pdfGenerator.js
/**
 * Módulo de geração de PDFs (Server-Side via Firebase Functions)
 */

import { formatCurrency, formatNumber, formatDate } from './formatters.js';
import { getPDFTemplate } from '../modules/gerador/pdfTemplate.js';
import { functions } from '../firebase.js';
import { httpsCallable } from 'firebase/functions';
import JSZip from 'jszip';

class PDFGenerator {
    constructor() {
        console.log('PDFGenerator initialized (Server-Side Mode)');
    }

    /**
     * Gera PDF de uma fatura chamando a Cloud Function
     */
    async generatePDF(client, mesReferencia) {
        try {
            // 1. Preparar dados para o template
            const data = this.prepareData(client, mesReferencia);

            // 2. Gerar string HTML completa
            const html = getPDFTemplate(data);

            // 3. Chamar Cloud Function
            console.log('Chamando Cloud Function gerarFaturaPDF...');
            const gerarPdf = httpsCallable(functions, 'gerarFaturaPDF');
            const result = await gerarPdf({ html });

            // 4. Converter base64 para Blob
            const base64Info = result.data.pdf;
            const blob = this.base64ToBlob(base64Info, 'application/pdf');

            // 5. Gerar nome do arquivo
            const filename = this.generateFilename(client, mesReferencia);

            return { blob, filename };

        } catch (error) {
            console.error('Erro ao gerar PDF via função:', error);
            throw new Error('Falha na geração do PDF: ' + error.message);
        }
    }

    /**
     * Prepara os dados formatados para o template
     */
    prepareData(client, mesReferencia) {
        const refDate = new Date(mesReferencia + '-02T00:00:00');
        const emissao = new Date(client.emissao_iso + 'T00:00:00');
        const venc = new Date(client.vencimento_iso + 'T00:00:00');

        const mesNome = refDate.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
        const mesCap = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);
        const refShort = refDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '');

        // Cálculos auxiliares para texto explicativo
        const tEv = Number(client.det_credito_tar || 0);
        const qtdEv = formatNumber(client.det_credito_qtd);
        const totDt = formatCurrency(client.dist_total);
        const totContrib = formatCurrency(client.totalPagar);

        let econExpEv = '';
        if (tEv <= 0) {
            econExpEv = `Boleto EGS ${totContrib} + Total Distribuidora ${totDt}`;
        } else {
            econExpEv = `(Tarifa R$ ${formatNumber(tEv, 6)} x Qtd. ${qtdEv}) + Total Distribuidora ${totDt}`;
        }

        return {
            titulo_p1: `Sua contribuição de ${mesCap} chegou`,
            nome_cliente_p1: client.nome || '',
            cpf_p1: `CPF/CNPJ: ${client.documento || ''}`,
            endereco_p1: client.endereco || '',
            instalacao_p1: client.instalacao || '',
            numconta_p1: client.num_conta || '',
            emissao_p1: formatDate(emissao),
            total_pagar: formatCurrency(client.totalPagar),
            vencimento_p1: formatDate(venc, { day: '2-digit', month: 'long', year: 'numeric' }),
            economia_mes: formatCurrency(client.economiaMes),
            economia_acumulada: formatCurrency(client.economiaTotal),
            arvores: formatNumber(client.arvoresEquivalentes),
            co2: `${formatNumber(client.co2Evitado)} kg`,
            ref_foot: refShort,
            valor_foot: formatCurrency(client.totalPagar),
            venc_foot: formatDate(venc),

            // Detalhes Contribuição
            det_credito_qtd: formatNumber(client.det_credito_qtd),
            det_credito_tar: client.det_credito_tar > 0 ? formatCurrency(client.det_credito_tar) : '—',
            det_credito_total: formatCurrency(client.det_credito_total),
            det_total_contrib: formatCurrency(client.totalPagar),

            // Distribuidora
            dist_consumo_qtd: `${formatNumber(client.dist_consumo_qtd)} kWh`,
            dist_consumo_tar: formatCurrency(client.dist_consumo_tar),
            dist_consumo_total: formatCurrency(client.dist_consumo_total),
            dist_comp_qtd: `${formatNumber(client.dist_comp_qtd)} kWh`,
            dist_comp_tar: formatCurrency(client.dist_comp_tar),
            dist_comp_total: `${client.dist_comp_total < 0 ? '-' : ''} ${formatCurrency(Math.abs(client.dist_comp_total))}`,
            dist_outros: formatCurrency(client.dist_outros),
            dist_total: formatCurrency(client.dist_total),

            // Comparativos
            econ_total_sem: formatCurrency(client.econ_total_sem),
            econ_tarifa_dist: formatNumber(client.dist_consumo_tar, 6),
            econ_qtd_dist: `${formatNumber(client.dist_consumo_qtd)} kWh`,
            econ_outros: formatCurrency(client.dist_outros),
            econ_total_com: formatCurrency(client.econ_total_com),
            econ_economia_final: formatCurrency(client.economiaMes),
            econ_exp_ev: econExpEv,

            // Resumo Economia
            econ_mes_valor: formatCurrency(client.economiaMes),
            econ_sem_gd: formatCurrency(client.econ_total_sem),
            econ_com_gd: formatCurrency(client.econ_total_com)
        };
    }

    /**
     * Helper para converter Base64 em Blob
     */
    base64ToBlob(base64, mimeType = 'application/pdf') {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    /**
     * Gera nome do arquivo padronizado
     */
    generateFilename(client, mesReferencia) {
        const nomeRaw = client.nome || 'Cliente';
        const instalacaoRaw = String(client.instalacao || '000000');

        const nomeClean = nomeRaw
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const instalacaoClean = instalacaoRaw.replace(/[<>:"/\\|?*-]/g, '');

        const refDate = new Date(mesReferencia + '-01T00:00:00');
        const lastDay = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
        const yyyy = lastDay.getFullYear();
        const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
        const dd = String(lastDay.getDate()).padStart(2, '0');

        return `${instalacaoClean}_${nomeClean}_${yyyy}${mm}${dd}.pdf`;
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