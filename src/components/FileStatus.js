import stateManager from '../core/StateManager.js';
import { formatFileSize } from '../core/formatters.js';

export class FileStatus {
    constructor(containerId) {
        this.containerId = containerId;
        stateManager.subscribe(this.render.bind(this));
    }

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
        if (!container) return;

        // SEMPRE remove a classe hidden para garantir visibilidade
        container.classList.remove('hidden');

        // Renderiza estado COM arquivo
        if (state.file) {
            container.innerHTML = `
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 mb-6 shadow-sm animate-fade-in transition-all">
                    <div class="flex items-center gap-4">
                        <div class="bg-blue-100 w-10 h-10 flex items-center justify-center rounded-full text-primary shadow-sm">
                            <i class="fas fa-file-excel text-lg"></i>
                        </div>
                        <div>
                            <p class="font-bold text-sm text-gray-800">${state.meta.fileName}</p>
                            <p class="text-xs text-gray-500 font-medium flex items-center gap-1">
                                <i class="far fa-clock"></i> ${state.meta.uploadTime.toLocaleTimeString()} 
                                <span class="mx-1">•</span> 
                                ${formatFileSize(state.meta.fileSize)}
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3">
                        ${state.processedData.length > 0
                    ? `<span class="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full border border-green-200 flex items-center gap-1">
                                 <i class="fas fa-check-circle"></i> ${state.processedData.length} Registros
                               </span>`
                    : `<span class="bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1.5 rounded-full border border-yellow-200 flex items-center gap-1">
                                 <i class="fas fa-spinner fa-spin"></i> Processando
                               </span>`
                }
                        <div class="h-8 w-px bg-blue-200 mx-1"></div>
                        <button id="global-reset-btn" class="group flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 hover:shadow-sm transition-all text-xs font-bold uppercase tracking-wide">
                            <i class="fas fa-trash-alt group-hover:scale-110 transition-transform"></i> 
                            Resetar
                        </button>
                    </div>
                </div>
            `;
        }
        // Renderiza estado SEM arquivo (mas com botão Reset disponível)
        else {
            container.innerHTML = `
                <div class="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-3 flex items-center justify-between gap-4 mb-6 opacity-75 hover:opacity-100 transition-opacity">
                    <div class="flex items-center gap-3">
                        <div class="text-gray-400 ml-2">
                            <i class="fas fa-folder-open text-xl"></i>
                        </div>
                        <p class="text-sm text-gray-500 font-medium">Nenhum arquivo carregado</p>
                    </div>
                    
                    <button id="global-reset-btn" class="text-xs text-gray-500 hover:text-red-600 font-semibold px-3 py-1.5 hover:bg-red-50 rounded transition-colors flex items-center gap-2" title="Limpar parâmetros e estado">
                        <i class="fas fa-eraser"></i> Limpar Sistema
                    </button>
                </div>
            `;
        }

        const resetBtn = container.querySelector('#global-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // Mensagem diferente dependendo se tem arquivo ou apenas sujeira/params
                const msg = state.file
                    ? 'Tem certeza que deseja resetar todo o sistema? O arquivo atual e todos os dados processados serão perdidos.'
                    : 'Deseja limpar todos os parâmetros e reiniciar o estado do sistema?';

                if (confirm(msg)) {
                    stateManager.reset();
                }
            });
        }
    }
}