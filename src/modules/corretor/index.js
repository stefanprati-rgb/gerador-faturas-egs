import stateManager from '../../core/StateManager.js';
import { FileStatus } from '../../components/FileStatus.js';
import { pdfGenerator } from '../../core/pdfGenerator.js';
import { formatCurrency, normalizeString } from '../../core/formatters.js';
import notification from '../../components/Notification.js';

let currentEditingClient = null;
let displayedClients = [];

export async function renderCorretor() {
  return `
    <div class="main-grid">
      <div id="corretor-file-status" class="col-span-full hidden"></div>

      <div class="left-panel">
        
        <div id="corretor-no-file" class="panel-card text-center py-8">
          <i class="fas fa-exclamation-circle text-4xl text-gray-300 mb-2"></i>
          <p class="font-medium text-gray-600">Nenhum dado carregado</p>
          <p class="text-sm text-text-muted mt-2">Vá para a aba <strong>Processador</strong> ou <strong>Gerador</strong> para carregar dados.</p>
        </div>

        <div id="corretor-tools" class="panel-card hidden">
          <h2 class="section-title">Filtrar Clientes</h2>
          <div class="relative">
            <input type="text" id="search-client-corretor" placeholder="Buscar por nome ou instalação..." class="input pl-9">
            <i class="fas fa-search absolute left-3 top-3.5 text-gray-400"></i>
          </div>
          
          <div class="mt-6 pt-6 border-t border-gray-100">
            <p class="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Ações Globais</p>
            <button id="export-json-corretor" class="w-full btn btn-secondary text-sm py-2 justify-start">
              <i class="fas fa-file-code mr-2 text-gray-500"></i>Exportar Dados (JSON)
            </button>
          </div>
        </div>

        <div id="edit-panel-placeholder" class="panel-card bg-gray-50 border-dashed text-center py-10 hidden md:block">
          <p class="text-gray-400 text-sm">Selecione um cliente na lista à direita para editar</p>
        </div>
      </div>

      <div class="right-panel">
        <div class="panel-card min-h-[500px]">
          <div class="flex justify-between items-center mb-4">
            <h2 class="section-title mb-0">Clientes Carregados</h2>
            <span id="client-count-badge" class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">0</span>
          </div>

          <div id="clients-list-corretor" class="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            </div>
        </div>
      </div>
    </div>

    <div id="edit-modal-corretor" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto transform scale-95 transition-transform duration-300">
        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 class="text-xl font-bold text-gray-900">Editar Fatura</h3>
            <p id="modal-client-name" class="text-sm text-gray-500 mt-1">Carregando...</p>
          </div>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="space-y-5">
              <h4 class="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-2">Parâmetros Editáveis</h4>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Crédito Consumido (kWh)</label>
                <input type="number" id="edit-comp_qtd" class="input" step="0.01">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tarifa EGS (R$)</label>
                <input type="number" id="edit-tarifa_comp_ev" class="input" step="0.000001">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Boleto Fixo (R$)</label>
                <div class="relative">
                    <input type="number" id="edit-boleto_ev" class="input pl-8" step="0.01">
                    <span class="absolute left-3 top-3 text-gray-400 text-sm">R$</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Deixe 0 para calcular (Tarifa × kWh)</p>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Outros Custos Distrib. (R$)</label>
                <input type="number" id="edit-dist_outros" class="input" step="0.01">
              </div>
            </div>

            <div class="bg-gray-50 rounded-xl p-5 border border-gray-100 flex flex-col justify-center space-y-4">
              <h4 class="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-2 mb-2">Simulação</h4>
              
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Contribuição EGS</span>
                <span id="res-total_contribuicao" class="font-medium text-gray-900">R$ 0,00</span>
              </div>
              
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">Fatura Distribuidora</span>
                <span id="res-total_distribuidora" class="font-medium text-gray-900">R$ 0,00</span>
              </div>
              
              <div class="pt-3 border-t border-gray-200">
                <div class="flex justify-between items-end mb-1">
                  <span class="text-sm font-bold text-gray-900">TOTAL A PAGAR</span>
                  <span id="res-total_com_gd" class="text-xl font-bold text-apple-blue">R$ 0,00</span>
                </div>
                <div class="flex justify-between text-xs text-gray-500">
                  <span>Sem EGS seria:</span>
                  <span id="res-total_sem_gd">R$ 0,00</span>
                </div>
              </div>
              
              <div class="bg-green-50 text-green-700 p-3 rounded-lg flex justify-between items-center font-bold border border-green-100">
                <span>ECONOMIA</span>
                <span id="res-economia_mes">R$ 0,00</span>
              </div>
            </div>
          </div>
        </div>

        <div class="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 rounded-b-2xl">
          <button id="cancel-edit-btn" class="btn btn-secondary px-6">Cancelar</button>
          <button id="save-edit-btn" class="btn btn-primary px-6 shadow-lg hover:shadow-xl">
            <i class="fas fa-save mr-2"></i>Salvar e Gerar PDF
          </button>
        </div>
      </div>
    </div>
  `;
}

