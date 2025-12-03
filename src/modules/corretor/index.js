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
      <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <h3 class="text-2xl font-bold">Editar Fatura</h3>
            <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fas fa-times text-2xl"></i>
            </button>
          </div>
          <p id="modal-client-name" class="text-text-muted mt-1"></p>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Coluna Esquerda: Inputs -->
            <div class="space-y-4 p-4 border border-gray-200 rounded-lg">
              <h4 class="font-semibold text-gray-700 border-b pb-2">Valores Editáveis</h4>
              
              <div>
                <label class="block text-sm font-medium mb-1">Crédito Consumido (kWh)</label>
                <input type="number" id="edit-comp_qtd" class="input" step="0.01">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Tarifa de Referência EGS (R$)</label>
                <input type="number" id="edit-tarifa_comp_ev" class="input" step="0.000001">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Boleto Fixo (R$)</label>
                <input type="number" id="edit-boleto_ev" class="input" step="0.01">
                <p class="text-xs text-gray-500 mt-1">Deixe 0 para usar a tarifa × quantidade</p>
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Outros Custos Distribuidora (R$)</label>
                <input type="number" id="edit-dist_outros" class="input" step="0.01">
              </div>
            </div>

            <!-- Coluna Direita: Resultados -->
            <div class="space-y-3 p-4 bg-gray-50 rounded-lg">
              <h4 class="font-semibold text-gray-700 border-b pb-2">Resultados Recalculados</h4>
              
              <div class="text-sm flex justify-between">
                <strong>Contribuição EGS:</strong>
                <span id="res-total_contribuicao" class="font-semibold text-primary">R$ 0,00</span>
              </div>
              
              <div class="text-sm flex justify-between">
                <strong>Fatura Distribuidora:</strong>
                <span id="res-total_distribuidora" class="font-semibold">R$ 0,00</span>
              </div>
              
              <hr class="my-2">
              
              <div class="text-lg font-bold flex justify-between">
                TOTAL A PAGAR:
                <span id="res-total_com_gd" class="text-primary">R$ 0,00</span>
              </div>
              
              <div class="text-sm text-gray-600 flex justify-between">
                Sem GD seria:
                <span id="res-total_sem_gd">R$ 0,00</span>
              </div>
              
              <div class="text-lg font-bold text-green-600 bg-green-100 p-3 rounded-md text-center">
                ECONOMIA: <span id="res-economia_mes">R$ 0,00</span>
              </div>
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
 * Recalcula fatura com base nos valores editados
 */
function recalculateInvoice(client) {
  const d = { ...client };

  // Inicializa _editor se não existir
  if (!d._editor) {
    const consumo_total_val = d.dist_consumo_qtd * d.dist_consumo_tar;
    const comp_total_val_dist = d.det_credito_qtd * d.dist_comp_tar;
    const dist_outros_inicial = Math.max(0, d.dist_total - (consumo_total_val - comp_total_val_dist));

    d._editor = {
      comp_qtd: d.det_credito_qtd || 0,
      tarifa_comp_ev: d.det_credito_tar || 0,
      boleto_ev: 0,
      dist_outros: parseFloat(dist_outros_inicial.toFixed(2))
    };
  }

  const editor = d._editor;
  const comp_qtd = editor.comp_qtd;
  const consumo_qtd = d.dist_consumo_qtd;
  const tarifa_cons = d.dist_consumo_tar;
  const tarifa_comp_dist = d.dist_comp_tar;

  // Cálculo da contribuição EGS
  let det_credito_total, det_credito_tar;
  if (editor.boleto_ev > 0) {
    det_credito_total = editor.boleto_ev;
    det_credito_tar = (comp_qtd > 0) ? editor.boleto_ev / comp_qtd : 0;
  } else {
    det_credito_total = comp_qtd * editor.tarifa_comp_ev;
    det_credito_tar = editor.tarifa_comp_ev;
  }

  // Cálculo da distribuidora
  const consumo_total_val = consumo_qtd * tarifa_cons;
  const comp_total_val_dist = comp_qtd * tarifa_comp_dist;
  const dist_total = consumo_total_val - comp_total_val_dist + editor.dist_outros;

  // Economia
  const econ_total_com = dist_total + det_credito_total;
  const econ_total_sem = consumo_total_val + editor.dist_outros;
  const economiaMes = Math.max(0, econ_total_sem - econ_total_com);

  // Impactos ambientais
  const co2_kg = comp_qtd * 0.07;
  const arvores = (co2_kg / 1000.0) * 8;

  return {
    ...d,
    totalPagar: det_credito_total,
    economiaMes: economiaMes,
    co2Evitado: co2_kg,
    arvoresEquivalentes: arvores,
    det_credito_qtd: comp_qtd,
    det_credito_tar: det_credito_tar,
    det_credito_total: det_credito_total,
    dist_consumo_qtd: consumo_qtd,
    dist_consumo_tar: tarifa_cons,
    dist_consumo_total: consumo_total_val,
    dist_comp_qtd: comp_qtd,
    dist_comp_tar: tarifa_comp_dist,
    dist_comp_total: -comp_total_val_dist,
    dist_outros: editor.dist_outros,
    dist_total: dist_total,
    econ_total_sem: econ_total_sem,
    econ_total_com: econ_total_com,
    economiaTotal: d.economiaTotal || economiaMes
  };
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
  ['edit-comp_qtd', 'edit-tarifa_comp_ev', 'edit-boleto_ev', 'edit-dist_outros'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
  });

  // Ouvir evento de dados prontos
  window.addEventListener('egs:dataReady', (e) => {
    if (e.detail && Array.isArray(e.detail)) {
      loadFromData(e.detail);
    }
  });

  // Verificar localStorage
  const storedData = localStorage.getItem('egs_data_to_correct');
  if (storedData) {
    try {
      const data = JSON.parse(storedData);
      if (Array.isArray(data) && data.length > 0) {
        loadFromData(data);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do localStorage', e);
    }
  }
}

