/**
 * Módulo Corretor de Faturas - Refatorado com StateManager
 * Agora edita dados diretamente da memória global
 */

import stateManager from '../../core/StateManager.js';
import fileStatus from '../../components/FileStatus.js';
import { pdfGenerator } from '../../core/pdfGenerator.js';
import { formatCurrency, formatNumber, normalizeString } from '../../core/formatters.js';
import notification from '../../components/Notification.js';

// Variável local apenas para cliente em edição
let currentEditingClient = null;
let displayedClients = [];

/**
 * Renderiza a interface do corretor
 */
export async function renderCorretor() {
  return `
    <div class="main-grid">
      <!-- File Status Global -->
      <div id="corretor-file-status" class="col-span-full hidden"></div>

      <!-- Left Panel: Controles -->
      <div class="left-panel">
        
        <!-- No Data State -->
        <div id="corretor-no-file" class="panel-card text-center py-8">
          <i class="fas fa-exclamation-circle text-3xl text-gray-300 mb-2"></i>
          <p class="font-medium text-gray-600">Nenhum dado carregado</p>
          <p class="text-sm text-text-muted mt-2">Vá para a aba <strong>Processador</strong> ou <strong>Gerador</strong> para carregar dados.</p>
        </div>

        <!-- Tools Panel -->
        <div id="corretor-tools" class="panel-card hidden">
          <h2 class="section-title">Filtrar Clientes</h2>
          <div class="relative">
            <input type="text" id="search-client-corretor" placeholder="Buscar por nome ou instalação..." class="input pl-9">
            <i class="fas fa-search absolute left-3 top-3.5 text-gray-400"></i>
          </div>
          
          <div class="mt-4 pt-4 border-t border-gray-100">
            <p class="text-xs font-semibold text-gray-500 mb-2 uppercase">Ações Globais</p>
            <button id="export-json-corretor" class="w-full btn btn-secondary text-sm py-2">
              <i class="fas fa-file-code mr-2"></i>Exportar Dados (JSON)
            </button>
          </div>
        </div>

        <!-- Edit Panel Placeholder -->
        <div id="edit-panel-placeholder" class="panel-card bg-gray-50 border-dashed text-center py-10 hidden md:block">
          <i class="fas fa-hand-pointer text-3xl text-gray-300 mb-2"></i>
          <p class="text-gray-400 text-sm">Selecione um cliente na lista à direita para editar</p>
        </div>
      </div>

      <!-- Right Panel: Lista de Clientes -->
      <div class="right-panel">
        <div class="panel-card min-h-[500px]">
          <div class="flex justify-between items-center mb-4">
            <h2 class="section-title mb-0">Clientes Processados</h2>
            <span id="client-count-badge" class="bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1 rounded-full">0</span>
          </div>

          <!-- Lista de Clientes -->
          <div id="clients-list-corretor" class="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            <div id="empty-state-corretor" class="text-center text-gray-500 py-20 flex flex-col items-center">
              <div class="bg-gray-50 p-6 rounded-full mb-4">
                <i class="fas fa-users text-4xl text-gray-300"></i>
              </div>
              <p class="font-medium">Nenhum cliente disponível</p>
              <p class="text-sm mt-1 max-w-xs">Processe dados no Processador ou Gerador primeiro.</p>
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
 * Inicializa eventos do módulo corretor
 */
export function initCorretor() {
  // Inicializa componente de status global
  new fileStatus.constructor('corretor-file-status');

  const searchInput = document.getElementById('search-client-corretor');
  const exportBtn = document.getElementById('export-json-corretor');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  const saveEditBtn = document.getElementById('save-edit-btn');

  // Sincronizar com Estado Global
  stateManager.subscribe((state) => {
    updateCorretorUI(state);
  });

  // Inicializa UI com estado atual
  updateCorretorUI(stateManager.getState());

  // Event Listeners
  searchInput?.addEventListener('input', handleSearch);
  exportBtn?.addEventListener('click', handleExportJSON);
  closeModalBtn?.addEventListener('click', closeModal);
  cancelEditBtn?.addEventListener('click', closeModal);
  saveEditBtn?.addEventListener('click', handleSave);

  // Atualizar prévia ao editar campos
  ['edit-comp_qtd', 'edit-tarifa_comp_ev', 'edit-boleto_ev', 'edit-dist_outros'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
  });
}

/**
 * Atualiza UI baseado no estado global
 */
function updateCorretorUI(state) {
  const hasData = state.processedData && state.processedData.length > 0;

  const noFileEl = document.getElementById('corretor-no-file');
  const toolsEl = document.getElementById('corretor-tools');
  const statusEl = document.getElementById('corretor-file-status');
  const placeholderEl = document.getElementById('edit-panel-placeholder');
  const countBadge = document.getElementById('client-count-badge');

  if (hasData) {
    // Mostrar ferramentas e status
    noFileEl?.classList.add('hidden');
    toolsEl?.classList.remove('hidden');
    statusEl?.classList.remove('hidden');
    placeholderEl?.classList.remove('hidden');

    // Atualizar contador
    if (countBadge) {
      countBadge.textContent = state.processedData.length;
    }

    // Renderiza lista usando os dados da memória
    displayedClients = state.processedData;
    renderCorretorList(state.processedData);
  } else {
    // Mostrar estado vazio
    noFileEl?.classList.remove('hidden');
    toolsEl?.classList.add('hidden');
    statusEl?.classList.add('hidden');
    placeholderEl?.classList.add('hidden');

    if (countBadge) {
      countBadge.textContent = '0';
    }

    const listContainer = document.getElementById('clients-list-corretor');
    const emptyState = document.getElementById('empty-state-corretor');
    if (listContainer && emptyState) {
      listContainer.innerHTML = emptyState.outerHTML;
    }
  }
}

/**
 * Renderiza lista de clientes
 */
function renderCorretorList(clients) {
  const container = document.getElementById('clients-list-corretor');
  if (!container) return;

  container.innerHTML = '';

  if (clients.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-500 py-10">
        <i class="fas fa-search text-4xl mb-3 text-gray-300"></i>
        <p class="font-semibold">Nenhum cliente encontrado</p>
      </div>
    `;
    return;
  }

  clients.forEach(client => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer';
    div.innerHTML = `
      <div class="flex-1">
        <p class="font-semibold text-gray-900">${client.nome}</p>
        <p class="text-sm text-gray-600">Instalação: ${client.instalacao}</p>
        ${client.totalPagar ? `<p class="text-sm text-blue-600 font-medium mt-1">${formatCurrency(client.totalPagar)}</p>` : ''}
      </div>
      <button class="btn btn-primary edit-client-btn" data-instalacao="${client.instalacao}">
        <i class="fas fa-edit mr-1"></i>Editar
      </button>
    `;
    container.appendChild(div);
  });

  // Event listeners para botões
  container.querySelectorAll('.edit-client-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(btn.dataset.instalacao);
    });
  });
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
  renderCorretorList(filtered);
}

