/**
 * Componente de Painel de Alertas de Validação
 */

export class ValidationWarnings {
    /**
     * Renderiza painel de warnings
     * @param {Array} warnings - Lista de warnings {type, severity, message, details}
     * @param {string} containerId - ID do container onde renderizar
     */
    static render(warnings, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Se não há warnings, ocultar painel
        if (!warnings || warnings.length === 0) {
            container.innerHTML = '';
            container.classList.add('hidden');
            return;
        }

        // Agrupar por severidade
        const grouped = {
            error: warnings.filter(w => w.severity === 'error'),
            warning: warnings.filter(w => w.severity === 'warning'),
            info: warnings.filter(w => w.severity === 'info')
        };

        const totalErrors = grouped.error.length;
        const totalWarnings = grouped.warning.length;
        const totalInfo = grouped.info.length;

        // Ícones e cores por severidade
        const severityConfig = {
            error: {
                icon: 'fa-exclamation-circle',
                bgColor: 'bg-red-50',
                borderColor: 'border-red-200',
                textColor: 'text-red-800',
                iconColor: 'text-red-500'
            },
            warning: {
                icon: 'fa-exclamation-triangle',
                bgColor: 'bg-orange-50',
                borderColor: 'border-orange-200',
                textColor: 'text-orange-800',
                iconColor: 'text-orange-500'
            },
            info: {
                icon: 'fa-info-circle',
                bgColor: 'bg-blue-50',
                borderColor: 'border-blue-200',
                textColor: 'text-blue-800',
                iconColor: 'text-blue-500'
            }
        };

        let html = `
            <div class="panel-card border-l-4 ${totalErrors > 0 ? 'border-l-red-500' : totalWarnings > 0 ? 'border-l-orange-500' : 'border-l-blue-500'}">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h3 class="section-title mb-1">
                            <i class="fas fa-clipboard-check mr-2"></i>
                            Alertas de Validação
                        </h3>
                        <p class="text-sm text-text-secondary">
                            ${totalErrors > 0 ? `${totalErrors} erro(s)` : ''}
                            ${totalErrors > 0 && totalWarnings > 0 ? ', ' : ''}
                            ${totalWarnings > 0 ? `${totalWarnings} aviso(s)` : ''}
                            ${(totalErrors > 0 || totalWarnings > 0) && totalInfo > 0 ? ', ' : ''}
                            ${totalInfo > 0 ? `${totalInfo} info(s)` : ''}
                        </p>
                    </div>
                    <button 
                        onclick="document.getElementById('${containerId}').classList.add('hidden')" 
                        class="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Fechar"
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="space-y-2 max-h-96 overflow-y-auto">
        `;

        // Renderizar warnings por severidade
        ['error', 'warning', 'info'].forEach(severity => {
            if (grouped[severity].length > 0) {
                const config = severityConfig[severity];
                grouped[severity].forEach(w => {
                    html += `
                        <div class="flex items-start gap-3 p-3 rounded-lg ${config.bgColor} border ${config.borderColor}">
                            <i class="fas ${config.icon} ${config.iconColor} mt-0.5"></i>
                            <div class="flex-1">
                                <p class="${config.textColor} text-sm font-medium">${w.message}</p>
                                ${w.details && Object.keys(w.details).length > 0 ? `
                                    <details class="mt-1">
                                        <summary class="text-xs ${config.textColor} opacity-70 cursor-pointer hover:opacity-100">
                                            Detalhes
                                        </summary>
                                        <pre class="text-xs ${config.textColor} opacity-60 mt-1 overflow-x-auto">${JSON.stringify(w.details, null, 2)}</pre>
                                    </details>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });
            }
        });

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
        container.classList.remove('hidden');
    }

    /**
     * Limpa o painel de warnings
     * @param {string} containerId - ID do container
     */
    static clear(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
            container.classList.add('hidden');
        }
    }
}

export default ValidationWarnings;
