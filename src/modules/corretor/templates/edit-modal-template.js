// src/modules/corretor/templates/edit-modal-template.js

/**
 * Retorna o template HTML para o modal de edição de fatura.
 * @returns {string} HTML do Modal.
 */
export function getEditModalTemplate() {
    return `
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