/**
 * Exporta dados como JSON
 */
function handleExportJSON() {
  const state = stateManager.getState();

  if (!state.processedData || state.processedData.length === 0) {
    notification.error('Nenhum dado para exportar');
    return;
  }

  try {
    const json = JSON.stringify(state.processedData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dados_clientes_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();

    notification.success('JSON exportado com sucesso!');
  } catch (error) {
    notification.error('Erro ao exportar JSON');
    console.error(error);
  }
}

/**
 * Abre modal de edição
 */
function openEditModal(instalacao) {
  const state = stateManager.getState();
  const client = state.processedData.find(c => String(c.instalacao) === String(instalacao));

  if (!client) {
    notification.error('Cliente não encontrado');
    return;
  }

  // Cria cópia profunda para edição
  currentEditingClient = JSON.parse(JSON.stringify(client));

  // Garante que _editor existe
  if (!currentEditingClient._editor) {
    currentEditingClient = recalculateInvoice(currentEditingClient);
  }

  // Preenche modal
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

  // Atualizar no estado global
  const state = stateManager.getState();
  const updatedData = state.processedData.map(c =>
    c.instalacao === finalClientData.instalacao ? finalClientData : c
  );
  stateManager.setProcessedData(updatedData);

  const saveBtn = document.getElementById('save-edit-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div> Gerando...';
  }

  try {
    const mesRef = state.params.mesReferencia || finalClientData.emissao_iso?.substring(0, 7) || '2025-01';
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