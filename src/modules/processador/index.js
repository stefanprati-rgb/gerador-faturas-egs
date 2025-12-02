/**
 * Módulo Processador de Planilhas
 */

import excelProcessor from '../../core/excelProcessor.js';
import { validateFile, validateMonth, validateDate } from '../../core/validators.js';
import { formatCurrency, formatDate } from '../../core/formatters.js';
import notification from '../../components/Notification.js';
import progressBar from '../../components/ProgressBar.js';

let processedData = [];
let selectedFile = null;

/**
 * Renderiza a interface do processador
 */
export async function renderProcessador() {
  return `
    <div class="max-w-6xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">Processador de Planilhas</h1>
        <p class="text-text-muted">Processe e valide dados de planilhas Excel</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Coluna Esquerda: Controles -->
        <div class="lg:col-span-1 space-y-6">
          <!-- Upload de Arquivo -->
          <div class="card">
            <h2 class="text-xl font-semibold mb-4">1. Carregar Planilha</h2>
            <input id="file-upload-processador" type="file" class="hidden" accept=".xlsx,.xlsm,.xls">
            <div id="drop-zone-processador" class="drop-zone">
              <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
              <p class="font-semibold">Arraste e solte ou clique</p>
              <p class="text-sm text-text-muted mt-1">Formatos: .xlsx, .xlsm, .xls</p>
            </div>
            <p id="file-selected-processador" class="mt-3 text-sm font-semibold text-success hidden"></p>
          </div>

          <!-- Parâmetros -->
          <div class="card">
            <h2 class="text-xl font-semibold mb-4">2. Parâmetros</h2>
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
          <button id="process-btn-processador" class="w-full btn btn-primary text-lg py-3" disabled>
            <i class="fas fa-cogs mr-2"></i>Processar Planilha
          </button>
        </div>

        <!-- Coluna Direita: Resultados -->
        <div class="lg:col-span-2 card">
          <h2 class="text-xl font-semibold mb-4">3. Resultados</h2>
          
          <div id="result-container-processador">
            <div id="empty-state-processador" class="text-center text-gray-500 py-20">
              <i class="fas fa-table text-6xl mb-4 text-gray-300"></i>
              <p class="font-semibold text-lg">Aguardando processamento</p>
              <p class="text-sm mt-2">Os resultados aparecerão aqui após o processamento</p>
            </div>

            <!-- Estatísticas -->
            <div id="stats-container-processador" class="hidden grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div class="card bg-primary/5 border-primary/20 text-center">
                <div id="stat-total" class="text-3xl font-bold text-primary mb-1">0</div>
                <div class="text-sm text-text-muted">Total de Clientes</div>
              </div>
              <div class="card bg-success/5 border-success/20 text-center">
                <div id="stat-economia" class="text-2xl font-bold text-success mb-1">R$ 0,00</div>
                <div class="text-sm text-text-muted">Economia Total</div>
              </div>
              <div class="card bg-warning/5 border-warning/20 text-center">
                <div id="stat-co2" class="text-2xl font-bold text-warning mb-1">0 kg</div>
                <div class="text-sm text-text-muted">CO₂ Evitado</div>
              </div>
              <div class="card bg-secondary/5 border-secondary/20 text-center">
                <div id="stat-arvores" class="text-2xl font-bold text-secondary mb-1">0</div>
                <div class="text-sm text-text-muted">Árvores</div>
              </div>
            </div>

            <!-- Tabela de Dados -->
            <div id="table-container-processador" class="hidden overflow-x-auto">
              <p class="text-sm text-gray-500 mb-2 italic">* Mostrando apenas os primeiros 20 registros para visualização rápida.</p>
              <table class="w-full border-collapse">
                <thead>
                  <tr class="bg-gray-100 border-b-2 border-gray-300">
                    <th class="text-left p-3 font-semibold">Cliente</th>
                    <th class="text-left p-3 font-semibold">Instalação</th>
                    <th class="text-right p-3 font-semibold">Economia Mês</th>
                    <th class="text-right p-3 font-semibold">Economia Total</th>
                    <th class="text-right p-3 font-semibold">Total a Pagar</th>
                  </tr>
                </thead>
                <tbody id="table-body-processador">
                </tbody>
              </table>
            </div>

            <!-- Botões de Ação -->
            <div id="actions-container-processador" class="hidden mt-6 flex gap-3 flex-wrap">
              <button id="send-to-corretor-btn" class="btn btn-primary flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                <i class="fas fa-edit mr-2"></i>Corrigir/Editar Faturas
              </button>
              <button id="export-json-btn" class="btn btn-secondary flex-1">
                <i class="fas fa-file-code mr-2"></i>Exportar JSON
              </button>
              <button id="export-csv-btn" class="btn btn-secondary flex-1">
                <i class="fas fa-file-csv mr-2"></i>Exportar CSV
              </button>
            </div>
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
  const fileUpload = document.getElementById('file-upload-processador');
  const dropZone = document.getElementById('drop-zone-processador');
  const mesReferenciaEl = document.getElementById('mes-referencia-processador');
  const dataVencimentoEl = document.getElementById('data-vencimento-processador');
  const processBtn = document.getElementById('process-btn-processador');
  const exportJsonBtn = document.getElementById('export-json-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const sendToCorretorBtn = document.getElementById('send-to-corretor-btn');

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

  // Exportar
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => exportData('json'));
  }
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => exportData('csv'));
  }

  // Enviar para Corretor
  if (sendToCorretorBtn) {
    sendToCorretorBtn.addEventListener('click', sendToCorretor);
  }
}

/**
 * Envia dados para o módulo Corretor
 */
function sendToCorretor() {
  if (processedData.length === 0) {
    notification.warning('Nenhum dado para enviar');
    return;
  }

  try {
    // Salvar no localStorage para persistência entre abas
    localStorage.setItem('egs_data_to_correct', JSON.stringify(processedData));

    // Disparar evento customizado para notificar outros módulos
    window.dispatchEvent(new CustomEvent('egs:dataReady', { detail: processedData }));

    // Tentar mudar para a aba Corretor
    const corretorTabBtn = document.querySelector('button[data-tab="corretor"]');
    if (corretorTabBtn) {
      corretorTabBtn.click();
      notification.success('Dados enviados para o Corretor!');
    } else {
      notification.info('Vá para a aba Corretor para editar os dados.');
    }
  } catch (error) {
    console.error('Erro ao enviar para corretor:', error);
    notification.error('Erro ao transferir dados. Tente exportar JSON.');
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
  const fileSelectedEl = document.getElementById('file-selected-processador');
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
  const mesReferenciaEl = document.getElementById('mes-referencia-processador');
  const dataVencimentoEl = document.getElementById('data-vencimento-processador');
  const processBtn = document.getElementById('process-btn-processador');

  if (!processBtn) return;

  const isReady = selectedFile &&
    mesReferenciaEl?.value &&
    dataVencimentoEl?.value;

  processBtn.disabled = !isReady;
  processBtn.classList.toggle('opacity-50', !isReady);
}

/**
 * Processa planilha
 */
async function handleProcess() {
  const mesReferenciaEl = document.getElementById('mes-referencia-processador');
  const dataVencimentoEl = document.getElementById('data-vencimento-processador');
  const processBtn = document.getElementById('process-btn-processador');

  if (!selectedFile || !mesReferenciaEl || !dataVencimentoEl) return;

  try {
    // Desabilitar botão
    processBtn.disabled = true;
    processBtn.innerHTML = '<div class="loader"></div> Processando...';

    // Processar
    processedData = await excelProcessor.processFile(
      selectedFile,
      mesReferenciaEl.value,
      dataVencimentoEl.value
    );

    // Renderizar resultados
    renderResults(processedData);

    // Mostrar containers
    document.getElementById('empty-state-processador')?.classList.add('hidden');
    document.getElementById('stats-container-processador')?.classList.remove('hidden');
    document.getElementById('table-container-processador')?.classList.remove('hidden');
    document.getElementById('actions-container-processador')?.classList.remove('hidden');

    notification.success(`${processedData.length} registros processados com sucesso!`);

  } catch (error) {
    notification.error(error.message || 'Erro ao processar arquivo');
    console.error(error);
  } finally {
    processBtn.disabled = false;
    processBtn.innerHTML = '<i class="fas fa-cogs mr-2"></i>Processar Planilha';
    validateForm();
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
  document.getElementById('stat-co2').textContent = `${co2Total.toFixed(2)} kg`;
  document.getElementById('stat-arvores').textContent = arvoresTotal.toFixed(0);

  // Tabela - LIMITADA A 20 ITENS
  const tbody = document.getElementById('table-body-processador');
  if (!tbody) return;

  tbody.innerHTML = '';

  const sampleData = data.slice(0, 20); // MOSTRAR APENAS OS PRIMEIROS 20

  sampleData.forEach((client, index) => {
    const tr = document.createElement('tr');
    tr.className = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    tr.innerHTML = `
      <td class="p-3">${client.nome}</td>
      <td class="p-3">${client.instalacao}</td>
      <td class="p-3 text-right font-semibold text-success">${formatCurrency(client.economiaMes)}</td>
      <td class="p-3 text-right font-semibold">${formatCurrency(client.economiaTotal)}</td>
      <td class="p-3 text-right font-semibold text-primary">${formatCurrency(client.totalPagar)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Exporta dados
 */
function exportData(format) {
  if (processedData.length === 0) {
    notification.warning('Nenhum dado para exportar');
    return;
  }

  const mesReferenciaEl = document.getElementById('mes-referencia-processador');
  const mesRef = mesReferenciaEl?.value || 'dados';

  if (format === 'json') {
    const jsonStr = JSON.stringify(processedData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `processamento_${mesRef}.json`);
    notification.success('JSON exportado com sucesso!');
  } else if (format === 'csv') {
    const csv = convertToCSV(processedData);
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
