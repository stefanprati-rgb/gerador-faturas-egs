/**
 * Módulo Gerador de Faturas - Refatorado com StateManager e Grid Layout
 */

import stateManager from '../../core/StateManager.js';
import { FileStatus } from '../../components/FileStatus.js';
import excelProcessor from '../../core/excelProcessor.js';
import { pdfGenerator } from '../../core/pdfGenerator.js';
import { formatCurrency, normalizeString } from '../../core/formatters.js';
import notification from '../../components/Notification.js';
import progressBar from '../../components/ProgressBar.js';
import { validateFile } from '../../core/validators.js';

let isPyodideReady = false;

/**
 * Renderiza a interface do gerador
 */
export async function renderGerador() {
  return `
    <div class="main-grid">
      <div id="gerador-file-status" class="col-span-full hidden"></div>

      <div class="left-panel">
        
        <div class="panel-card" id="upload-card-gerador">
          <h2 class="section-title">1. Fonte de Dados</h2>
          <div id="drop-zone-gerador" class="drop-zone">
            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
            <p class="font-semibold">Carregar Planilha</p>
            <p class="text-sm text-text-muted mt-1">.xlsx, .xlsm, .xls</p>
          </div>
          <input id="file-upload-gerador" type="file" class="hidden" accept=".xlsx,.xlsm,.xls">
        </div>

        <div class="panel-card">
          <h2 class="section-title">2. Parâmetros</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Mês de Referência</label>
              <input type="month" id="mes-referencia-gerador" class="input">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Data de Vencimento</label>
              <input type="date" id="data-vencimento-gerador" class="input">
            </div>
          </div>
        </div>

        <button id="process-btn-gerador" class="w-full btn btn-primary text-lg py-3 shadow-lg hover:shadow-xl transition-all" disabled>
          <i class="fas fa-cogs mr-2"></i>Processar e Listar
        </button>
      </div>

      <div class="right-panel">
        <div class="panel-card min-h-[500px] flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h2 class="section-title mb-0">3. Resultados (Faturas)</h2>
            
            <div id="search-container-gerador" class="hidden relative w-64">
              <input type="text" id="search-client-gerador" placeholder="Buscar cliente..." class="input pl-9 py-1 text-sm">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            </div>
          </div>

          <div id="result-list-gerador" class="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            <div id="empty-state-gerador" class="text-center text-gray-500 py-20 flex-grow flex flex-col items-center justify-center">
              <div class="bg-gray-50 p-6 rounded-full mb-4">
                <i class="fas fa-file-invoice text-4xl text-gray-300"></i>
              </div>
              <p class="font-medium">Nenhuma fatura gerada</p>
              <p class="text-sm mt-1 max-w-xs">Carregue a planilha e defina os parâmetros para visualizar os clientes.</p>
            </div>
          </div>

          <div id="download-all-area-gerador" class="mt-auto pt-6 border-t border-gray-100 hidden">
            <button id="download-all-btn-gerador" class="w-full btn bg-gray-800 text-white hover:bg-gray-900 py-3">
              <i class="fas fa-file-archive mr-2"></i>Baixar Todas as Faturas (ZIP)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Inicializa eventos do módulo gerador
 */
export function initGerador() {
  new FileStatus('gerador-file-status');

  const fileUpload = document.getElementById('file-upload-gerador');
  const dropZone = document.getElementById('drop-zone-gerador');
  const processBtn = document.getElementById('process-btn-gerador');
  const searchInput = document.getElementById('search-client-gerador');
  const downloadAllBtn = document.getElementById('download-all-btn-gerador');

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

  ['mes-referencia-gerador', 'data-vencimento-gerador'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      stateManager.setParams({ [e.target.id.includes('mes') ? 'mesReferencia' : 'dataVencimento']: e.target.value });
    });
  });

  processBtn?.addEventListener('click', handleProcess);
  searchInput?.addEventListener('input', handleSearch);
  downloadAllBtn?.addEventListener('click', handleDownloadAll);

  initPyodide();
}

async function initPyodide() {
  try {
    await excelProcessor.init((status) => console.log('Pyodide:', status));
    isPyodideReady = true;
    updateUI(stateManager.getState());
  } catch (error) {
    console.error('Erro ao inicializar Pyodide:', error);
    notification.error('Falha ao carregar motor de processamento.');
  }
}

function updateUI(state) {
  // PROTEÇÃO CONTRA CRASH
  const processBtn = document.getElementById('process-btn-gerador');
  if (!processBtn) return;

  const uploadCard = document.getElementById('upload-card-gerador');
  const statusEl = document.getElementById('gerador-file-status');
  const mesRef = document.getElementById('mes-referencia-gerador');
  const dataVenc = document.getElementById('data-vencimento-gerador');

  if (mesRef && state.params.mesReferencia) mesRef.value = state.params.mesReferencia;
  if (dataVenc && state.params.dataVencimento) dataVenc.value = state.params.dataVencimento;

  if (statusEl) statusEl.classList.remove('hidden');

  if (state.file) {
    uploadCard?.classList.add('hidden');
  } else {
    uploadCard?.classList.remove('hidden');
  }

  const isReady = state.file && state.params.mesReferencia && state.params.dataVencimento && isPyodideReady;

  processBtn.disabled = !isReady;

  if (!isPyodideReady && state.file) {
    processBtn.innerHTML = '<div class="loader mr-2"></div> Carregando...';
  } else if (state.processedData.length > 0) {
    processBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Reprocessar Lista';
  } else {
    processBtn.innerHTML = '<i class="fas fa-cogs mr-2"></i>Processar e Listar';
  }

  if (state.processedData.length > 0) {
    renderClientList(state.processedData);
    document.getElementById('search-container-gerador')?.classList.remove('hidden');
    document.getElementById('download-all-area-gerador')?.classList.remove('hidden');
    document.getElementById('empty-state-gerador')?.classList.add('hidden');
  } else {
    // Reset visual
    const resultList = document.getElementById('result-list-gerador');
    const emptyState = document.getElementById('empty-state-gerador');

    if (resultList && emptyState) {
      if (resultList.children.length > 1 || (resultList.children.length === 1 && resultList.children[0].id !== 'empty-state-gerador')) {
        resultList.innerHTML = '';
        resultList.appendChild(emptyState);
      }
      emptyState.classList.remove('hidden');
    }

    document.getElementById('search-container-gerador')?.classList.add('hidden');
    document.getElementById('download-all-area-gerador')?.classList.add('hidden');
  }
}

async function handleProcess() {
  const state = stateManager.getState();
  const processBtn = document.getElementById('process-btn-gerador');

  if (!state.file || !state.params.mesReferencia || !state.params.dataVencimento) {
    notification.error('Preencha todos os campos');
    return;
  }

  try {
    if (processBtn) {
      processBtn.disabled = true;
      processBtn.innerHTML = '<div class="loader mr-2"></div> Processando...';
    }

    const result = await excelProcessor.processFile(
      state.file,
      state.params.mesReferencia,
      state.params.dataVencimento
    );

    stateManager.setProcessedResult(result);

    const count = result.data?.length || 0;
    notification.success(`${count} faturas geradas com sucesso!`);

  } catch (error) {
    notification.error(error.message || 'Erro ao processar arquivo');
    console.error(error);
  } finally {
    if (processBtn) processBtn.disabled = false;
  }
}

function renderClientList(clients) {
  const resultList = document.getElementById('result-list-gerador');
  if (!resultList) return;

  resultList.innerHTML = '';

  if (clients.length === 0) {
    resultList.innerHTML = `
      <div class="text-center text-gray-500 py-10">
        <i class="fas fa-search text-4xl mb-3 text-gray-300"></i>
        <p class="font-semibold">Nenhum cliente encontrado</p>
      </div>
    `;
    return;
  }

  clients.forEach(client => {
    // Tratamento defensivo: usa o nome disponível ou fallback
    const nomeCliente = client.nome || client.nomeCliente || 'Nome não disponível';
    const valorTotal = client.totalPagar || client.valorTotal || 0;

    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200';
    div.innerHTML = `
      <div class="flex-1">
        <p class="font-semibold text-gray-900">${nomeCliente}</p>
        <p class="text-sm text-gray-600">Instalação: ${client.instalacao || 'N/A'}</p>
        ${valorTotal > 0 ? `<p class="text-sm text-blue-600 font-medium mt-1">${formatCurrency(valorTotal)}</p>` : ''}
      </div>
      <button class="btn btn-primary generate-pdf-btn" data-instalacao="${client.instalacao || ''}">
        <i class="fas fa-file-pdf mr-1"></i>Gerar PDF
      </button>
    `;
    resultList.appendChild(div);
  });

  // Event listeners para botões
  resultList.querySelectorAll('.generate-pdf-btn').forEach(btn => {
    btn.addEventListener('click', () => handleGeneratePDF(btn.dataset.instalacao));
  });
}

async function handleGeneratePDF(instalacao) {
  const state = stateManager.getState();
  const client = state.processedData.find(c => String(c.instalacao) === String(instalacao));

  if (!client) return notification.error('Cliente não encontrado');

  const btn = document.querySelector(`[data-instalacao="${instalacao}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="loader w-3 h-3 border-2"></div>';
  }

  try {
    const { blob, filename } = await pdfGenerator.generatePDF(client, state.params.mesReferencia);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
    notification.success('PDF gerado!');
  } catch (error) {
    notification.error('Erro ao gerar PDF');
    console.error(error);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-pdf mr-2"></i>PDF';
    }
  }
}

function handleSearch(e) {
  const state = stateManager.getState();
  const query = normalizeString(e.target.value);

  const filtered = state.processedData.filter(c =>
    normalizeString(c.nome).includes(query) ||
    normalizeString(String(c.instalacao)).includes(query)
  );
  renderClientList(filtered);
}

async function handleDownloadAll() {
  const state = stateManager.getState();
  if (state.processedData.length === 0) return notification.error('Nenhum cliente para gerar');

  try {
    progressBar.show('Gerando PDFs...', '');
    const zipBlob = await pdfGenerator.generateZIP(
      state.processedData,
      state.params.mesReferencia,
      (current, total) => progressBar.setProgress(current, total, 'Gerando PDFs...')
    );
    progressBar.hide();

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Faturas_${state.params.mesReferencia}.zip`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
    notification.success('ZIP gerado com sucesso!');
  } catch (error) {
    progressBar.hide();
    notification.error('Erro ao gerar ZIP');
  }
}