/**
 * Carrega dados diretamente
 */
function loadFromData(data) {
  clientsData = data.map(client => recalculateInvoice(client));
  renderClientsList(clientsData);

  document.getElementById('empty-state-corretor')?.classList.add('hidden');
  document.getElementById('clients-list-corretor')?.classList.remove('hidden');
  document.getElementById('search-container-corretor')?.classList.remove('hidden');

  const fileSelectedEl = document.getElementById('file-selected-corretor');
  if (fileSelectedEl) {
    fileSelectedEl.classList.remove('hidden');
    fileSelectedEl.textContent = `Dados importados - ${clientsData.length} clientes`;
  }

  notification.success(`${clientsData.length} clientes carregados!`);
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
    const data = JSON.parse(text);

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Arquivo JSON inválido ou vazio');
    }

    loadFromData(data);

    const fileSelectedEl = document.getElementById('file-selected-corretor');
    if (fileSelectedEl) {
      fileSelectedEl.classList.remove('hidden');
      fileSelectedEl.textContent = `${file.name} - ${data.length} clientes`;
    }

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

  currentEditingClient = JSON.parse(JSON.stringify(client));

  // Garante que _editor existe
  if (!currentEditingClient._editor) {
    currentEditingClient = recalculateInvoice(currentEditingClient);
  }

  document.getElementById('modal-client-name').textContent = `${currentEditingClient.nome} (${currentEditingClient.instalacao})`;
  document.getElementById('edit-comp_qtd').value = currentEditingClient._editor.comp_qtd;
  document.getElementById('edit-tarifa_comp_ev').value = currentEditingClient._editor.tarifa_comp_ev;
  document.getElementById('edit-boleto_ev').value = currentEditingClient._editor.boleto_ev;
  document.getElementById('edit-dist_outros').value = currentEditingClient._editor.dist_outros;

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
  if (!currentEditingClient) return;

  currentEditingClient._editor = {
    comp_qtd: parseFloat(document.getElementById('edit-comp_qtd')?.value || 0),
    tarifa_comp_ev: parseFloat(document.getElementById('edit-tarifa_comp_ev')?.value || 0),
    boleto_ev: parseFloat(document.getElementById('edit-boleto_ev')?.value || 0),
    dist_outros: parseFloat(document.getElementById('edit-dist_outros')?.value || 0),
  };

  const recalculated = recalculateInvoice(currentEditingClient);

  document.getElementById('res-total_contribuicao').textContent = formatCurrency(recalculated.totalPagar);
  document.getElementById('res-total_distribuidora').textContent = formatCurrency(recalculated.dist_total);
  document.getElementById('res-total_com_gd').textContent = formatCurrency(recalculated.econ_total_com);
  document.getElementById('res-total_sem_gd').textContent = formatCurrency(recalculated.econ_total_sem);
  document.getElementById('res-economia_mes').textContent = formatCurrency(recalculated.economiaMes);
}

/**
 * Salva edição e gera PDF
 */
async function handleSave() {
  if (!currentEditingClient) return;

  currentEditingClient._editor = {
    comp_qtd: parseFloat(document.getElementById('edit-comp_qtd')?.value || 0),
    tarifa_comp_ev: parseFloat(document.getElementById('edit-tarifa_comp_ev')?.value || 0),
    boleto_ev: parseFloat(document.getElementById('edit-boleto_ev')?.value || 0),
    dist_outros: parseFloat(document.getElementById('edit-dist_outros')?.value || 0),
  };

  const finalClientData = recalculateInvoice(currentEditingClient);

  // Atualizar na lista
  const index = clientsData.findIndex(c => c.instalacao === finalClientData.instalacao);
  if (index !== -1) {
    clientsData[index] = finalClientData;
  }

  renderClientsList(clientsData);

  const saveBtn = document.getElementById('save-edit-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div> Gerando...';
  }

  try {
    const mesRef = finalClientData.emissao_iso?.substring(0, 7) || '2025-01';
    const { blob, filename } = await pdfGenerator.generatePDF(finalClientData, mesRef);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    notification.success('Fatura corrigida e PDF gerado!');
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