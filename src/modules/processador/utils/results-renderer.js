// src/modules/processador/utils/results-renderer.js

import { formatCurrency } from '../../../core/formatters.js';

/**
 * Renderiza o painel de estatísticas e a tabela de pré-visualização.
 * @param {Array<Object>} data - Dados processados dos clientes.
 */
export function renderResults(data) {
    // 1. Atualiza Estatísticas
    const total = data.length;
    const econ = data.reduce((acc, curr) => acc + (curr.economiaMes || 0), 0);
    const co2 = data.reduce((acc, curr) => acc + (curr.co2Evitado || 0), 0);
    const arvores = data.reduce((acc, curr) => acc + (curr.arvoresEquivalentes || 0), 0);

    const setContent = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setContent('stat-total', total);
    setContent('stat-economia', formatCurrency(econ));
    setContent('stat-co2', co2.toFixed(2));
    setContent('stat-arvores', arvores.toFixed(0));

    // 2. Renderiza Tabela (Top 20)
    const tbody = document.getElementById('table-body-processador');
    if (!tbody) return;

    tbody.innerHTML = data.slice(0, 20).map(c => `
        <tr class="hover:bg-blue-50/50 transition-colors group border-b border-gray-50 last:border-none">
            <td class="p-3 font-medium text-gray-800 group-hover:text-primary transition-colors">${c.nome}</td>
            <td class="p-3 text-gray-500 font-mono text-xs">${c.instalacao}</td>
            <td class="p-3 text-right text-success font-semibold tracking-tight">${formatCurrency(c.economiaMes)}</td>
            <td class="p-3 text-right text-gray-900 font-bold tracking-tight">${formatCurrency(c.totalPagar)}</td>
        </tr>
    `).join('');
}


/**
 * Renderiza o painel de warnings de validação.
 * @param {Array<Object>} warnings - Lista de warnings {type, message, details}.
 */
export function renderWarnings(warnings) {
    const container = document.getElementById('validation-warnings-container');
    if (!container) return;

    container.innerHTML = '';

    if (!warnings || warnings.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    warnings.forEach(w => {
        const isError = w.severity === 'error';
        const bgClass = isError ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
        const textClass = isError ? 'text-red-800' : 'text-yellow-800';
        const iconClass = isError ? 'fa-exclamation-circle text-red-600' : 'fa-exclamation-triangle text-yellow-600';

        let detailsHtml = '';
        if (w.details) {
            const content = typeof w.details === 'object' ? JSON.stringify(w.details, null, 2) : w.details;
            detailsHtml = `<pre class="text-xs mt-1 opacity-90 font-mono bg-white/50 p-1 rounded overflow-x-auto">${content}</pre>`;
        }

        const div = document.createElement('div');
        div.className = `p-4 rounded-lg border flex items-start gap-3 ${bgClass} animate-fade-in`;

        div.innerHTML = `
            <i class="fas ${iconClass} mt-1 text-lg flex-shrink-0"></i>
            <div class="flex-1 ${textClass}">
                <p class="font-bold text-sm">${w.title || (isError ? 'Erro de Processamento' : 'Alerta de Dados')}</p>
                <p class="text-sm mt-0.5">${w.message}</p>
                ${detailsHtml}
            </div>
        `;
        container.appendChild(div);
    });
}