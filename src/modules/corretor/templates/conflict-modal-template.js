// src/modules/corretor/templates/conflict-modal-template.js

/**
 * Retorna o template HTML para o modal de resolução de conflitos.
 * @returns {string} HTML do Modal.
 */
export function getConflictModalTemplate() {
    return `
    <div id="conflict-modal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] hidden transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 transform scale-95 transition-transform duration-300 animate-slide-up">
        <div class="p-6 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-amber-100 rounded-xl">
              <i class="fas fa-exclamation-triangle text-amber-600 text-xl"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-gray-900">Resolução de Conflito</h3>
              <p id="conflict-description" class="text-sm text-gray-500 mt-0.5">Selecione qual valor manter fixo</p>
            </div>
          </div>
        </div>

        <div class="p-6">
          <p id="conflict-message" class="text-sm text-gray-700 mb-4">
            Você alterou um valor calculado. Escolha qual campo manter fixo:
          </p>
          
          <div id="conflict-options" class="space-y-3">
            <!-- Opções serão inseridas dinamicamente -->
          </div>
        </div>

        <div class="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 rounded-b-2xl">
          <button id="conflict-cancel-btn" class="btn btn-secondary px-4 py-2">
            <i class="fas fa-times mr-2"></i>Cancelar
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Gera HTML para uma opção de resolução de conflito
 * @param {string} campoFixo - Campo que será mantido fixo
 * @param {string} label - Label do campo
 * @param {string} valorAtual - Valor atual formatado
 * @param {string} descricao - Descrição do que será recalculado
 * @returns {string} HTML da opção
 */
export function getConflictOptionHTML(campoFixo, label, valorAtual, descricao) {
    return `
    <button 
      class="conflict-option w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-blue-50/50 transition-all group"
      data-keep="${campoFixo}"
    >
      <div class="flex items-center justify-between">
        <div>
          <span class="font-semibold text-gray-900 group-hover:text-primary transition-colors">
            Manter ${label}
          </span>
          <span class="text-gray-600 font-mono ml-2">${valorAtual}</span>
        </div>
        <i class="fas fa-chevron-right text-gray-400 group-hover:text-primary transition-colors"></i>
      </div>
      <p class="text-xs text-gray-500 mt-1">${descricao}</p>
    </button>
  `;
}

/**
 * Mostra o modal de conflito com as opções apropriadas
 * @param {string} campoAlterado - Campo que foi alterado
 * @param {number} novoValor - Novo valor inserido
 * @param {Array} opcoes - Array de opções de resolução [{campo, label, valor, descricao}]
 * @param {Function} onResolve - Callback quando usuário escolhe (campo) => void
 * @param {Function} onCancel - Callback quando usuário cancela
 */
export function showConflictModal(campoAlterado, labelCampo, novoValor, opcoes, onResolve, onCancel) {
    const modal = document.getElementById('conflict-modal');
    const optionsContainer = document.getElementById('conflict-options');
    const message = document.getElementById('conflict-message');

    if (!modal || !optionsContainer) return;

    // Formatar valor
    const valorFormatado = typeof novoValor === 'number'
        ? novoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : novoValor;

    // Atualizar mensagem
    message.innerHTML = `
        Você alterou <strong class="text-primary">${labelCampo}</strong> para 
        <strong class="text-primary">${valorFormatado}</strong>.<br>
        <span class="text-gray-500">Escolha qual campo manter fixo para recalcular os demais:</span>
    `;

    // Gerar opções
    optionsContainer.innerHTML = opcoes.map(opt =>
        getConflictOptionHTML(opt.campo, opt.label, opt.valor, opt.descricao)
    ).join('');

    // Configurar handlers
    const handleOptionClick = (e) => {
        const btn = e.target.closest('.conflict-option');
        if (!btn) return;

        const campoFixo = btn.dataset.keep;
        hideConflictModal();
        onResolve(campoFixo);
    };

    const handleCancel = () => {
        hideConflictModal();
        onCancel();
    };

    // Bind events
    optionsContainer.addEventListener('click', handleOptionClick);
    document.getElementById('conflict-cancel-btn')?.addEventListener('click', handleCancel);

    // Mostrar modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('div').classList.remove('scale-95');
    }, 10);

    // Cleanup function
    modal._cleanup = () => {
        optionsContainer.removeEventListener('click', handleOptionClick);
        document.getElementById('conflict-cancel-btn')?.removeEventListener('click', handleCancel);
    };
}

/**
 * Esconde o modal de conflito
 */
export function hideConflictModal() {
    const modal = document.getElementById('conflict-modal');
    if (!modal) return;

    modal.querySelector('div')?.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal._cleanup?.();
    }, 200);
}
