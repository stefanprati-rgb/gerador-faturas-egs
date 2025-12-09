// src/modules/processador/templates/processador-template.js

/**
 * Retorna o template HTML principal para o módulo Processador.
 * @returns {string} HTML do Processador.
 */
export function getProcessadorTemplate() {
  return `
      <div class="main-grid">
        <div id="processador-file-status" class="col-span-full hidden"></div>

        <div class="left-panel">
          
          <div class="panel-card" id="upload-card-processador">
            <div class="flex justify-between items-center mb-4">
              <h2 class="section-title mb-0">1. Fonte de Dados</h2>
              <div class="flex items-center gap-2">
                <span id="db-status-text" class="hidden text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <i class="fas fa-check-circle mr-1"></i>Base carregada
                </span>
                <button id="config-btn-processador" class="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all group" title="Configurações da Base de Clientes">
                  <i class="fas fa-cog text-lg"></i>
                  <span id="config-badge" class="hidden absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
                  <span class="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Configurar base de clientes
                  </span>
                </button>
              </div>
            </div>
            <div id="drop-zone-processador" class="drop-zone">
              <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
              <p class="font-semibold">Carregar Planilha</p>
              <p class="text-sm text-text-muted mt-1">.xlsx, .xlsm, .xls</p>
            </div>
            <input id="file-upload-processador" type="file" class="hidden" accept=".xlsx,.xlsm,.xls">
          </div>

          <div class="panel-card">
            <h2 class="section-title">2. Parâmetros</h2>
            <div class="space-y-4">
              <div>
                <label for="mes-referencia-processador" class="block text-sm font-medium mb-1">Mês de Referência</label>
                <input type="month" id="mes-referencia-processador" class="input">
              </div>
              <div>
                <label for="data-vencimento-processador" class="block text-sm font-medium mb-1">Data de Vencimento</label>
                <input type="date" id="data-vencimento-processador" class="input">
              </div>
            </div>
          </div>

          <button id="process-btn-processador" class="w-full btn btn-primary text-lg py-3 shadow-lg hover:shadow-xl transition-all" disabled>
            <i class="fas fa-cogs mr-2"></i>Processar Dados
          </button>
        </div>

        <div class="right-panel">
          <div class="panel-card min-h-[500px] flex flex-col">
            <div class="flex justify-between items-center mb-4">
              <h2 class="section-title mb-0">3. Resultados</h2>
              <span id="result-count-badge" class="hidden bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">0</span>
            </div>
            
            <div id="validation-warnings-container" class="hidden mb-6 space-y-3"></div>

            <div id="empty-state-processador" class="text-center text-gray-500 py-20 flex-grow flex flex-col items-center justify-center">
              <div class="bg-gray-50 p-6 rounded-full mb-4">
                <i class="fas fa-table text-4xl text-gray-300"></i>
              </div>
              <p class="font-medium">Aguardando processamento</p>
              <p class="text-sm mt-1 max-w-xs">Carregue a planilha e clique em processar para visualizar os dados.</p>
            </div>

            <div id="stats-container-processador" class="hidden grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div class="p-3 bg-blue-50 border border-blue-100 rounded-lg text-center">
                <div id="stat-total" class="text-2xl font-bold text-primary mb-1">0</div>
                <div class="text-xs text-text-muted font-medium uppercase">Clientes</div>
              </div>
              <div class="p-3 bg-green-50 border border-green-100 rounded-lg text-center">
                <div id="stat-economia" class="text-xl font-bold text-success mb-1">R$ 0</div>
                <div class="text-xs text-text-muted font-medium uppercase">Economia</div>
              </div>
              <div class="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-center">
                <div id="stat-co2" class="text-xl font-bold text-warning mb-1">0</div>
                <div class="text-xs text-text-muted font-medium uppercase">kg CO₂</div>
              </div>
              <div class="p-3 bg-gray-50 border border-gray-100 rounded-lg text-center">
                <div id="stat-arvores" class="text-xl font-bold text-secondary mb-1">0</div>
                <div class="text-xs text-text-muted font-medium uppercase">Árvores</div>
              </div>
            </div>

            <div id="table-container-processador" class="hidden overflow-hidden rounded-lg border border-gray-100 mb-6 shadow-sm">
              <div class="overflow-x-auto max-h-[400px]">
                <table class="w-full text-sm text-left">
                  <thead class="bg-gray-50 text-gray-600 font-medium sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th class="p-3">Cliente</th>
                      <th class="p-3">Instalação</th>
                      <th class="p-3 text-right">Economia</th>
                      <th class="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody id="table-body-processador" class="divide-y divide-gray-100 bg-white"></tbody>
                </table>
              </div>
              <div class="p-2 bg-gray-50 text-xs text-center text-gray-500 border-t border-gray-100">
                * Exibindo primeiros 20 registros para pré-visualização
              </div>
            </div>

            <div id="actions-container-processador" class="hidden mt-auto pt-6 border-t border-gray-100 flex gap-3 flex-wrap">
              <button id="send-to-corretor-btn" class="btn btn-primary flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                <i class="fas fa-edit mr-2"></i>Corrigir Faturas
              </button>
              <button id="export-json-btn" class="btn btn-secondary flex-1">
                <i class="fas fa-file-code mr-2"></i>JSON
              </button>
              <button id="export-csv-btn" class="btn btn-secondary flex-1">
                <i class="fas fa-file-csv mr-2"></i>CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
}