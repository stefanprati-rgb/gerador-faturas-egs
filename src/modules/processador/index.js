// src/modules/processador/index.js

import excelProcessor from '../../core/excelProcessor.js';
import stateManager from '../../core/StateManager.js';
import { FileStatus } from '../../components/FileStatus.js';
import { validateFile } from '../../core/validators.js';
import notification from '../../components/Notification.js';
// Importação dos módulos modularizados
import { getProcessadorTemplate } from './templates/processador-template.js';
import { handleExport } from './utils/data-exporter.js';
import { renderResults, renderWarnings } from './utils/results-renderer.js';
import { initConfigModal } from '../../components/ConfigModal.js';

let isPyodideReady = false;

/**
 * Renderiza a interface do processador (agora importando o template)
 */
export async function renderProcessador() {
  return getProcessadorTemplate();
}

export function initProcessador() {
  // Inicializa componente de Status (onde fica o botão Reset)
  new FileStatus('processador-file-status');

  const fileUpload = document.getElementById('file-upload-processador');
  const dropZone = document.getElementById('drop-zone-processador');
  const processBtn = document.getElementById('process-btn-processador');

  // Inscrever-se no StateManager
  stateManager.subscribe((state) => updateUI(state));

  // Renderizar estado inicial imediatamente
  updateUI(stateManager.getState());

  const handleUpload = (file) => {
    const valid = validateFile(file);
    if (!valid.valid) return notification.error(valid.error);

    if (stateManager.hasFile()) {
      FileStatus.requestFileChange(() => stateManager.setFile(file));
    } else {
      stateManager.setFile(file);
    }
  };

  if (dropZone) {
    dropZone.addEventListener('click', () => fileUpload.click());

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.add('drop-active');
    }));
    ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-active');
    }));

    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
    });
  }

  if (fileUpload) {
    fileUpload.addEventListener('change', (e) => e.target.files[0] && handleUpload(e.target.files[0]));
  }

  // Event Listeners dos Parâmetros
  ['mes-referencia-processador', 'data-vencimento-processador'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      stateManager.setParams({ [e.target.id.includes('mes') ? 'mesReferencia' : 'dataVencimento']: e.target.value });
    });
  });

  if (processBtn) processBtn.addEventListener('click', handleProcess);

  // Event Listeners das Ações
  document.getElementById('export-json-btn')?.addEventListener('click', () => handleExport('json'));
  document.getElementById('export-csv-btn')?.addEventListener('click', () => handleExport('csv'));
  document.getElementById('send-to-corretor-btn')?.addEventListener('click', () => {
    window.location.hash = '/corretor';
    notification.info('Navegando para o Corretor...');
  });

  // Inicializar modal de configuração
  const configModal = initConfigModal(excelProcessor, () => {
    // Callback para atualizar indicadores quando status mudar
    updateConfigBadge();
  });
  const configBtn = document.getElementById('config-btn-processador');
  const configBadge = document.getElementById('config-badge');
  const dbStatusText = document.getElementById('db-status-text');

  if (configBtn) {
    configBtn.addEventListener('click', () => {
      configModal.open();
    });
  }

  // Atualizar badge de status da base externa
  const updateConfigBadge = async () => {
    const status = await excelProcessor.getExternalDatabaseStatus();
    if (configBadge) {
      configBadge.classList.toggle('hidden', !status.loaded);
    }
    if (dbStatusText) {
      dbStatusText.classList.toggle('hidden', !status.loaded);
      if (status.loaded && status.recordCount > 0) {
        dbStatusText.innerHTML = `<i class="fas fa-check-circle mr-1"></i>Base carregada (${status.recordCount} registros)`;
      }
    }
  };

  updateConfigBadge();

  // Inicializar Pyodide em background
  initPyodideForProcessador();
}

async function initPyodideForProcessador() {
  try {
    await excelProcessor.init((status) => {
      console.log('Pyodide Status:', status);
    });
    isPyodideReady = true;
    // Atualiza a UI para habilitar o botão se tudo estiver pronto
    updateUI(stateManager.getState());
  } catch (error) {
    console.error('Erro ao inicializar Pyodide:', error);
    notification.error('Falha ao carregar motor de processamento.');
  }
}

function updateUI(state) {
  const processBtn = document.getElementById('process-btn-processador');
  if (!processBtn) return;

  const uploadCard = document.getElementById('upload-card-processador');
  const statusEl = document.getElementById('processador-file-status');
  const mesRef = document.getElementById('mes-referencia-processador');
  const dataVenc = document.getElementById('data-vencimento-processador');

  // Sincroniza Inputs com o State
  if (mesRef && state.params.mesReferencia) mesRef.value = state.params.mesReferencia;
  if (dataVenc && state.params.dataVencimento) dataVenc.value = state.params.dataVencimento;

  // VISIBILIDADE DO STATUS: Sempre visível se existir
  if (statusEl) statusEl.classList.remove('hidden');

  // VISIBILIDADE DO UPLOAD: Só esconde se tiver arquivo carregado
  if (state.file) {
    uploadCard?.classList.add('hidden');
  } else {
    uploadCard?.classList.remove('hidden');
  }

  // Configuração do Botão Processar
  const isReady = state.file && state.params.mesReferencia && state.params.dataVencimento && isPyodideReady;

  processBtn.disabled = !isReady;

  if (!isPyodideReady && state.file) {
    processBtn.innerHTML = '<div class="loader mr-2"></div> Carregando sistema...';
  } else if (state.processedData.length > 0) {
    processBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Reprocessar Dados';
  } else {
    processBtn.innerHTML = '<i class="fas fa-cogs mr-2"></i>Processar Dados';
  }

  // Visibilidade dos Resultados
  const hasData = state.processedData.length > 0;

  const toggle = (id, show) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !show);
  };

  toggle('empty-state-processador', !hasData);
  toggle('stats-container-processador', hasData);
  toggle('table-container-processador', hasData);
  toggle('actions-container-processador', hasData);
  toggle('result-count-badge', !state.validationWarnings.find(w => w.severity === 'error') && hasData);

  if (hasData) {
    const badge = document.getElementById('result-count-badge');
    if (badge) badge.textContent = `${state.processedData.length}`;

    // Chamadas aos Renderers Modularizados
    renderResults(state.processedData);
    renderWarnings(state.validationWarnings || []);
  } else {
    // Garante que o painel de warnings também seja limpo
    renderWarnings([]);
  }
}

async function handleProcess() {
  const state = stateManager.getState();
  if (!state.file) return notification.error("Nenhum arquivo carregado.");

  const btn = document.getElementById('process-btn-processador');
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="loader mr-2"></div> Processando...';
    }

    // Chama o processor que retorna {data, warnings}
    const result = await excelProcessor.processFile(state.file, state.params.mesReferencia, state.params.dataVencimento);

    // Salva no StateManager (dispara updateUI automaticamente)
    stateManager.setProcessedResult(result);

    const dataCount = result.data?.length || 0;
    const errorsCount = result.warnings?.filter(w => w.severity === 'error').length || 0;

    if (errorsCount > 0) {
      notification.warning(`Processado com ${errorsCount} erro(s). Corrija os problemas no Corretor.`);
    } else if (dataCount === 0) {
      notification.warning('Nenhum cliente com valor a cobrar foi encontrado no mês selecionado (filtro < R$5,00).');
    } else {
      notification.success(`${dataCount} registros processados com sucesso!`);
    }

  } catch (e) {
    notification.error(e.message || 'Erro ao processar arquivo');
    console.error(e);
  } finally {
    // O botão será reabilitado pelo updateUI
  }
}