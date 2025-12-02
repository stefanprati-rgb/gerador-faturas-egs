/**
 * Módulo Corretor de Faturas
 */

import { pdfGenerator } from '../../core/pdfGenerator.js';
import { formatCurrency, formatNumber } from '../../core/formatters.js';
import notification from '../../components/Notification.js';

let clientsData = [];
let currentEditingClient = null;

/**
 * Renderiza a interface do corretor
 */
export async function renderCorretor() {
  return `
    <div class="max-w-6xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">Corretor de Faturas</h1>
        <p class="text-text-muted">Edite e recalcule faturas já processadas</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Coluna Esquerda: Upload -->
        <div class="lg:col-span-1 card">
          <h2 class="text-xl font-semibold mb-4">1. Carregar Dados</h2>
          <p class="text-sm text-text-muted mb-4">
            Carregue um arquivo JSON com dados de clientes processados
          </p>
          <input id="file-upload-corretor" type="file" class="hidden" accept=".json">
          <div id="drop-zone-corretor" class="drop-zone">
            <i class="fas fa-file-code text-4xl text-gray-400 mb-2"></i>
            <p class="font-semibold">Arraste e solte ou clique</p>
            <p class="text-sm text-text-muted mt-1">Formato: .json</p>
          </div>
          <p id="file-selected-corretor" class="mt-3 text-sm font-semibold text-success hidden"></p>

          <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-800">
              <i class="fas fa-info-circle mr-1"></i>
              <strong>Dica:</strong> Use o JSON exportado pelo Processador ou Gerador
            </p>
          </div>
        </div>

        <!-- Coluna Direita: Lista de Clientes -->
        <div class="lg:col-span-2 card">
          <h2 class="text-xl font-semibold mb-4">2. Clientes Carregados</h2>
          
          <!-- Busca -->
          <div id="search-container-corretor" class="relative mb-4 hidden">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3">
              <i class="fas fa-search text-gray-400"></i>
            </span>
            <input type="text" id="search-client-corretor" placeholder="Procurar cliente..." class="input pl-10">
          </div>

          <div id="result-container-corretor">
            <div id="empty-state-corretor" class="text-center text-gray-500 py-20">
              <i class="fas fa-users text-6xl mb-4 text-gray-300"></i>
              <p class="font-semibold text-lg">Nenhum dado carregado</p>
              <p class="text-sm mt-2">Carregue um arquivo JSON para começar</p>
            </div>

            <!-- Lista de Clientes -->
            <div id="clients-list-corretor" class="hidden space-y-2 max-h-96 overflow-y-auto">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Edição -->
    <div id="edit-modal-corretor" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <h3 class="text-2xl font-bold">Editar Fatura</h3>
            <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fas fa-times text-2xl"></i>
            </button>
          </div>
          <p id="modal-client-name" class="text-text-muted mt-1"></p>
        </div>

        <div class="p-6 space-y-6">
          <!-- Campos Editáveis -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Quantidade de Crédito</label>
              <input type="number" id="edit-credito-qtd" class="input" step="0.01">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Tarifa de Referência</label>
              <input type="number" id="edit-credito-tar" class="input" step="0.000001">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Desconto Extra</label>
              <input type="number" id="edit-desconto" class="input" step="0.01" value="0">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Ajuste Retroativo</label>
              <input type="number" id="edit-ajuste" class="input" step="0.01" value="0">
            </div>
          </div>

          <!-- Prévia de Cálculos -->
          <div class="bg-gray-50 rounded-lg p-4 space-y-2">
            <h4 class="font-semibold mb-3">Prévia de Valores</h4>
            <div class="flex justify-between">
              <span class="text-text-muted">Crédito Total:</span>
              <span id="preview-credito" class="font-semibold">R$ 0,00</span>
            </div>
            <div class="flex justify-between">
              <span class="text-text-muted">Desconto Extra:</span>
              <span id="preview-desconto" class="font-semibold text-success">R$ 0,00</span>
            </div>
            <div class="flex justify-between">
              <span class="text-text-muted">Ajuste Retroativo:</span>
              <span id="preview-ajuste" class="font-semibold">R$ 0,00</span>
            </div>
            <div class="border-t border-gray-300 pt-2 mt-2 flex justify-between">
              <span class="font-bold">Total a Pagar:</span>
              <span id="preview-total" class="font-bold text-primary text-lg">R$ 0,00</span>
            </div>
          </div>
        </div>

        <div class="p-6 border-t border-gray-200 flex gap-3">
          <button id="cancel-edit-btn" class="btn btn-secondary flex-1">
            <i class="fas fa-times mr-2"></i>Cancelar
          </button>
          <button id="save-edit-btn" class="btn btn-primary flex-1">
            <i class="fas fa-save mr-2"></i>Salvar e Gerar PDF
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Inicializa eventos do módulo corretor
 */
export function initCorretor() {
  const fileUpload = document.getElementById('file-upload-corretor');
  const dropZone = document.getElementById('drop-zone-corretor');
  const searchInput = document.getElementById('search-client-corretor');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  const saveEditBtn = document.getElementById('save-edit-btn');

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

  // Busca
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }

  // Modal
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeModal);
  if (saveEditBtn) saveEditBtn.addEventListener('click', handleSave);

  // Atualizar prévia ao editar campos
  ['edit-credito-qtd', 'edit-credito-tar', 'edit-desconto', 'edit-ajuste'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
  });

  // Ouvir evento de dados prontos (vindo do Processador)
  window.addEventListener('egs:dataReady', (e) => {
    if (e.detail && Array.isArray(e.detail)) {
      loadFromData(e.detail);
    }
  });

  // Verificar se já existem dados no localStorage ao carregar a aba
  const storedData = localStorage.getItem('egs_data_to_correct');
  if (storedData) {
    try {
      const data = JSON.parse(storedData);
      if (Array.isArray(data) && data.length > 0) {
        loadFromData(data);
        // Opcional: Limpar localStorage após carregar para não recarregar sempre? 
        // Melhor manter por enquanto caso o usuário recarregue a página.
      }
    } catch (e) {
      console.error('Erro ao carregar dados do localStorage', e);
    }
  }
}

/**
 * Carrega dados diretamente (sem upload de arquivo)
 */
function loadFromData(data) {
  clientsData = data;
  renderClientsList(clientsData);

  document.getElementById('empty-state-corretor')?.classList.add('hidden');
  document.getElementById('clients-list-corretor')?.classList.remove('hidden');
  document.getElementById('search-container-corretor')?.classList.remove('hidden');

  const fileSelectedEl = document.getElementById('file-selected-corretor');
  if (fileSelectedEl) {
    fileSelectedEl.classList.remove('hidden');
    fileSelectedEl.textContent = `Dados importados do Processador - ${clientsData.length} clientes`;
    fileSelectedEl.classList.add('text-blue-600');
  }

  notification.success(`${clientsData.length} clientes carregados do Processador!`);
}

/**
 * Manipula seleção de arquivo JSON
 */
async function handleFileSelect(file) {
  if (!file) return;

  if (!file.name.endsWith('.json')) {
    notification.error('Por favor, selecione um arquivo JSON');
    return;
  }

  try {
    const text = await file.text();
    clientsData = JSON.parse(text);

    if (!Array.isArray(clientsData) || clientsData.length === 0) {
      throw new Error('Arquivo JSON inválido ou vazio');
    }

    const fileSelectedEl = document.getElementById('file-selected-corretor');
    if (fileSelectedEl) {
      fileSelectedEl.classList.remove('hidden');
      fileSelectedEl.textContent = `${file.name} - ${clientsData.length} clientes`;
    }

    renderClientsList(clientsData);

    document.getElementById('empty-state-corretor')?.classList.add('hidden');
    document.getElementById('clients-list-corretor')?.classList.remove('hidden');
    document.getElementById('search-container-corretor')?.classList.remove('hidden');

    notification.success(`${clientsData.length} clientes carregados!`);

  } catch (error) {
    notification.error('Erro ao ler arquivo JSON: ' + error.message);
    console.error(error);
  }
}

/**
 * Renderiza lista de clientes
 */
function renderClientsList(clients) {
  const container = document.getElementById('clients-list-corretor');
  if (!container) return;

  container.innerHTML = '';

  clients.forEach(client => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors';
    div.innerHTML = `
      <div>
        <p class="font-medium">${client.nome}</p>
        <p class="text-sm text-text-muted">Instalação: ${client.instalacao} • Total: ${formatCurrency(client.totalPagar)}</p>
      </div>
      <button class="btn btn-primary btn-sm edit-client-btn" data-instalacao="${client.instalacao}">
        <i class="fas fa-edit mr-1"></i>Editar
      </button>
    `;
    container.appendChild(div);
  });

  // Event listeners
  container.querySelectorAll('.edit-client-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.instalacao));
  });
}

/**
 * Busca clientes
 */
function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  const filtered = clientsData.filter(c =>
    c.nome.toLowerCase().includes(query) ||
    c.instalacao.toLowerCase().includes(query)
  );
  renderClientsList(filtered);
}

/**
 * Abre modal de edição
 */
function openEditModal(instalacao) {
  const client = clientsData.find(c => String(c.instalacao) === String(instalacao));
  if (!client) return;

  currentEditingClient = { ...client };

  document.getElementById('modal-client-name').textContent = client.nome;
  document.getElementById('edit-credito-qtd').value = client.det_credito_qtd || 0;
  document.getElementById('edit-credito-tar').value = client.det_credito_tar || 0;
  document.getElementById('edit-desconto').value = 0;
  document.getElementById('edit-ajuste').value = 0;

  updatePreview();

  document.getElementById('edit-modal-corretor')?.classList.remove('hidden');
}

/**
 * Fecha modal
 */
function closeModal() {
  document.getElementById('edit-modal-corretor')?.classList.add('hidden');
  currentEditingClient = null;
}

/**
 * Atualiza prévia de cálculos
 */
function updatePreview() {
  const qtd = parseFloat(document.getElementById('edit-credito-qtd')?.value || 0);
  const tar = parseFloat(document.getElementById('edit-credito-tar')?.value || 0);
  const desconto = parseFloat(document.getElementById('edit-desconto')?.value || 0);
  const ajuste = parseFloat(document.getElementById('edit-ajuste')?.value || 0);

  const credito = qtd * tar;
  const total = credito - desconto + ajuste;

  document.getElementById('preview-credito').textContent = formatCurrency(credito);
  document.getElementById('preview-desconto').textContent = formatCurrency(desconto);
  document.getElementById('preview-ajuste').textContent = formatCurrency(ajuste);
  document.getElementById('preview-total').textContent = formatCurrency(total);
}

/**
 * Salva edição e gera PDF
 */
async function handleSave() {
  if (!currentEditingClient) return;

  const qtd = parseFloat(document.getElementById('edit-credito-qtd')?.value || 0);
  const tar = parseFloat(document.getElementById('edit-credito-tar')?.value || 0);
  const desconto = parseFloat(document.getElementById('edit-desconto')?.value || 0);
  const ajuste = parseFloat(document.getElementById('edit-ajuste')?.value || 0);

  // Atualizar dados do cliente
  currentEditingClient.det_credito_qtd = qtd;
  currentEditingClient.det_credito_tar = tar;
  currentEditingClient.det_credito_total = qtd * tar - desconto + ajuste;
  currentEditingClient.totalPagar = currentEditingClient.det_credito_total;

  const saveBtn = document.getElementById('save-edit-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div> Gerando...';
  }

  try {
    // Gerar PDF com dados atualizados
    const mesRef = currentEditingClient.emissao_iso?.substring(0, 7) || '2025-01';
    const { blob, filename } = await pdfGenerator.generatePDF(currentEditingClient, mesRef);

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();

    // Atualizar cliente na lista
    const index = clientsData.findIndex(c => c.instalacao === currentEditingClient.instalacao);
    if (index !== -1) {
      clientsData[index] = currentEditingClient;
      renderClientsList(clientsData);
    }

    notification.success('PDF gerado com sucesso!');
    closeModal();

  } catch (error) {
    notification.error('Erro ao gerar PDF');
    console.error(error);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Salvar e Gerar PDF';
    }
  }
}
