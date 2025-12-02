/**
 * Módulo Gerador de Faturas
 */

import excelProcessor from '../../core/excelProcessor.js';
import pdfGenerator from '../../core/pdfGenerator.js';
import { validateFile, validateMonth, validateDate } from '../../core/validators.js';
import { normalizeString } from '../../core/formatters.js';
import notification from '../../components/Notification.js';
import progressBar from '../../components/ProgressBar.js';
import { getPDFTemplate } from './pdfTemplate.js';

let clientData = [];
let selectedFile = null;

/**
 * Renderiza a interface do gerador
 */
export async function renderGerador() {
  // Injetar template PDF no body se ainda não existir
  if (!document.getElementById('pdf-container')) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = getPDFTemplate();
    document.body.appendChild(tempDiv.firstElementChild);
  }

  return `
    <div class="max-w-6xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">Gerador de Faturas</h1>
        <p class="text-text-muted">Gere faturas em PDF a partir de planilhas Excel</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <!-- Coluna Esquerda: Controles -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Upload de Arquivo -->
          <div class="card">
            <h2 class="text-xl font-semibold mb-4">1. Carregar Relatório</h2>
            <input id="file-upload-gerador" type="file" class="hidden" accept=".xlsx,.xlsm,.xls">
            <div id="drop-zone-gerador" class="drop-zone">
              <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
              <p class="font-semibold">Arraste e solte ou clique</p>
              <p class="text-sm text-text-muted mt-1">Formatos: .xlsx, .xlsm, .xls</p>
            </div>
            <p id="file-selected-gerador" class="mt-3 text-sm font-semibold text-success hidden"></p>
          </div>

          <!-- Parâmetros -->
          <div class="card">
            <h2 class="text-xl font-semibold mb-4">2. Parâmetros</h2>
            <div class="space-y-4">
              <div>
                <label for="mes-referencia-gerador" class="block text-sm font-medium mb-1">Mês de Referência</label>
                <input type="month" id="mes-referencia-gerador" class="input">
              </div>
              <div>
                <label for="data-vencimento-gerador" class="block text-sm font-medium mb-1">Data de Vencimento</label>
                <input type="date" id="data-vencimento-gerador" class="input">
              </div>
            </div>
          </div>

          <!-- Botão Processar -->
          <button id="process-btn-gerador" class="w-full btn btn-primary text-lg py-3" disabled>
            <i class="fas fa-cogs mr-2"></i>Processar Relatório
          </button>
        </div>

        <!-- Coluna Direita: Resultados -->
        <div class="lg:col-span-3 card">
          <h2 class="text-xl font-semibold mb-4">3. Gerar Faturas</h2>
          
          <!-- Busca -->
          <div id="search-container-gerador" class="relative mb-4 hidden">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3">
              <i class="fas fa-search text-gray-400"></i>
            </span>
            <input type="text" id="search-client-gerador" placeholder="Procurar cliente..." class="input pl-10">
          </div>

          <!-- Lista de Clientes -->
          <div id="result-list-gerador" class="space-y-2 max-h-96 overflow-y-auto">
            <div id="empty-state-gerador" class="text-center text-gray-500 py-10">
              <i class="fas fa-users text-5xl mb-3 text-gray-300"></i>
              <p class="font-semibold">Aguardando processamento</p>
              <p class="text-sm mt-1">Os clientes aparecerão aqui após o processamento</p>
            </div>
          </div>

          <!-- Botão Download All -->
          <div id="download-all-area-gerador" class="mt-4 hidden">
            <button id="download-all-btn-gerador" class="w-full btn bg-gray-700 text-white hover:bg-gray-900 py-2">
              <i class="fas fa-file-archive mr-2"></i>Baixar Todas (ZIP)
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
  const fileUpload = document.getElementById('file-upload-gerador');
  const dropZone = document.getElementById('drop-zone-gerador');
  const fileSelectedEl = document.getElementById('file-selected-gerador');
  const mesReferenciaEl = document.getElementById('mes-referencia-gerador');
  const dataVencimentoEl = document.getElementById('data-vencimento-gerador');
  const processBtn = document.getElementById('process-btn-gerador');
  const searchInput = document.getElementById('search-client-gerador');
  const downloadAllBtn = document.getElementById('download-all-btn-gerador');

  if (!fileUpload || !dropZone) return;

  // Upload de arquivo
  dropZone.addEventListener('click', () => fileUpload.click());
  fileUpload.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

  // Drag and drop
  ['dragenter', 'dragover'].forEach(evName => {
    dropZone.addEventListener(evName, (e) => {
      e.preventDefault();
      dropZone.classList.add('drop-active');
    });
  });

  ['dragleave', 'drop'].forEach(evName => {
    dropZone.addEventListener(evName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-active');
    });
  });

  dropZone.addEventListener('drop', (e) => handleFileSelect(e.dataTransfer.files[0]));

  // Validação de formulário
  [mesReferenciaEl, dataVencimentoEl].forEach(el => {
    if (el) el.addEventListener('change', validateForm);
  });

  // Processar
  if (processBtn) {
    processBtn.addEventListener('click', handleProcess);
  }

  // Busca
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }

  // Download all
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', handleDownloadAll);
  }

  // Inicializar Pyodide
  initPyodide();
}

let isPyodideReady = false;

/**
 * Inicializa Pyodide
 */
async function initPyodide() {
  try {
    const loadingStatus = document.getElementById('loading-status');
    if (loadingStatus) loadingStatus.textContent = 'Carregando motor de processamento...';

    await excelProcessor.init((status) => {
      if (loadingStatus) loadingStatus.textContent = status;
    });

    isPyodideReady = true;
    validateForm(); // Revalidar formulário agora que o Pyodide está pronto

    notification.info('Sistema de processamento pronto!');
  } catch (error) {
    console.error('Erro ao inicializar Pyodide:', error);
    notification.error('Falha ao carregar motor de processamento.');
  }
}

/**
 * Manipula seleção de arquivo
 */
function handleFileSelect(file) {
  const validation = validateFile(file);

  if (!validation.valid) {
    notification.error(validation.error);
    return;
  }

  selectedFile = file;
  const fileSelectedEl = document.getElementById('file-selected-gerador');
  if (fileSelectedEl) {
    fileSelectedEl.classList.remove('hidden');
    fileSelectedEl.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
  }

  validateForm();
}

/**
 * Valida formulário
 */
function validateForm() {
  const mesReferenciaEl = document.getElementById('mes-referencia-gerador');
  const dataVencimentoEl = document.getElementById('data-vencimento-gerador');
  const processBtn = document.getElementById('process-btn-gerador');

  if (!processBtn) return;

  const isReady = selectedFile &&
    mesReferenciaEl?.value &&
    dataVencimentoEl?.value &&
    isPyodideReady;

  processBtn.disabled = !isReady;
  processBtn.classList.toggle('opacity-50', !isReady);

  if (!isPyodideReady && selectedFile) {
    processBtn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div> Carregando sistema...';
  } else if (isReady) {
    processBtn.innerHTML = '<i class="fas fa-cogs mr-2"></i>Processar Relatório';
  }
}

/**
 * Processa relatório
 */
async function handleProcess() {
  const mesReferenciaEl = document.getElementById('mes-referencia-gerador');
  const dataVencimentoEl = document.getElementById('data-vencimento-gerador');
  const processBtn = document.getElementById('process-btn-gerador');

  if (!selectedFile || !mesReferenciaEl || !dataVencimentoEl) return;

  try {
    // Desabilitar botão
    processBtn.disabled = true;
    processBtn.innerHTML = '<div class="loader"></div> Processando...';

    // Processar
    clientData = await excelProcessor.processFile(
      selectedFile,
      mesReferenciaEl.value,
      dataVencimentoEl.value
    );

    // Renderizar lista
    renderClientList(clientData);

    // Mostrar busca e download all
    document.getElementById('search-container-gerador')?.classList.remove('hidden');
    document.getElementById('download-all-area-gerador')?.classList.remove('hidden');
    document.getElementById('empty-state-gerador')?.classList.add('hidden');

    notification.success(`${clientData.length} clientes processados com sucesso!`);

  } catch (error) {
    notification.error(error.message || 'Erro ao processar arquivo');
    console.error(error);
  } finally {
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="fas fa-cogs mr-2"></i>Processar Relatório';
    validateForm();
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
    resultList.innerHTML = '<p class="text-center text-gray-500 py-8">Nenhum cliente encontrado</p>';
    return;
  }

  clients.forEach(client => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors';
    div.innerHTML = `
      <div>
        <p class="font-medium">${client.nome}</p>
        <p class="text-sm text-text-muted">Instalação: ${client.instalacao}</p>
      </div>
      <button class="btn btn-primary btn-sm generate-pdf-btn" data-instalacao="${client.instalacao}">
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
  const client = clientData.find(c => String(c.instalacao) === String(instalacao));
  if (!client) return;

  const mesReferenciaEl = document.getElementById('mes-referencia-gerador');
  if (!mesReferenciaEl) return;

  const btn = document.querySelector(`[data-instalacao="${instalacao}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div>';
  }

  try {
    const { blob, filename } = await pdfGenerator.generatePDF(client, mesReferenciaEl.value);

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
  const query = normalizeString(e.target.value);
  const filtered = clientData.filter(c =>
    normalizeString(c.nome).includes(query) ||
    normalizeString(c.instalacao).includes(query)
  );
  renderClientList(filtered);
}

/**
 * Download de todas as faturas em ZIP
 */
async function handleDownloadAll() {
  const mesReferenciaEl = document.getElementById('mes-referencia-gerador');
  if (!mesReferenciaEl || clientData.length === 0) return;

  try {
    progressBar.show('Gerando PDFs...', '');

    const zipBlob = await pdfGenerator.generateZIP(
      clientData,
      mesReferenciaEl.value,
      (current, total) => {
        progressBar.setProgress(current, total, 'Gerando PDFs...');
      }
    );

    progressBar.hide();

    // Download ZIP
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Faturas_${mesReferenciaEl.value}.zip`;
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
