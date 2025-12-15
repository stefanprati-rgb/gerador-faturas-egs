export function getBulkEditModalTemplate() {
    return `
    <div id="bulk-edit-modal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 hidden backdrop-blur-sm transition-all duration-300">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 transform transition-all scale-100">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white rounded-t-2xl">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-100 rounded-lg text-blue-600">
              <i class="fas fa-layer-group text-xl"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-gray-900">Edição em Massa</h3>
              <p class="text-sm text-gray-500"><span id="bulk-count">0</span> clientes selecionados</p>
            </div>
          </div>
          <button id="close-bulk-modal" class="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-6">
          
          <!-- Seletor de Campo -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">Qual campo deseja alterar?</label>
            <div class="relative">
              <select id="bulk-field" class="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer hover:bg-white hover:border-gray-300">
                <option value="" disabled selected>Selecione um campo...</option>
                <optgroup label="Tarifas">
                  <option value="tarifa_fp">Tarifa FP (R$/kWh)</option>
                  <option value="tarifa_comp_fp">Tarifa Compensada FP (R$/kWh)</option>
                  <option value="tarifa_egs">Tarifa Média EGS (R$/kWh)</option>
                </optgroup>
                <optgroup label="Valores">
                  <option value="outros">Outros/CIP (R$)</option>
                </optgroup>
              </select>
              <div class="absolute left-3 top-3.5 text-gray-400 pointer-events-none">
                <i class="fas fa-tag"></i>
              </div>
              <div class="absolute right-3 top-3.5 text-gray-400 pointer-events-none">
                <i class="fas fa-chevron-down"></i>
              </div>
            </div>
          </div>

          <!-- Seletor de Operação -->
          <div id="operation-container" class="hidden space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">O que fazer?</label>
              <div class="grid grid-cols-2 gap-3">
                <label class="cursor-pointer">
                  <input type="radio" name="bulk-op" value="set" class="peer sr-only" checked>
                  <div class="p-3 border rounded-xl text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-equals"></i>
                    Definir Valor Fixo
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="bulk-op" value="add_percent" class="peer sr-only">
                  <div class="p-3 border rounded-xl text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-percentage"></i>
                    Aumentar %
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="bulk-op" value="sub_percent" class="peer sr-only">
                  <div class="p-3 border rounded-xl text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-percentage"></i>
                    Diminuir %
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input type="radio" name="bulk-op" value="add_value" class="peer sr-only">
                  <div class="p-3 border rounded-xl text-center peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-plus"></i>
                    Somar Valor
                  </div>
                </label>
              </div>
            </div>

            <!-- Input de Valor -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">Valor</label>
              <div class="relative">
                <input type="number" id="bulk-value" class="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-gray-800 text-lg" step="0.000001" placeholder="0.00">
                <div class="absolute left-3 top-3.5 text-gray-400 text-lg">
                  <i id="value-icon" class="fas fa-hashtag"></i>
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <i class="fas fa-info-circle"></i>
                <span id="bulk-preview-text">Selecione uma operação para ver o efeito</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
          <button id="cancel-bulk-btn" class="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors">
            Cancelar
          </button>
          <button id="apply-bulk-btn" class="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" disabled>
            <i class="fas fa-check"></i>
            Aplicar Alterações
          </button>
        </div>
      </div>
    </div>
  `;
}
