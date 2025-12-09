/**
 * Modal de Configuração da Base de Clientes
 */

export function createConfigModal() {
    const modal = document.createElement('div');
    modal.id = 'config-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <i class="fas fa-cog text-white text-lg"></i>
                    </div>
                    <h2 class="text-xl font-semibold text-white">Configurações da Base de Clientes</h2>
                </div>
                <button id="close-config-modal" class="text-white/80 hover:text-white transition-colors">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-6">
                <!-- Status da Base -->
                <div id="db-status-container" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div id="db-status-icon" class="w-10 h-10 rounded-full flex items-center justify-center">
                                <i class="fas fa-database text-lg"></i>
                            </div>
                            <div>
                                <p id="db-status-text" class="font-medium text-gray-900">Nenhuma base carregada</p>
                                <p id="db-status-detail" class="text-sm text-gray-500">Usando dados do relatório</p>
                            </div>
                        </div>
                        <button id="remove-db-btn" class="hidden text-red-600 hover:text-red-700 transition-colors">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>

                <!-- Upload Section -->
                <div class="space-y-3">
                    <label class="block">
                        <span class="text-sm font-medium text-gray-700 mb-2 block">
                            <i class="fas fa-upload mr-2"></i>Carregar Base de Clientes Externa
                        </span>
                        <div class="relative">
                            <input 
                                type="file" 
                                id="external-db-input" 
                                accept=".xlsx,.xls"
                                class="hidden"
                            />
                            <button 
                                id="upload-db-btn"
                                class="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-600 hover:text-blue-600 font-medium"
                            >
                                <i class="fas fa-file-excel mr-2"></i>
                                Selecionar arquivo Excel
                            </button>
                        </div>
                    </label>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                        <p class="text-xs text-blue-900 font-medium mb-1">
                            <i class="fas fa-folder-open mr-1"></i>
                            Localização do arquivo:
                        </p>
                        <p class="text-xs text-blue-800 font-mono break-all">
                            %USERPROFILE%\\GRUPO GERA\\Gestão GDC - Documentos\\EGS\\4 - Base de Clientes\\<strong>BASE DE CLIENTES - EGS.xlsx</strong>
                        </p>
                    </div>
                    <p class="text-xs text-gray-500 mt-2">
                        <i class="fas fa-info-circle mr-1"></i>
                        Navegue até a pasta acima e selecione o arquivo para incluir endereços completos nas faturas.
                    </p>
                </div>

                <!-- Info Box -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div class="flex space-x-3">
                        <i class="fas fa-lightbulb text-blue-600 mt-1"></i>
                        <div class="text-sm text-blue-900">
                            <p class="font-medium mb-1">Como funciona?</p>
                            <ul class="space-y-1 text-blue-800">
                                <li>• A base externa contém endereços completos dos clientes</li>
                                <li>• Ao processar, o sistema usará esses dados automaticamente</li>
                                <li>• O arquivo fica salvo apenas nesta sessão do navegador</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="bg-gray-50 px-6 py-4 flex justify-end">
                <button id="close-config-modal-btn" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    Fechar
                </button>
            </div>
        </div>
    `;

    return modal;
}

/**
 * Inicializa o modal de configuração
 */
export function initConfigModal(excelProcessor, onStatusChange) {
    const modal = createConfigModal();
    document.body.appendChild(modal);

    // Elementos
    const closeButtons = modal.querySelectorAll('#close-config-modal, #close-config-modal-btn');
    const uploadBtn = modal.querySelector('#upload-db-btn');
    const fileInput = modal.querySelector('#external-db-input');
    const removeBtn = modal.querySelector('#remove-db-btn');
    const statusIcon = modal.querySelector('#db-status-icon');
    const statusText = modal.querySelector('#db-status-text');
    const statusDetail = modal.querySelector('#db-status-detail');

    // Fechar modal
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    });

    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Botão de upload
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // Upload de arquivo
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Carregando...';
            uploadBtn.disabled = true;

            // Carregar arquivo no Pyodide
            await excelProcessor.loadExternalClientDatabase(file);

            // Atualizar UI
            updateStatus(true, file.name);

            // Salvar no localStorage
            localStorage.setItem('externalDbLoaded', 'true');
            localStorage.setItem('externalDbName', file.name);

            // Mostrar notificação
            if (window.notification) {
                window.notification.success('Base de clientes carregada com sucesso!');
            }

            // Chamar callback para atualizar indicadores externos
            if (onStatusChange) {
                onStatusChange();
            }

        } catch (error) {
            console.error('Erro ao carregar base de clientes:', error);
            if (window.notification) {
                window.notification.error('Erro ao carregar arquivo: ' + error.message);
            }
        } finally {
            uploadBtn.innerHTML = '<i class="fas fa-file-excel mr-2"></i>Selecionar arquivo Excel';
            uploadBtn.disabled = false;
            fileInput.value = '';
        }
    });

    // Remover base
    removeBtn.addEventListener('click', async () => {
        try {
            await excelProcessor.clearExternalDatabase();
            updateStatus(false);
            localStorage.removeItem('externalDbLoaded');
            localStorage.removeItem('externalDbName');

            if (window.notification) {
                window.notification.info('Base de clientes removida');
            }

            // Chamar callback para atualizar indicadores externos
            if (onStatusChange) {
                onStatusChange();
            }
        } catch (error) {
            console.error('Erro ao remover base:', error);
        }
    });

    // Atualizar status da UI
    function updateStatus(loaded, fileName = '') {
        if (loaded) {
            statusIcon.className = 'w-10 h-10 rounded-full flex items-center justify-center bg-green-100';
            statusIcon.innerHTML = '<i class="fas fa-check-circle text-green-600 text-lg"></i>';
            statusText.textContent = 'Base externa carregada';
            statusDetail.textContent = fileName || 'Arquivo carregado com sucesso';
            removeBtn.classList.remove('hidden');
        } else {
            statusIcon.className = 'w-10 h-10 rounded-full flex items-center justify-center bg-gray-100';
            statusIcon.innerHTML = '<i class="fas fa-database text-gray-400 text-lg"></i>';
            statusText.textContent = 'Nenhuma base carregada';
            statusDetail.textContent = 'Usando dados do relatório';
            removeBtn.classList.add('hidden');
        }
    }

    // Verificar status ao abrir
    const checkStatus = async () => {
        const isLoaded = localStorage.getItem('externalDbLoaded') === 'true';
        const fileName = localStorage.getItem('externalDbName') || '';

        if (isLoaded) {
            const status = await excelProcessor.getExternalDatabaseStatus();
            updateStatus(status.loaded, fileName);
        }
    };

    // Retornar funções públicas
    return {
        open: () => {
            modal.classList.remove('hidden');
            checkStatus();
        },
        close: () => {
            modal.classList.add('hidden');
        }
    };
}
