import excelProcessor from '../../core/excelProcessor.js';
import stateManager from '../../core/StateManager.js';
import { FileStatus } from '../../components/FileStatus.js';
import { validateFile } from '../../core/validators.js';
import { formatCurrency } from '../../core/formatters.js';
import notification from '../../components/Notification.js';

let isPyodideReady = false;

export async function renderProcessador() {
  return `
    <div class="main-grid">
      <div id="processador-file-status" class="col-span-full hidden"></div>

      <div class="left-panel">
        <div class="panel-card" id="upload-card-processador">
          <h2 class="section-title">1. Fonte de Dados</h2>
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
          <h2 class="section-title mb-4">3. Resultados</h2>
          
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

export function initProcessador() {
  new FileStatus('processador-file-status');

  const fileUpload = document.getElementById('file-upload-processador');
  const dropZone = document.getElementById('drop-zone-processador');
  const processBtn = document.getElementById('process-btn-processador');

  stateManager.subscribe((state) => updateUI(state));
  updateUI(stateManager.getState());

  const handleUpload = (file) => {
    const valid = validateFile(file);
    if (!valid.valid) return notification.error(valid.error);
    if (stateManager.hasFile()) {
      FileStatus.requestFileChange(() => stateManager.setFile(file));
    } else {
      stateManager.setFile(file);
    }
  };

  dropZone?.addEventListener('click', () => fileUpload.click());
  fileUpload?.addEventListener('change', (e) => e.target.files[0] && handleUpload(e.target.files[0]));

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

  ['mes-referencia-processador', 'data-vencimento-processador'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      stateManager.setParams({ [e.target.id.includes('mes') ? 'mesReferencia' : 'dataVencimento']: e.target.value });
    });
  });

  processBtn?.addEventListener('click', handleProcess);

  document.getElementById('export-json-btn')?.addEventListener('click', () => exportData('json'));
  document.getElementById('export-csv-btn')?.addEventListener('click', () => exportData('csv'));
  document.getElementById('send-to-corretor-btn')?.addEventListener('click', () => {
    window.location.hash = '/corretor';
    notification.success('Navegando para o Corretor...');
  });

  // Inicializar Pyodide
  initPyodideForProcessador();
}

async function initPyodideForProcessador() {
  try {
    await excelProcessor.init((status) => {
      console.log('Pyodide:', status);
    });

    isPyodideReady = true;
    updateUI(stateManager.getState());
  } catch (error) {
    console.error('Erro ao inicializar Pyodide:', error);
    notification.error('Falha ao carregar motor de processamento.');
  }
}

function updateUI(state) {
  const uploadCard = document.getElementById('upload-card-processador');
  const statusEl = document.getElementById('processador-file-status');
  const mesRef = document.getElementById('mes-referencia-processador');
  const dataVenc = document.getElementById('data-vencimento-processador');
  const processBtn = document.getElementById('process-btn-processador');

  if (mesRef && state.params.mesReferencia) mesRef.value = state.params.mesReferencia;
  if (dataVenc && state.params.dataVencimento) dataVenc.value = state.params.dataVencimento;

  if (statusEl) statusEl.classList.remove('hidden');
  if (state.file) {
    uploadCard?.classList.add('hidden');
  } else {
    uploadCard?.classList.remove('hidden');
  }

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

  const hasData = state.processedData.length > 0;
  document.getElementById('empty-state-processador')?.classList.toggle('hidden', hasData);
  document.getElementById('stats-container-processador')?.classList.toggle('hidden', !hasData);
  document.getElementById('table-container-processador')?.classList.toggle('hidden', !hasData);
  document.getElementById('actions-container-processador')?.classList.toggle('hidden', !hasData);

  // Renderiza resultados E warnings
  if (hasData) {
    renderResults(state.processedData);
    renderWarnings(state.validationWarnings || []);
  } else {
    document.getElementById('validation-warnings-container')?.classList.add('hidden');
  }
}

function renderWarnings(warnings) {
  const container = document.getElementById('validation-warnings-container');
  if (!container) return;

  container.innerHTML = '';

  if (!warnings || warnings.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  warnings.forEach(w => {
    const colors = w.type === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-yellow-50 border-yellow-200 text-yellow-800';

    const icon = w.type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';

    const div = document.createElement('div');
    div.className = `p-4 rounded-lg border flex items-start gap-3 ${colors}`;

    let detailsHtml = '';
    if (w.details) {
      if (typeof w.details === 'object') {
        detailsHtml = `<p class="text-xs mt-1 opacity-80">${JSON.stringify(w.details)}</p>`;
      } else {
        detailsHtml = `<p class="text-xs mt-1 opacity-80">${w.details}</p>`;
      }
    }

    div.innerHTML = `
            <i class="fas ${icon} mt-0.5"></i>
            <div class="flex-1">
                <p class="font-bold text-sm">${w.title || 'Alerta'}</p>
                <p class="text-sm mt-1">${w.message}</p>
                ${detailsHtml}
            </div>
        `;
    container.appendChild(div);
  });
}

async function handleProcess() {
  const state = stateManager.getState();
  if (!state.file) return notification.error("Nenhum arquivo carregado.");

  const btn = document.getElementById('process-btn-processador');
  try {
    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div> Processando...';

    // Chama o processor que agora retorna {data, warnings}
    const result = await excelProcessor.processFile(state.file, state.params.mesReferencia, state.params.dataVencimento);

    // Usa o novo método do StateManager
    stateManager.setProcessedData(result);

    const dataCount = result.data?.length || 0;
    const warningsCount = result.warnings?.length || 0;

    if (warningsCount > 0) {
      const errorCount = result.warnings.filter(w => w.severity === 'error').length;
      if (errorCount > 0) {
        notification.warning(`${dataCount} registros processados com ${errorCount} erro(s) encontrado(s)`);
      } else {
        notification.success(`${dataCount} registros processados com ${warningsCount} aviso(s)`);
      }
    } else {
      notification.success(`${dataCount} registros processados com sucesso!`);
    }
  } catch (e) {
    notification.error(e.message || 'Erro ao processar arquivo');
    console.error(e);
  } finally {
    btn.disabled = false;
    updateUI(stateManager.getState());
  }
}

function renderResults(data) {
  const total = data.length;
  const econ = data.reduce((acc, curr) => acc + (curr.economiaMes || 0), 0);
  const co2 = data.reduce((acc, curr) => acc + (curr.co2Evitado || 0), 0);
  const arvores = data.reduce((acc, curr) => acc + (curr.arvoresEquivalentes || 0), 0);

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-economia').textContent = formatCurrency(econ);
  document.getElementById('stat-co2').textContent = co2.toFixed(2);
  document.getElementById('stat-arvores').textContent = arvores.toFixed(0);

  const tbody = document.getElementById('table-body-processador');
  if (!tbody) return;

  tbody.innerHTML = data.slice(0, 20).map(c => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="p-3 font-medium text-gray-800">${c.nome}</td>
            <td class="p-3 text-gray-600">${c.instalacao}</td>
            <td class="p-3 text-right text-success font-semibold">${formatCurrency(c.economiaMes)}</td>
            <td class="p-3 text-right text-primary font-bold">${formatCurrency(c.totalPagar)}</td>
        </tr>
    `).join('');
}

function exportData(format) {
  const data = stateManager.getState().processedData;
  if (!data || data.length === 0) {
    notification.warning('Nenhum dado para exportar');
    return;
  }

  const mesRef = stateManager.getState().params.mesReferencia || 'dados';

  if (format === 'json') {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `processamento_${mesRef}.json`);
    notification.success('JSON exportado com sucesso!');
  } else if (format === 'csv') {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `processamento_${mesRef}.csv`);
    notification.success('CSV exportado com sucesso!');
  }
}

function convertToCSV(data) {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];

  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      const escaped = String(value).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

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