// src/modules/processador/index.js
import excelProcessor from '../../core/excelProcessor.js';
import stateManager from '../../core/StateManager.js'; // Importar StateManager
import { FileStatus } from '../../components/FileStatus.js'; // Importar UI de Status
import { validateFile } from '../../core/validators.js';
import { formatCurrency } from '../../core/formatters.js';
import notification from '../../components/Notification.js';

// Não precisamos mais de variáveis globais locais como processedData ou selectedFile
// Usaremos stateManager.getState()

export async function renderProcessador() {
  // Adicionamos uma div id="global-file-status" no topo
  return `
    <div class="main-grid">
      <div id="global-file-status" class="hidden col-span-full mb-4"></div>

      <div class="left-panel">
        <div id="upload-card-processador">
          <h2 class="text-xl font-semibold mb-4">1. Carregar Planilha</h2>
          <input id="file-upload-processador" type="file" class="hidden" accept=".xlsx,.xlsm,.xls">
          <div id="drop-zone-processador" class="drop-zone">
            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
            <p class="font-semibold">Arraste e solte ou clique</p>
            <p class="text-sm text-text-muted mt-1">Formatos: .xlsx, .xlsm, .xls</p>
          </div>
        </div>

        <div class="mt-6">
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

        <button id="process-btn-processador" class="w-full btn btn-primary text-lg py-3 mt-6" disabled>
          <i class="fas fa-cogs mr-2"></i>Processar Planilha
        </button>
      </div>

      <div class="right-panel" id="result-container-processador">
        <h2 class="text-xl font-semibold mb-4">3. Resultados</h2>
        
        <div id="empty-state-processador" class="text-center text-gray-500 py-20">
          <i class="fas fa-table text-6xl mb-4 text-gray-300"></i>
          <p class="font-semibold text-lg">Aguardando dados</p>
          <p class="text-sm mt-2">Carregue uma planilha e clique em processar</p>
        </div>

        <div id="stats-container-processador" class="hidden grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="card bg-primary/5 border-primary/20 text-center">
                <div id="stat-total" class="text-3xl font-bold text-primary mb-1">0</div>
                <div class="text-sm text-text-muted">Total de Clientes</div>
            </div>
            </div>

        <div id="table-container-processador" class="hidden overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="bg-gray-100 border-b-2 border-gray-300">
                <th class="text-left p-3 font-semibold">Cliente</th>
                <th class="text-left p-3 font-semibold">Instalação</th>
                <th class="text-right p-3 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody id="table-body-processador"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function initProcessador() {
  // ... Seleção de elementos DOM ...
  const fileUpload = document.getElementById('file-upload-processador');
  const dropZone = document.getElementById('drop-zone-processador');
  const processBtn = document.getElementById('process-btn-processador');

  // Inicializar componente de Status Global
  // Precisamos instanciar passando o ID do container que acabamos de criar no HTML
  const statusComponent = new FileStatus('global-file-status');

  // Se inscrever para atualizações de estado para atualizar a UI local
  stateManager.subscribe((state, action) => {
    updateLocalUI(state);
  });

  // Manipular Upload com verificação de Reset
  const handleUpload = (file) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      notification.error(validation.error);
      return;
    }

    // Lógica de confirmação de troca de arquivo
    const proceed = () => {
      stateManager.setFile(file);
      // Limpa o input file para permitir selecionar o mesmo arquivo novamente se necessário
      fileUpload.value = '';
    };

    if (stateManager.hasFile()) {
      // Se já tem arquivo, fileStatus.requestFileChange gerencia o confirm e o reset
      // Se retornar true, o usuário confirmou (ou lógica interna tratou)
      if (confirm('Carregar um novo arquivo apagará os dados atuais. Continuar?')) {
        stateManager.reset();
        proceed();
      }
    } else {
      proceed();
    }
  };

  dropZone?.addEventListener('click', () => fileUpload.click());
  fileUpload?.addEventListener('change', (e) => e.target.files[0] && handleUpload(e.target.files[0]));

  // Drag and drop events... (mesma lógica, chamando handleUpload)

  // Processar
  processBtn?.addEventListener('click', handleProcess);

  // Inicializa UI com estado atual (caso o usuário tenha vindo de outra aba)
  updateLocalUI(stateManager.getState());

  // Inicializar Pyodide (mantém igual)
  initPyodideForProcessador();
}

/**
 * Atualiza a UI local baseada no estado global
 */
function updateLocalUI(state) {
  const processBtn = document.getElementById('process-btn-processador');
  const uploadCard = document.getElementById('upload-card-processador');
  const dropZone = document.getElementById('drop-zone-processador');

  // Se temos arquivo, o botão de processar pode ser habilitado (se datas estiverem ok)
  // Se já temos dados processados, mostramos a tabela

  if (state.file) {
    // Arquivo carregado: muda estilo da dropzone
    dropZone.classList.add('border-success', 'bg-green-50');
    dropZone.innerHTML = `
            <i class="fas fa-check-circle text-4xl text-success mb-2"></i>
            <p class="font-semibold text-success">Arquivo Carregado</p>
            <p class="text-xs text-text-muted">Clique para substituir</p>
        `;
  } else {
    // Sem arquivo: estilo padrão
    dropZone.classList.remove('border-success', 'bg-green-50');
    dropZone.innerHTML = `
            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-2"></i>
            <p class="font-semibold">Arraste e solte ou clique</p>
            <p class="text-sm text-text-muted mt-1">Formatos: .xlsx, .xlsm, .xls</p>
        `;
  }

  if (state.processedData.length > 0) {
    renderResults(state.processedData);
    document.getElementById('empty-state-processador').classList.add('hidden');
    document.getElementById('table-container-processador').classList.remove('hidden');
    document.getElementById('stats-container-processador').classList.remove('hidden');
  } else {
    document.getElementById('empty-state-processador').classList.remove('hidden');
    document.getElementById('table-container-processador').classList.add('hidden');
    document.getElementById('stats-container-processador').classList.add('hidden');
  }

  validateForm(); // Revalida botão de processar
}

async function handleProcess() {
  const state = stateManager.getState();
  const mesRef = document.getElementById('mes-referencia-processador').value;
  const dataVenc = document.getElementById('data-vencimento-processador').value;

  if (!state.file) {
    notification.error("Nenhum arquivo carregado.");
    return;
  }

  try {
    const btn = document.getElementById('process-btn-processador');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div> Processando...';

    // Atualiza params no estado global
    stateManager.setParams({ mesReferencia: mesRef, dataVencimento: dataVenc });

    // Processa
    const data = await excelProcessor.processFile(state.file, mesRef, dataVenc);

    // Salva resultado no estado global (isso vai disparar updateLocalUI via subscribe)
    stateManager.setProcessedData(data);

    notification.success("Processamento concluído!");
  } catch (e) {
    notification.error(e.message);
  } finally {
    // Reset botão (será tratado pelo updateLocalUI, mas por segurança)
    validateForm();
  }
}

// ... Resto das funções (validateForm, renderResults) ...