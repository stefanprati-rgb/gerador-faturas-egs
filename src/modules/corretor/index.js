// src/modules/corretor/index.js
import stateManager from '../../core/StateManager.js';
import { FileStatus } from '../../components/FileStatus.js';
import { pdfGenerator } from '../../core/pdfGenerator.js';
import { formatCurrency, normalizeString } from '../../core/formatters.js';
import notification from '../../components/Notification.js';

// Importação dos módulos modularizados
import { getEditModalTemplate } from './templates/edit-modal-template.js';
import { getConflictModalTemplate, showConflictModal, hideConflictModal } from './templates/conflict-modal-template.js';
import {
  recalculateInvoice,
  extrairValoresBase,
  calcularDerivados,
  detectarConflito,
  resolverConflito,
  resolverConflito,
  CAMPOS_CONFIG,
  getFormulaBreakdown
} from './services/InvoiceRecalculator.js';
import { getBulkEditModalTemplate } from './templates/bulk-edit-modal-template.js';
import { applyBulkAction } from './services/BulkActions.js';

// Variables
let currentEditingClient = null;
let currentEditorValues = null;
let displayedClients = [];
let pendingConflict = null;
let pendingConflict = null;
let selectedClientIds = new Set(); // Estado para seleção múltipla
let currentOverrides = {}; // Estado dos overrides manuais { campo: true/false }

/**
 * Renderiza a interface principal do Corretor, incluindo os templates das modais.
 */
