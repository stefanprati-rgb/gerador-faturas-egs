/**
 * Módulo Gerador de Faturas - Refatorado com StateManager
 */

import stateManager from '../../core/StateManager.js';
import fileStatus from '../../components/FileStatus.js';
import excelProcessor from '../../core/excelProcessor.js';
import { pdfGenerator } from '../../core/pdfGenerator.js';
import { formatCurrency, normalizeString } from '../../core/formatters.js';
import notification from '../../components/Notification.js';
import progressBar from '../../components/ProgressBar.js';
import { validateFile } from '../../core/validators.js';

// Variável local apenas para dados filtrados de busca
let displayedClients = [];
let isPyodideReady = false;

/**
 * Renderiza a interface do gerador
 */
export async function renderGerador() {
  return `
    <div class="main-grid">
      <!-- File Status Global -->
      <div id="gerador-file-status" class="col-span-full hidden"></div>

      <!-- Left Panel: Controles -->
      <div class="left-panel">
        
        <!-- Upload Card -->
        <div class="panel-card" id="upload-card-gerador">
          <h2 class="section-title">1. Fonte de Dados</h2>
          <div id="drop-zone-gerador" class="drop-zone">
            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
            <p class="font-semibold">Carregar Planilha</p>
            <p class="text-sm text-text-muted mt-1">.xlsx, .xlsm, .xls</p>
          </div>
          <input id="file-upload-gerador" type="file" class="hidden" accept=".xlsx,.xlsm,.xls">
        </div>

        <!-- Parâmetros -->
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

        <!-- Botão Processar -->
        <button id="process-btn-gerador" class="w-full btn btn-primary text-lg py-3 shadow-lg hover:shadow-xl transition-all" disabled>
          <i class="fas fa-cogs mr-2"></i>Processar e Listar
        </button>
      </div>

      <!-- Right Panel: Resultados -->
      <div class="right-panel">
        <div class="panel-card min-h-[500px]">
          <div class="flex justify-between items-center mb-4">
            <h2 class="section-title mb-0">3. Resultados (Faturas)</h2>
            
            <!-- Busca -->
            <div id="search-container-gerador" class="hidden relative w-64">
              <input type="text" id="search-client-gerador" placeholder="Buscar cliente..." class="input pl-9 py-2 text-sm">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            </div>
          </div>

          <!-- Lista de Clientes -->
          <div id="result-list-gerador" class="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            <div id="empty-state-gerador" class="text-center text-gray-500 py-20 flex flex-col items-center">
              <div class="bg-gray-50 p-6 rounded-full mb-4">
                <i class="fas fa-file-invoice text-4xl text-gray-300"></i>
              </div>
              <p class="font-medium">Nenhuma fatura gerada</p>
              <p class="text-sm mt-1 max-w-xs">Carregue a planilha e defina os parâmetros para visualizar os clientes.</p>
            </div>
          </div>

          <!-- Download All -->
          <div id="download-all-area-gerador" class="mt-6 pt-6 border-t border-gray-100 hidden">
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
  // Inicializa componente de status global
  new fileStatus.constructor('gerador-file-status');

  const fileUpload = document.getElementById('file-upload-gerador');
  const dropZone = document.getElementById('drop-zone-gerador');
  const processBtn = document.getElementById('process-btn-gerador');
  const searchInput = document.getElementById('search-client-gerador');
  const downloadAllBtn = document.getElementById('download-all-btn-gerador');

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
      fileStatus.constructor.requestFileChange(() => {
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
  const mesReferenciaEl = document.getElementById('mes-referencia-gerador');
  const dataVencimentoEl = document.getElementById('data-vencimento-gerador');

  mesReferenciaEl?.addEventListener('change', (e) => {
    stateManager.setParams({ mesReferencia: e.target.value });
  });

  dataVencimentoEl?.addEventListener('change', (e) => {
    stateManager.setParams({ dataVencimento: e.target.value });
  });

  // Processar
  processBtn?.addEventListener('click', handleProcess);

  // Busca
  searchInput?.addEventListener('input', handleSearch);

  // Download All
  downloadAllBtn?.addEventListener('click', handleDownloadAll);

  // Inicializar Pyodide
  initPyodide();
}

/**
 * Inicializa Pyodide
 */
async function initPyodide() {
  try {
    await excelProcessor.init((status) => {
      console.log('Pyodide:', status);
    });

    isPyodideReady = true;
    updateUI(stateManager.getState()); // Revalidar UI

    notification.info('Sistema de processamento pronto!');
  } catch (error) {
    console.error('Erro ao inicializar Pyodide:', error);
    notification.error('Falha ao carregar motor de processamento.');
  }
}

/**
 * Atualiza UI baseado no estado global
 */
function updateUI(state) {
  const uploadCard = document.getElementById('upload-card-gerador');
  const fileStatusEl = document.getElementById('gerador-file-status');
  const mesRef = document.getElementById('mes-referencia-gerador');
  const dataVenc = document.getElementById('data-vencimento-gerador');
  const processBtn = document.getElementById('process-btn-gerador');

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
      processBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Reprocessar Lista';
    } else {
      processBtn.innerHTML = '<i class="fas fa-cogs mr-2"></i>Processar e Listar';
    }
  }

  // Se já tiver dados processados, mostra a lista automaticamente
  if (state.processedData.length > 0) {
    displayedClients = state.processedData;
    renderClientList(state.processedData);
    document.getElementById('search-container-gerador')?.classList.remove('hidden');
    document.getElementById('download-all-area-gerador')?.classList.remove('hidden');
  } else {
    const emptyState = document.getElementById('empty-state-gerador');
    const resultList = document.getElementById('result-list-gerador');
    if (emptyState && resultList) {
      resultList.innerHTML = emptyState.outerHTML;
    }
    document.getElementById('search-container-gerador')?.classList.add('hidden');
    document.getElementById('download-all-area-gerador')?.classList.add('hidden');
  }
}

/**
 * Processa relatório
 */
async function handleProcess() {
  const state = stateManager.getState();
  const processBtn = document.getElementById('process-btn-gerador');

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

    notification.success(`${data.length} clientes processados com sucesso!`);

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
 * Renderiza lista de clientes
 */
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
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200';
    div.innerHTML = `
      <div class="flex-1">
        <p class="font-semibold text-gray-900">${client.nome}</p>
        <p class="text-sm text-gray-600">Instalação: ${client.instalacao}</p>
        ${client.valorTotal ? `<p class="text-sm text-blue-600 font-medium mt-1">${formatCurrency(client.valorTotal)}</p>` : ''}
      </div>
      <button class="btn btn-primary generate-pdf-btn" data-instalacao="${client.instalacao}">
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

/**
 * Gera PDF individual
 */
async function handleGeneratePDF(instalacao) {
  const state = stateManager.getState();
  const client = state.processedData.find(c => String(c.instalacao) === String(instalacao));

  if (!client) {
    notification.error('Cliente não encontrado');
    return;
  }

  const btn = document.querySelector(`[data-instalacao="${instalacao}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div>';
  }

  try {
    const { blob, filename } = await pdfGenerator.generatePDF(client, state.params.mesReferencia);

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();

    notification.success('PDF gerado com sucesso!');
  } catch (error) {
    notification.error('Erro ao gerar PDF');
    console.error(error);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-pdf mr-1"></i>Gerar PDF';
    }
  }
}

/**
 * Busca clientes
 */
function handleSearch(e) {
  const state = stateManager.getState();
  const query = normalizeString(e.target.value);

  const filtered = state.processedData.filter(c =>
    normalizeString(c.nome).includes(query) ||
    normalizeString(String(c.instalacao)).includes(query)
  );

  displayedClients = filtered;
  renderClientList(filtered);
}

/**
 * Download de todas as faturas em ZIP
 */
async function handleDownloadAll() {
  const state = stateManager.getState();

  if (state.processedData.length === 0) {
    notification.error('Nenhum cliente para gerar');
    return;
  }

  try {
    progressBar.show('Gerando PDFs...', '');

    const zipBlob = await pdfGenerator.generateZIP(
      state.processedData,
      state.params.mesReferencia,
      (current, total) => {
        progressBar.setProgress(current, total, 'Gerando PDFs...');
      }
    );

    progressBar.hide();

    // Download ZIP
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
    console.error(error);
  }
}
