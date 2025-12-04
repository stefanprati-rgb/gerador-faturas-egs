// src/modules/corretor/index.js
import stateManager from '../../core/StateManager.js';
import { FileStatus } from '../../components/FileStatus.js';
import { pdfGenerator } from '../../core/pdfGenerator.js';
import { formatCurrency, normalizeString } from '../../core/formatters.js';
import notification from '../../components/Notification.js';
// Importação dos módulos modularizados
import { getEditModalTemplate } from './templates/edit-modal-template.js';
import { recalculateInvoice } from './services/InvoiceRecalculator.js';

let currentEditingClient = null;
let displayedClients = [];

/**
 * Renderiza a interface principal do Corretor, incluindo o template da modal.
 */
export async function renderCorretor() {
  // O template da modal é injetado no final do corpo da página principal (index.html)
  // O router irá injetar a modal no DOM, então a função principal só precisa do conteúdo da aba.

  // No entanto, como o template da modal é grande e está na função render, 
  // precisamos garantir que ele seja retornado para ser injetado.

  // O conteúdo da aba:
  const content = `
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
  `;

  // A modal é retornada aqui para ser injetada no final do main-content
  return content + getEditModalTemplate();
}

export function initCorretor() {
  // Deve-se garantir que a modal esteja no DOM antes de inicializar os event listeners
  const modalContainer = document.getElementById('edit-modal-corretor');
  if (!modalContainer) {
    // Injeta a modal no body se ainda não estiver lá (fallback/garantia)
    const modalWrapper = document.createElement('div');
    modalWrapper.innerHTML = getEditModalTemplate();
    document.body.appendChild(modalWrapper.firstElementChild);
  }

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
  stateManager.setProcessedData({ data: updatedData, warnings: state.validationWarnings }); // Isso vai disparar updateCorretorUI e atualizar a lista

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
    a.remove();

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