export function initCorretor() {
  new FileStatus('corretor-file-status');

  const searchInput = document.getElementById('search-client-corretor');
  const exportBtn = document.getElementById('export-json-corretor');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  const saveEditBtn = document.getElementById('save-edit-btn');

  stateManager.subscribe((state) => updateCorretorUI(state));
  updateCorretorUI(stateManager.getState());

  searchInput?.addEventListener('input', handleSearch);
  exportBtn?.addEventListener('click', handleExportJSON);

  [closeModalBtn, cancelEditBtn].forEach(btn => btn?.addEventListener('click', closeModal));
  saveEditBtn?.addEventListener('click', handleSave);

  ['edit-comp_qtd', 'edit-tarifa_comp_ev', 'edit-boleto_ev', 'edit-dist_outros'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePreview);
  });
}

function updateCorretorUI(state) {
  // PROTEÇÃO CONTRA CRASH
  const noFileEl = document.getElementById('corretor-no-file');
  if (!noFileEl) return;

  const hasData = state.processedData && state.processedData.length > 0;

  const toolsEl = document.getElementById('corretor-tools');
  const statusEl = document.getElementById('corretor-file-status');
  const placeholderEl = document.getElementById('edit-panel-placeholder');
  const countBadge = document.getElementById('client-count-badge');

  if (statusEl) statusEl.classList.remove('hidden');

  if (hasData) {
    noFileEl.classList.add('hidden');
    toolsEl?.classList.remove('hidden');
    placeholderEl?.classList.remove('hidden');

    if (countBadge) countBadge.textContent = state.processedData.length;

    displayedClients = state.processedData;
    renderCorretorList(state.processedData);
  } else {
    noFileEl.classList.remove('hidden');
    toolsEl?.classList.add('hidden');
    placeholderEl?.classList.add('hidden');

    if (countBadge) countBadge.textContent = '0';

    const listContainer = document.getElementById('clients-list-corretor');
    if (listContainer) listContainer.innerHTML = '';
  }
}

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
    div.className = 'flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group';
    div.innerHTML = `
      <div class="flex-1">
        <p class="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">${client.nome}</p>
        <p class="text-sm text-gray-500">Instalação: <span class="font-mono text-xs">${client.instalacao}</span></p>
        ${client.totalPagar ? `<p class="text-sm text-blue-600 font-medium mt-1">${formatCurrency(client.totalPagar)}</p>` : ''}
      </div>
      <button class="btn btn-secondary text-xs px-4 py-2 edit-client-btn hover:bg-blue-50 hover:text-blue-600" data-instalacao="${client.instalacao}">
        <i class="fas fa-edit mr-2"></i>Editar
      </button>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll('.edit-client-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(btn.dataset.instalacao);
    });
  });
}

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

function handleExportJSON() {
  const state = stateManager.getState();
  if (!state.processedData || state.processedData.length === 0) return notification.error('Nenhum dado para exportar');

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
  }
}

function openEditModal(instalacao) {
  const state = stateManager.getState();
  const client = state.processedData.find(c => String(c.instalacao) === String(instalacao));

  if (!client) return notification.error('Cliente não encontrado');

  currentEditingClient = JSON.parse(JSON.stringify(client));

  if (!currentEditingClient._editor) {
    currentEditingClient = recalculateInvoice(currentEditingClient);
  }

  document.getElementById('modal-client-name').textContent = `${currentEditingClient.nome} (${currentEditingClient.instalacao})`;
  document.getElementById('edit-comp_qtd').value = currentEditingClient._editor.comp_qtd;
  document.getElementById('edit-tarifa_comp_ev').value = currentEditingClient._editor.tarifa_comp_ev;
  document.getElementById('edit-boleto_ev').value = currentEditingClient._editor.boleto_ev;
  document.getElementById('edit-dist_outros').value = currentEditingClient._editor.dist_outros;

  updatePreview();

  const modal = document.getElementById('edit-modal-corretor');
  modal.classList.remove('hidden');
  // Pequeno timeout para permitir transição CSS se houver
  setTimeout(() => modal.querySelector('div').classList.remove('scale-95'), 10);
}

function closeModal() {
  const modal = document.getElementById('edit-modal-corretor');
  modal.classList.add('hidden');
  currentEditingClient = null;
}

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

async function handleSave() {
  if (!currentEditingClient) return;

  // Atualiza valores finais
  updatePreview();
  const finalClientData = recalculateInvoice(currentEditingClient);

  // Atualiza no State
  const state = stateManager.getState();
  const updatedData = state.processedData.map(c =>
    c.instalacao === finalClientData.instalacao ? finalClientData : c
  );
  stateManager.setProcessedData(updatedData); // Isso vai disparar updateCorretorUI e atualizar a lista

  const saveBtn = document.getElementById('save-edit-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<div class="loader w-4 h-4 border-2 mr-2"></div> Gerando...';
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

// Função de recálculo (Mantida idêntica para consistência lógica)
function recalculateInvoice(client) {
  const d = { ...client };

  if (!d._editor) {
    // Tenta recuperar valores originais se disponíveis, senão usa os atuais como base
    const raw = d._raw || {};
    const consumo_total_val = d.dist_consumo_qtd * d.dist_consumo_tar;
    const comp_total_val_dist = d.det_credito_qtd * d.dist_comp_tar;

    // Tenta calcular o 'outros' original reverso
    const dist_outros_inicial = d.dist_outros || Math.max(0, d.dist_total - (consumo_total_val - comp_total_val_dist));

    d._editor = {
      comp_qtd: d.det_credito_qtd || 0,
      tarifa_comp_ev: d.det_credito_tar || 0,
      boleto_ev: 0, // Assume 0 se não tivermos a info original, usuário ajusta se precisar
      dist_outros: parseFloat(dist_outros_inicial.toFixed(2))
    };
  }

  const editor = d._editor;
  const comp_qtd = editor.comp_qtd;
  // Mantemos valores de consumo e tarifas da distribuidora constantes (não editáveis por enquanto)
  const consumo_qtd = d.dist_consumo_qtd;
  const tarifa_cons = d.dist_consumo_tar;
  const tarifa_comp_dist = d.dist_comp_tar;

  let det_credito_total, det_credito_tar;
  if (editor.boleto_ev > 0) {
    det_credito_total = editor.boleto_ev;
    det_credito_tar = (comp_qtd > 0) ? editor.boleto_ev / comp_qtd : 0;
  } else {
    det_credito_total = comp_qtd * editor.tarifa_comp_ev;
    det_credito_tar = editor.tarifa_comp_ev;
  }

  const consumo_total_val = consumo_qtd * tarifa_cons;
  const comp_total_val_dist = comp_qtd * tarifa_comp_dist;
  const dist_total = consumo_total_val - comp_total_val_dist + editor.dist_outros;

  const econ_total_com = dist_total + det_credito_total;
  const econ_total_sem = consumo_total_val + editor.dist_outros;
  const economiaMes = Math.max(0, econ_total_sem - econ_total_com);

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
    dist_outros: editor.dist_outros,
    dist_total: dist_total,
    econ_total_sem: econ_total_sem,
    econ_total_com: econ_total_com,
    // Nota: economiaTotal histórica não é recalculada, apenas a do mês
  };
}