import stateManager from '../core/StateManager.js';
import { formatFileSize } from '../core/formatters.js';

export class FileStatus {
    constructor(containerId) {
        this.containerId = containerId;
        // Se inscreve para ouvir mudanças
        stateManager.subscribe(this.render.bind(this));
    }

    /**
     * Tenta realizar a troca de arquivo (Reset com confirmação)
     * @param {Function} onConfirm Callback para executar após o reset
     */
    static requestFileChange(onConfirm) {
        if (stateManager.hasFile()) {
            if (confirm('ATENÇÃO: Carregar um novo arquivo apagará todo o progresso atual, filtros e dados processados.\n\nDeseja continuar?')) {
                stateManager.reset();
                if (onConfirm) onConfirm();
                return true;
            }
            return false;
        }
        return true;
    }

    render(state) {
        const container = document.getElementById(this.containerId);
        if (!container) return; // Container pode não existir dependendo da rota

        if (!state.file) {
            container.innerHTML = ''; // Esconde se não tiver arquivo
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 mb-6 animate-fade-in">
                <div class="flex items-center gap-3">
                    <div class="bg-blue-100 p-2 rounded-full text-primary">
                        <i class="fas fa-file-excel text-xl"></i>
                    </div>
                    <div>
                        <p class="font-semibold text-sm text-gray-800">Arquivo Ativo: ${state.meta.fileName}</p>
                        <p class="text-xs text-gray-500">${formatFileSize(state.meta.fileSize)} • Carregado às ${state.meta.uploadTime.toLocaleTimeString()}</p>
                    </div>
                </div>
                
                <div class="flex items-center gap-2">
                    <span class="text-xs font-medium px-2 py-1 rounded ${state.processedData.length > 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                        ${state.processedData.length > 0 ? `${state.processedData.length} Registros` : 'Aguardando Processamento'}
                    </span>
                    <button id="global-reset-btn" class="text-xs bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-medium px-3 py-1.5 rounded transition-colors flex items-center">
                        <i class="fas fa-trash-alt mr-1.5"></i> Resetar Sistema
                    </button>
                </div>
            </div>
        `;

        // Bind do evento de reset
        const resetBtn = container.querySelector('#global-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Tem certeza que deseja resetar todo o sistema? Todos os dados não salvos serão perdidos.')) {
                    stateManager.reset();
                }
            });
        }
    }
}