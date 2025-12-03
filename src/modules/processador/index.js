/**
 * Módulo Processador de Planilhas - Refatorado com StateManager
 */

import excelProcessor from '../../core/excelProcessor.js';
import stateManager from '../../core/StateManager.js';
import { FileStatus } from '../../components/FileStatus.js';
import { validateFile } from '../../core/validators.js';
import { formatCurrency } from '../../core/formatters.js';
import notification from '../../components/Notification.js';

let isPyodideReady = false;

/**
 * Renderiza a interface do processador
 */
export async function renderProcessador() {
  return `
    <div class="main-grid">
      <!-- File Status Global -->
      <div id="processador-file-status" class="col-span-full hidden"></div>

      <!-- Left Panel: Controles -->
      <div class="left-panel">
        
        <!-- Upload Card -->
        <div class="panel-card" id="upload-card-processador">
          <h2 class="section-title">1. Fonte de Dados</h2>
          <div id="drop-zone-processador" class="drop-zone">
            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
            <p class="font-semibold">Carregar Planilha</p>
            <p class="text-sm text-text-muted mt-1">.xlsx, .xlsm, .xls</p>
          </div>
          <input id="file-upload-processador" type="file" class="hidden" accept=".xlsx,.xlsm,.xls">
        </div>

        <!-- Parâmetros -->
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

        <!-- Botão Processar -->
        <button id="process-btn-processador" class="w-full btn btn-primary text-lg py-3 shadow-lg hover:shadow-xl transition-all" disabled>
          <i class="fas fa-cogs mr-2"></i>Processar Dados
        </button>
      </div>

      <!-- Right Panel: Resultados -->
      <div class="right-panel">
        <div class="panel-card min-h-[500px] flex flex-col">
          <h2 class="section-title mb-4">3. Resultados</h2>
          
          <!-- Empty State -->
          <div id="empty-state-processador" class="text-center text-gray-500 py-20 flex-grow flex flex-col items-center justify-center">
            <div class="bg-gray-50 p-6 rounded-full mb-4">
              <i class="fas fa-table text-4xl text-gray-300"></i>
            </div>
            <p class="font-medium">Aguardando processamento</p>
            <p class="text-sm mt-1 max-w-xs">Carregue a planilha e clique em processar para visualizar os dados.</p>
          </div>

          <!-- Stats Cards -->
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

          <!-- Table -->
          <div id="table-container-processador" class="hidden overflow-hidden rounded-lg border border-gray-100 mb-6">
            <div class="overflow-x-auto max-h-[400px]">
              <table class="w-full text-sm text-left">
                <thead class="bg-gray-50 text-gray-600 font-medium sticky top-0">
                  <tr>
                    <th class="p-3">Cliente</th>
                    <th class="p-3">Instalação</th>
                    <th class="p-3 text-right">Economia</th>
                    <th class="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody id="table-body-processador" class="divide-y divide-gray-100"></tbody>
              </table>
            </div>
            <div class="p-2 bg-gray-50 text-xs text-center text-gray-500 border-t border-gray-100">
              * Exibindo primeiros 20 registros
            </div>
          </div>

          <!-- Actions -->
          <div id="actions-container-processador" class="hidden mt-auto pt-6 border-t border-gray-100 flex gap-3 flex-wrap">
            <button id="send-to-corretor-btn" class="btn btn-primary flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
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

/**
 * Inicializa eventos do módulo processador
 */
export function initProcessador() {
  // Inicializa componente de status global
  new FileStatus('processador-file-status');

  const fileUpload = document.getElementById('file-upload-processador');
  const dropZone = document.getElementById('drop-zone-processador');
  const processBtn = document.getElementById('process-btn-processador');
  const exportJsonBtn = document.getElementById('export-json-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const sendToCorretorBtn = document.getElementById('send-to-corretor-btn');

  // Sincronizar com Estado Global
  stateManager.subscribe((state) => {
    updateUI(state);
  });

  // Inicializa UI com estado atual
  updateUI(stateManager.getState());

  // Upload Logic
  const handleUpload = (file) => {
    const valid = validateFile(file);
    if (!valid.valid) {
      notification.error(valid.error);
      return;
    }

    if (stateManager.hasFile()) {
      FileStatus.requestFileChange(() => {
        stateManager.setFile(file);
      });
    } else {
      stateManager.setFile(file);
    }
  };

  // Event Listeners - Upload
  dropZone?.addEventListener('click', () => fileUpload.click());
  fileUpload?.addEventListener('change', (e) => {
    if (e.target.files[0]) handleUpload(e.target.files[0]);
  });

  // Drag and Drop
  ['dragenter', 'dragover'].forEach(evName => {
    dropZone?.addEventListener(evName, (e) => {
      e.preventDefault();
      dropZone.classList.add('drop-active');
    });
  });

  ['dragleave', 'drop'].forEach(evName => {
    dropZone?.addEventListener(evName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-active');
    });
  });

  dropZone?.addEventListener('drop', (e) => {
    if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
  });

  // Parâmetros - Atualiza estado global ao mudar
  const mesReferenciaEl = document.getElementById('mes-referencia-processador');
  const dataVencimentoEl = document.getElementById('data-vencimento-processador');

  mesReferenciaEl?.addEventListener('change', (e) => {
    stateManager.setParams({ mesReferencia: e.target.value });
  });

  dataVencimentoEl?.addEventListener('change', (e) => {
    stateManager.setParams({ dataVencimento: e.target.value });
  });

  // Processar
  processBtn?.addEventListener('click', handleProcess);

  // Exportar
  exportJsonBtn?.addEventListener('click', () => exportData('json'));
  exportCsvBtn?.addEventListener('click', () => exportData('csv'));

  // Enviar para Corretor
  sendToCorretorBtn?.addEventListener('click', () => {
    window.location.hash = '/corretor';
    notification.success('Navegando para o Corretor...');
  });

  // Inicializar Pyodide
  initPyodideForProcessador();
}

/**
 * Inicializa Pyodide
 */
async function initPyodideForProcessador() {
  try {
    await excelProcessor.init((status) => {
      console.log('Pyodide:', status);
    });

    isPyodideReady = true;
    updateUI(stateManager.getState()); // Revalidar UI

    // Notificação removida para evitar spam ao trocar de abas
  } catch (error) {
    console.error('Erro ao inicializar Pyodide:', error);
    notification.error('Falha ao carregar motor de processamento.');
  }
}

/**
 * Atualiza UI baseado no estado global
 */
function updateUI(state) {
  const uploadCard = document.getElementById('upload-card-processador');
  const fileStatusEl = document.getElementById('processador-file-status');
  const mesRef = document.getElementById('mes-referencia-processador');
  const dataVenc = document.getElementById('data-vencimento-processador');
  const processBtn = document.getElementById('process-btn-processador');

  // Sincroniza Inputs com estado
  if (mesRef && state.params.mesReferencia) {
    mesRef.value = state.params.mesReferencia;
  }
  if (dataVenc && state.params.dataVencimento) {
    dataVenc.value = state.params.dataVencimento;
  }

  // Gerencia Visibilidade do Upload
  if (state.file) {
    uploadCard?.classList.add('hidden');
    fileStatusEl?.classList.remove('hidden');
  } else {
    uploadCard?.classList.remove('hidden');
    fileStatusEl?.classList.add('hidden');
  }

  // Habilita/Desabilita Botão Processar
  const isReady = state.file && state.params.mesReferencia && state.params.dataVencimento && isPyodideReady;

  if (processBtn) {
    processBtn.disabled = !isReady;

    if (!isPyodideReady && state.file) {
      processBtn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div> Carregando sistema...';
    } else if (state.processedData.length > 0) {
      processBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Reprocessar Dados';
    } else {
      processBtn.innerHTML = '<i class="fas fa-cogs mr-2"></i>Processar Dados';
    }
  }

  // Mostrar/Ocultar Resultados
  const hasData = state.processedData.length > 0;
  document.getElementById('empty-state-processador')?.classList.toggle('hidden', hasData);
  document.getElementById('stats-container-processador')?.classList.toggle('hidden', !hasData);
  document.getElementById('table-container-processador')?.classList.toggle('hidden', !hasData);
  document.getElementById('actions-container-processador')?.classList.toggle('hidden', !hasData);

  if (hasData) {
    renderResults(state.processedData);
  }
}

/**
 * Processa planilha
 */
async function handleProcess() {
  const state = stateManager.getState();
  const processBtn = document.getElementById('process-btn-processador');

  if (!state.file || !state.params.mesReferencia || !state.params.dataVencimento) {
    notification.error('Preencha todos os campos');
    return;
  }

  try {
    // Desabilitar botão
    if (processBtn) {
      processBtn.disabled = true;
      processBtn.innerHTML = '<div class="loader"></div> Processando...';
    }

    // Processar arquivo
    const data = await excelProcessor.processFile(
      state.file,
      state.params.mesReferencia,
      state.params.dataVencimento
    );

    // Salvar no estado global
    stateManager.setProcessedData(data);

    notification.success(`${data.length} registros processados com sucesso!`);

  } catch (error) {
    notification.error(error.message || 'Erro ao processar arquivo');
    console.error(error);
  } finally {
    if (processBtn) {
      processBtn.disabled = false;
    }
    updateUI(stateManager.getState());
  }
}

/**
 * Renderiza resultados
 */
function renderResults(data) {
  // Estatísticas
  const totalClientes = data.length;
  const economiaTotal = data.reduce((sum, c) => sum + (c.economiaMes || 0), 0);
  const co2Total = data.reduce((sum, c) => sum + (c.co2Evitado || 0), 0);
  const arvoresTotal = data.reduce((sum, c) => sum + (c.arvoresEquivalentes || 0), 0);

  document.getElementById('stat-total').textContent = totalClientes;
  document.getElementById('stat-economia').textContent = formatCurrency(economiaTotal);
  document.getElementById('stat-co2').textContent = co2Total.toFixed(2);
  document.getElementById('stat-arvores').textContent = arvoresTotal.toFixed(0);

  // Tabela - Primeiros 20 registros
  const tbody = document.getElementById('table-body-processador');
  if (!tbody) return;

  tbody.innerHTML = '';

  const sampleData = data.slice(0, 20);

  sampleData.forEach((client, index) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition-colors';
    tr.innerHTML = `
      <td class="p-3 font-medium text-gray-800">${client.nome}</td>
      <td class="p-3 text-gray-600">${client.instalacao}</td>
      <td class="p-3 text-right text-success font-semibold">${formatCurrency(client.economiaMes)}</td>
      <td class="p-3 text-right text-primary font-bold">${formatCurrency(client.totalPagar)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Exporta dados
 */
function exportData(format) {
  const state = stateManager.getState();

  if (!state.processedData || state.processedData.length === 0) {
    notification.warning('Nenhum dado para exportar');
    return;
  }

  const mesRef = state.params.mesReferencia || 'dados';

  if (format === 'json') {
    const jsonStr = JSON.stringify(state.processedData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `processamento_${mesRef}.json`);
    notification.success('JSON exportado com sucesso!');
  } else if (format === 'csv') {
    const csv = convertToCSV(state.processedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `processamento_${mesRef}.csv`);
    notification.success('CSV exportado com sucesso!');
  }
}

/**
 * Converte dados para CSV
 */
function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Header
  csvRows.push(headers.join(','));

  // Rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escapar vírgulas e aspas
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Download de blob
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