export async function renderCorretor() {
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
    </div>

    <!-- Barra Flutuante de Ações em Massa -->
    <div id="bulk-actions-bar" class="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-6 hidden z-40 transition-all duration-300 translate-y-20 opacity-0">
      <div class="flex items-center gap-3">
        <span class="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full" id="selected-count-badge">0</span>
        <span class="font-medium">clientes selecionados</span>
      </div>
      
      <div class="h-6 w-px bg-gray-700"></div>

      <div class="flex items-center gap-2">
        <button id="open-bulk-edit-btn" class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
          <i class="fas fa-pen"></i> Editar em Massa
        </button>
        <button id="deselect-all-btn" class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors text-sm text-gray-400 hover:text-white">
          <i class="fas fa-times"></i> Cancelar
        </button>
      </div>
    </div>
  `;

  // Retorna conteúdo + modais
  return content + getEditModalTemplate() + getConflictModalTemplate() + getBulkEditModalTemplate();
}

export function initCorretor() {
  // Garantir que as modais estejam no DOM
  ensureModalsInDOM();

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

  // Configurar listeners para todos os campos editáveis
  setupFieldListeners();

  // Listeners para ações em massa
  setupBulkActions();

  // Listeners para visualização de fórmulas e overrides
  setupFormulaVisualization();
}

/**
 * Garante que as modais estejam no DOM
 */
function ensureModalsInDOM() {
  if (!document.getElementById('edit-modal-corretor')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = getEditModalTemplate();
    document.body.appendChild(wrapper.firstElementChild);
  }

  if (!document.getElementById('conflict-modal')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = getConflictModalTemplate();
    document.body.appendChild(wrapper.firstElementChild);
  }
}

/**
 * Configura listeners para todos os campos editáveis
 */
function setupFieldListeners() {
  // Campos de input direto (recálculo imediato)
  const inputFields = [
    'edit-consumo_fp',
    'edit-cred_fp',
    'edit-tarifa_fp',
    'edit-tarifa_comp_fp',
    'edit-tarifa_egs',
    'edit-outros',
    'edit-boleto_egs'
  ];

  inputFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => handleFieldChange(id));
    }
  });

  // Campos derivados (podem gerar conflito)
  const derivedFields = [
    'edit-fatura_cgd',
    'edit-custo_sem_gd',
    'edit-custo_com_gd',
    'edit-economia'
  ];

  derivedFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => handleDerivedFieldChange(id));
    }
  });

  // Checkbox boleto fixo
  const boletoFixoCheckbox = document.getElementById('edit-boleto_fixo');
  if (boletoFixoCheckbox) {
    boletoFixoCheckbox.addEventListener('change', handleBoletoFixoChange);
  }
}

/**
 * Handler para mudança em campo de input
 */
function handleFieldChange(fieldId) {
  if (!currentEditorValues) return;

  const fieldName = fieldId.replace('edit-', '');
  const el = document.getElementById(fieldId);
  const value = parseFloat(el?.value || 0);

  // Validação Visual
  const errorEl = document.getElementById(`error-${fieldName}`);
  if (value < 0) {
    if (errorEl) {
      errorEl.textContent = 'Valor não pode ser negativo';
      errorEl.classList.remove('hidden');
    }
    el.classList.add('border-red-500', 'focus:ring-red-500');
  } else {
    if (errorEl) {
      errorEl.classList.add('hidden');
    }
    el.classList.remove('border-red-500', 'focus:ring-red-500');
  }

  // Atualizar valor no editor
  currentEditorValues[fieldName] = value;

  // Tratamento especial para boleto
  if (fieldName === 'boleto_egs') {
    currentEditorValues.boleto_fixo = true;
    updateBoletoBadge(true);
    // Recalcular tarifa EGS reversa
    if (currentEditorValues.cred_fp > 0) {
      currentEditorValues.tarifa_egs = value / currentEditorValues.cred_fp;
      document.getElementById('edit-tarifa_egs').value = currentEditorValues.tarifa_egs.toFixed(6);
    }
  }

  if (fieldName === 'tarifa_egs') {
    currentEditorValues.boleto_fixo = false;
    updateBoletoBadge(false);
  }

  // Marcar que houve edição e recalcular derivados
  currentEditorValues._editado = true;
  currentEditorValues = calcularDerivados(currentEditorValues, fieldName, currentOverrides);

  // Atualizar badge de não salvo
  document.getElementById('unsaved-badge')?.classList.remove('hidden');

  updateAllFields(fieldName); // Passa o campo editado para evitar sobrescrita visual e aplicar highlights
}

/**
 * Handler para mudança em campo derivado (pode gerar conflito)
 */
function handleDerivedFieldChange(fieldId) {
  if (!currentEditorValues) return;

  const fieldName = fieldId.replace('edit-', '');
  const el = document.getElementById(fieldId);
  const novoValor = parseFloat(el?.value || 0);
  const valorAtual = currentEditorValues[fieldName];

  // Se o valor não mudou significativamente, ignorar
  if (Math.abs(novoValor - valorAtual) < 0.01) return;

  // Se estiver em modo manual (override), tratar como input comum
  if (currentOverrides[fieldName]) {
    currentEditorValues[fieldName] = novoValor;
    currentEditorValues = calcularDerivados(currentEditorValues, fieldName, currentOverrides);
    document.getElementById('unsaved-badge')?.classList.remove('hidden');
    updateAllFields(fieldName);
    return;
  }

  // Detectar conflito
  const conflito = detectarConflito(fieldName);

  if (conflito) {
    // Mostrar modal de resolução de conflito
    const opcoes = conflito.opcoesResolucao.map(opt => ({
      campo: opt.campo,
      label: opt.label,
      valor: formatCurrency(currentEditorValues[opt.campo] || 0),
      descricao: `Manter este valor fixo e recalcular os demais`
    }));

    showConflictModal(
      fieldName,
      conflito.label,
      novoValor,
      opcoes,
      (campoFixo) => {
        // Resolver conflito
        currentEditorValues = resolverConflito(currentEditorValues, fieldName, novoValor, campoFixo);
        currentEditorValues = calcularDerivados(currentEditorValues, fieldName, currentOverrides);
        document.getElementById('unsaved-badge')?.classList.remove('hidden');
        updateAllFields(fieldName);
      },
      () => {
        // Cancelar - restaurar valor original
        el.value = valorAtual.toFixed(2);
      }
    );
  } else {
    // Sem conflito, apenas atualizar
    currentEditorValues[fieldName] = novoValor;
    currentEditorValues = calcularDerivados(currentEditorValues, fieldName, currentOverrides);
    updateAllFields();
  }
}

/**
 * Handler para mudança no checkbox de boleto fixo
 */
function handleBoletoFixoChange() {
  if (!currentEditorValues) return;

  const isFixo = document.getElementById('edit-boleto_fixo')?.checked || false;
  currentEditorValues.boleto_fixo = isFixo;
  updateBoletoBadge(isFixo);

  // Recalcular se não for fixo (o boleto vai ser calculado pela tarifa)
  if (!isFixo) {
    currentEditorValues = calcularDerivados(currentEditorValues, 'tarifa_egs', currentOverrides);
    updateAllFields();
  }
}

/**
 * Atualiza badge de modo do boleto
 */
function updateBoletoBadge(isFixo) {
  const badge = document.getElementById('boleto-mode-badge');
  if (badge) {
    if (isFixo) {
      badge.textContent = 'FIXO';
      badge.className = 'text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-2';
    } else {
      badge.textContent = 'CALCULADO';
      badge.className = 'text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2';
    }
  }
}

/**
 * Atualiza todos os campos na UI
 */
function updateAllFields() {
  if (!currentEditorValues) return;

  const v = currentEditorValues;

  // Campos de input (atualizar se não estiver focado)
  // Campos de input (atualizar se não estiver focado)
  const updateIfNotFocused = (id, value, decimals = 2) => {
    const el = document.getElementById(id);
    if (el) {
      const numericValue = typeof value === 'number' ? value : parseFloat(value || 0);
      const currentValue = parseFloat(el.value || 0);

      // Se o valor mudou (e não foi o usuário digitando agora), destacar visualmente
      if (Math.abs(currentValue - numericValue) > 0.000001 && document.activeElement !== el) {
        el.value = numericValue.toFixed(decimals);

        // Adicionar highlight
        el.classList.add('bg-yellow-50', 'transition-colors', 'duration-1000');
        setTimeout(() => {
          el.classList.remove('bg-yellow-50');
        }, 1500);
      }

      // Se estiver focado, não atualiza o valor para não atrapalhar digitação,
      // mas se for o campo que disparou a mudança, ok.
    }
  };

  // Quantidades
  updateIfNotFocused('edit-consumo_fp', v.consumo_fp, 0);
  updateIfNotFocused('edit-cred_fp', v.cred_fp, 0);

  // Tarifas
  updateIfNotFocused('edit-tarifa_fp', v.tarifa_fp, 6);
  updateIfNotFocused('edit-tarifa_comp_fp', v.tarifa_comp_fp, 6);
  updateIfNotFocused('edit-tarifa_egs', v.tarifa_egs, 6);

  // Valores
  updateIfNotFocused('edit-outros', v.outros, 2);
  updateIfNotFocused('edit-boleto_egs', v.boleto_egs, 2);
  updateIfNotFocused('edit-fatura_cgd', v.fatura_cgd, 2);

  // Checkbox boleto fixo
  const boletoFixoCheckbox = document.getElementById('edit-boleto_fixo');
  if (boletoFixoCheckbox) {
    boletoFixoCheckbox.checked = v.boleto_fixo;
  }

  // Campos de resultado (sempre atualizar)
  const setResult = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatCurrency(value);
  };

  setResult('res-economia_mes', v.economia);
  setResult('res-custo_sem_gd', v.custo_sem_gd);
  setResult('res-fatura_cgd', v.fatura_cgd);
  setResult('res-boleto_egs', v.boleto_egs);
  setResult('res-custo_com_gd', v.custo_com_gd);

  // Métricas ambientais
  const co2El = document.getElementById('res-co2');
  const arvoresEl = document.getElementById('res-arvores');
  if (co2El) co2El.textContent = `${(v.co2_evitado || 0).toFixed(1)} kg`;
  if (arvoresEl) arvoresEl.textContent = (v.arvores || 0).toFixed(1);
}

function updateCorretorUI(state) {
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
  updateBulkActionsToolbar(); // Update toolbar visibility based on selection
}

function renderCorretorList(clients) {
  const clientsList = document.getElementById('clients-list-corretor');
  if (!clientsList) return;

  displayedClients = clients; // Atualizar referência global

  if (!clients.length) {
    clientsList.innerHTML = '<p class="text-center text-gray-400 py-8">Nenhum cliente encontrado</p>';
    return;
  }

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

  // Clonar cliente para edição
  currentEditingClient = JSON.parse(JSON.stringify(client));

  // Extrair valores para o editor (já vem com valores originais preservados)
  currentEditorValues = extrairValoresBase(currentEditingClient);

  // Resetar overrides
  currentOverrides = {};
  // Se boleto vier fixo, marcamos override implícito visualmente (embora a lógica use boleto_fixo)
  // Mas para consistência da UI:
  document.querySelectorAll('input[type="checkbox"][id^="override-"]').forEach(cb => cb.checked = false);

  // Calcular tarifa EGS reversa se não informada
  if (currentEditorValues.tarifa_egs === 0 && currentEditorValues.cred_fp > 0 && currentEditorValues.boleto_egs > 0) {
    currentEditorValues.tarifa_egs = currentEditorValues.boleto_egs / currentEditorValues.cred_fp;
  }

  // NÃO recalcular derivados na inicialização!
  // Os valores originais da planilha são preservados.
  // O recálculo só acontece quando o usuário edita um campo.

  // Atualizar header
  document.getElementById('modal-client-name').textContent = `${currentEditingClient.nome} (${currentEditingClient.instalacao})`;

  // Popular todos os campos
  updateAllFields();
  updateBoletoBadge(currentEditorValues.boleto_fixo);

  // Mostrar modal
  const modal = document.getElementById('edit-modal-corretor');
  modal.classList.remove('hidden');
  setTimeout(() => modal.querySelector('div').classList.remove('scale-95'), 10);

  // Reconfigurar listeners após modal abrir
  setTimeout(() => setupFieldListeners(), 50);
}

function closeModal() {
  const modal = document.getElementById('edit-modal-corretor');
  modal?.querySelector('div')?.classList.add('scale-95');
  setTimeout(() => {
    modal?.classList.add('hidden');
    currentEditingClient = null;
    currentEditorValues = null;
  }, 200);
}

async function handleSave() {
  if (!currentEditingClient || !currentEditorValues) return;

  // Construir cliente final com valores do editor
  const finalClientData = recalculateInvoice(currentEditingClient, {
    consumo_fp: currentEditorValues.consumo_fp,
    cred_fp: currentEditorValues.cred_fp,
    tarifa_fp: currentEditorValues.tarifa_fp,
    tarifa_comp_fp: currentEditorValues.tarifa_comp_fp,
    tarifa_egs: currentEditorValues.tarifa_egs,
    outros: currentEditorValues.outros,
    boleto_egs: currentEditorValues.boleto_egs
  });

  // Atualiza no State
  const state = stateManager.getState();
  const updatedData = state.processedData.map(c =>
    c.instalacao === finalClientData.instalacao ? finalClientData : c
  );
  stateManager.setProcessedData({ data: updatedData, warnings: state.validationWarnings });

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

// --- Lógica de Ações em Massa ---

function setupBulkActions() {
  const openBulkBtn = document.getElementById('open-bulk-edit-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const closeBulkModalBtn = document.getElementById('close-bulk-modal');
  const cancelBulkBtn = document.getElementById('cancel-bulk-btn');
  const applyBulkBtn = document.getElementById('apply-bulk-btn');

  // Modal de edição em massa
  const bulkField = document.getElementById('bulk-field');
  const bulkOps = document.querySelectorAll('input[name="bulk-op"]');
  const bulkValue = document.getElementById('bulk-value');

  openBulkBtn?.addEventListener('click', openBulkEditModal);
  deselectAllBtn?.addEventListener('click', deselectAll);

  [closeBulkModalBtn, cancelBulkBtn].forEach(btn =>
    btn?.addEventListener('click', closeBulkEditModal)
  );

  applyBulkBtn?.addEventListener('click', handleApplyBulkEdit);

  // Preview dinâmico no modal
  bulkField?.addEventListener('change', updateBulkPreview);
  bulkOps.forEach(op => op.addEventListener('change', updateBulkPreview));
  bulkValue?.addEventListener('input', updateBulkPreview);
}

function toggleSelectAll(e) {
  const isChecked = e.target.checked;
  const checkboxes = document.querySelectorAll('.client-checkbox');

  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const id = cb.dataset.id;
    toggleSelection(id, isChecked, false); // false para não atualizar toolbar a cada iteração
  });

  updateBulkActionsToolbar();
}

function toggleSelection(id, isChecked, updateToolbar = true) {
  if (isChecked) {
    selectedClientIds.add(id);
    document.querySelector(`.group[data-id="${id}"]`)?.classList.add('bg-blue-50/50');
  } else {
    selectedClientIds.delete(id);
    document.querySelector(`.group[data-id="${id}"]`)?.classList.remove('bg-blue-50/50');
  }

  if (updateToolbar) {
    updateBulkActionsToolbar();

    // Atualizar check do "Selecionar Todos"
    const selectAllCb = document.getElementById('select-all-clients');
    if (selectAllCb) {
      selectAllCb.checked = selectedClientIds.size === displayedClients.length && displayedClients.length > 0;
      selectAllCb.indeterminate = selectedClientIds.size > 0 && selectedClientIds.size < displayedClients.length;
    }
  }
}

function deselectAll() {
  selectedClientIds.clear();
  const checkboxes = document.querySelectorAll('.client-checkbox');
  const selectAllCb = document.getElementById('select-all-clients');

  checkboxes.forEach(cb => {
    cb.checked = false;
    const row = document.querySelector(`.group[data-id="${cb.dataset.id}"]`);
    row?.classList.remove('bg-blue-50/50');
  });

  if (selectAllCb) {
    selectAllCb.checked = false;
    selectAllCb.indeterminate = false;
  }

  updateBulkActionsToolbar();
}

function updateBulkActionsToolbar() {
  const bar = document.getElementById('bulk-actions-bar');
  const badge = document.getElementById('selected-count-badge');
  const count = selectedClientIds.size;

  if (badge) badge.textContent = count;

  if (count > 0) {
    bar?.classList.remove('hidden');
    // Pequeno delay para permitir transição de opacidade/transform
    setTimeout(() => {
      bar?.classList.remove('translate-y-20', 'opacity-0');
    }, 10);
  } else {
    bar?.classList.add('translate-y-20', 'opacity-0');
    setTimeout(() => {
      if (selectedClientIds.size === 0) bar?.classList.add('hidden');
    }, 300);
  }
}

// Modal Functions
function openBulkEditModal() {
  const modal = document.getElementById('bulk-edit-modal');
  const countSpan = document.getElementById('bulk-count');

  if (countSpan) countSpan.textContent = selectedClientIds.size;
  modal?.classList.remove('hidden');

  // Resetar campos
  document.getElementById('bulk-field').value = "";
  document.getElementById('operation-container').classList.add('hidden');
}

function closeBulkEditModal() {
  document.getElementById('bulk-edit-modal')?.classList.add('hidden');
}

function updateBulkPreview() {
  const field = document.getElementById('bulk-field').value;
  const op = document.querySelector('input[name="bulk-op"]:checked')?.value;
  const value = parseFloat(document.getElementById('bulk-value').value);
  const previewText = document.getElementById('bulk-preview-text');
  const applyBtn = document.getElementById('apply-bulk-btn');
  const opContainer = document.getElementById('operation-container');

  if (!field) {
    opContainer.classList.add('hidden');
    applyBtn.disabled = true;
    return;
  }

  opContainer.classList.remove('hidden');

  if (isNaN(value)) {
    previewText.textContent = 'Digite um valor válido para aplicar';
    applyBtn.disabled = true;
    return;
  }

  applyBtn.disabled = false;

  const count = selectedClientIds.size;
  let msg = `Aplicará a alteração em ${count} cliente(s).`;

  // Melhorar mensagem baseado na operação
  if (op === 'set') msg = `Definirá ${field} como ${value} para ${count} clientes.`;
  if (op.includes('percent')) msg = `${op === 'add_percent' ? 'Aumentará' : 'Diminuirá'} ${field} em ${value}% para ${count} clientes.`;

  previewText.textContent = msg;
}

function handleApplyBulkEdit() {
  const field = document.getElementById('bulk-field').value;
  const op = document.querySelector('input[name="bulk-op"]:checked')?.value;
  const value = parseFloat(document.getElementById('bulk-value').value);

  if (!field || isNaN(value)) return;

  // Obter estado atual
  const currentState = stateManager.getState();
  // Precisamos de todos os dados processados para encontrar os clientes completos
  const allClients = stateManager.getState().processedFiles.flatMap(f => f.data.processedData) || [];

  // Aplicar alterações
  const updatedClients = applyBulkAction(allClients, selectedClientIds, field, op, value);

  // Atualizar estado global
  const newProcessedFiles = currentState.processedFiles.map(file => {
    const updatedFileData = file.data.processedData.map(originalClient => {
      const updated = updatedClients.find(c => c.id === originalClient.id);
      return updated || originalClient;
    });

    return {
      ...file,
      data: {
        ...file.data,
        processedData: updatedFileData
      }
    };
  });

  stateManager.setState({ processedFiles: newProcessedFiles });

  notification.success(`${selectedClientIds.size} clientes atualizados com sucesso!`);
  closeBulkEditModal();
  deselectAll();
}