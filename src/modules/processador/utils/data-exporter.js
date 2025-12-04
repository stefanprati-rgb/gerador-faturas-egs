// src/modules/processador/utils/data-exporter.js

import stateManager from '../../../core/StateManager.js';
import notification from '../../../components/Notification.js';

/**
 * Converte um array de objetos para o formato CSV.
 * @param {Array<Object>} data - Dados a serem convertidos.
 * @returns {string} String CSV.
 */
function convertToCSV(data) {
    if (data.length === 0) return '';

    // Filtra cabeçalhos que não devem ser exportados (propriedades privadas)
    const headers = Object.keys(data[0]).filter(key => !key.startsWith('__') && !key.startsWith('_'));
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header];
            // Encerra valores com aspas duplas e escapa aspas internas
            const escaped = String(value).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

/**
 * Realiza o download do Blob.
 * @param {Blob} blob - O objeto Blob a ser baixado.
 * @param {string} filename - Nome do arquivo.
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
}

/**
 * Lida com a exportação de dados para JSON ou CSV.
 * @param {'json'|'csv'} format - Formato de exportação.
 */
export function handleExport(format) {
    const state = stateManager.getState();
    const data = state.processedData;

    if (!data || data.length === 0) {
        notification.warning('Nenhum dado para exportar');
        return;
    }

    const mesRef = state.params.mesReferencia || 'dados';

    try {
        if (format === 'json') {
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            downloadBlob(blob, `processamento_${mesRef}.json`);
            notification.success('JSON exportado com sucesso!');
        } else if (format === 'csv') {
            const csv = convertToCSV(data);
            // Usamos 'text/csv;charset=utf-8-sig' para garantir compatibilidade com acentos no Excel
            const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8-sig' });
            downloadBlob(blob, `processamento_${mesRef}.csv`);
            notification.success('CSV exportado com sucesso!');
        }
    } catch (e) {
        notification.error('Erro ao preparar exportação.');
        console.error('Export Error:', e);
    }
}