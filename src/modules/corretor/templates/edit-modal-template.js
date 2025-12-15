// src/modules/corretor/templates/edit-modal-template.js

/**
 * Retorna o template HTML para o modal de edição de fatura expandido.
 * Inclui todos os campos editáveis com recálculo bidirecional.
 * @returns {string} HTML do Modal.
 */
export function getEditModalTemplate() {
  return `
    <div id="edit-modal-corretor" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden transition-opacity duration-300">
      <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[95vh] overflow-y-auto transform scale-95 transition-transform duration-300">
        
        <!-- Header -->
        <div class="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-xl font-bold text-gray-900">Editar Fatura</h3>
              <span id="unsaved-badge" class="hidden px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                <i class="fas fa-circle text-[8px] mr-1"></i> Não salvo
              </span>
            </div>
            <p id="modal-client-name" class="text-sm text-gray-500 mt-1">Carregando...</p>
          </div>
          <button id="close-modal-btn" class="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Coluna 1: Quantidades e Tarifas -->
            <div class="space-y-6">
              
              <!-- Seção Quantidades -->
              <div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <i class="fas fa-bolt text-amber-500"></i>
                  Quantidades (kWh)
                </h4>
                
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Consumo FP</label>
                    <div class="relative">
                      <input type="number" id="edit-consumo_fp" class="input pr-14" step="1" min="0">
                      <span class="absolute right-3 top-2.5 text-gray-400 text-sm">kWh</span>
                    </div>
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Crédito Consumido FP</label>
                    <div class="relative">
                      <input type="number" id="edit-cred_fp" class="input pr-14" step="1" min="0">
                      <span class="absolute right-3 top-2.5 text-gray-400 text-sm">kWh</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Seção Tarifas -->
              <div class="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                <h4 class="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <i class="fas fa-percentage text-blue-500"></i>
                  Tarifas (R$/kWh)
                </h4>
                
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Tarifa FP (CEMIG)</label>
                    <input type="number" id="edit-tarifa_fp" class="input" step="0.000001" min="0">
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      Tarifa Compensada FP
                      <div class="group relative ml-1">
                        <i class="fas fa-info-circle text-gray-400 hover:text-blue-500 cursor-help text-xs"></i>
                        <div class="hidden group-hover:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg">
                          Usada para calcular o valor abatido da fatura da distribuidora (Crédito × Tarifa).
                          <div class="absolute top-100 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </label>
                    <input type="number" id="edit-tarifa_comp_fp" class="input" step="0.000001" min="0">
                    <p class="text-xs text-red-500 mt-1 hidden" id="error-tarifa_comp_fp"></p>
                  </div>
                  
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      Tarifa Média EGS
                      <div class="group relative ml-1">
                        <i class="fas fa-info-circle text-gray-400 hover:text-blue-500 cursor-help text-xs"></i>
                         <div class="hidden group-hover:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg">
                          Tarifa usada para calcular o Boleto EGS.
                          <div class="absolute top-100 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                      </div>
                    </label>
                    <input type="number" id="edit-tarifa_egs" class="input" step="0.000001" min="0">
                    <p class="text-xs text-gray-500 mt-1">Calculada automaticamente se boleto for editado</p>
                    <p class="text-xs text-red-500 mt-1 hidden" id="error-tarifa_egs"></p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Coluna 2: Valores Financeiros -->
            <div class="space-y-6">
              
              <!-- Seção Distribuidora -->
              <div class="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
                <h4 class="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <i class="fas fa-building text-purple-500"></i>
                  Distribuidora (R$)
                </h4>
                
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      <div class="flex items-center gap-1">
                        Economia do Mês
                        <span class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200" title="Campo Calculado">🔄</span>
                      </div>
                      <div class="flex items-center gap-2">
                         <button id="view-calc-economia" class="text-gray-400 hover:text-blue-600 focus:outline-none transition-colors" title="Ver Cálculo Detalhado">
                           <i class="fas fa-eye text-xs"></i>
                         </button>
                         <label class="flex items-center gap-1 cursor-pointer" title="Habilitar edição manual (sobrescrever cálculo)">
                           <input type="checkbox" id="override-economia" class="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                           <span class="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Manual</span>
                         </label>
                      </div>
                    </label>
                    <div class="relative">
                      <span class="absolute left-3 top-2.5 text-gray-400 text-sm">R$</span>
                      <input type="number" id="edit-economia" class="input pl-10 font-bold text-lg text-green-600 bg-gray-50 transition-colors" step="0.01" readonly>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Diferença entre custo SEM e COM geração distribuída</p>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Outros/CIP</label>
                    <div class="relative">
                      <span class="absolute left-3 top-2.5 text-gray-400 text-sm">R$</span>
                      <input type="number" id="edit-outros" class="input pl-10" step="0.01" min="0">
                    </div>
                    <p class="text-xs text-red-500 mt-1 hidden" id="error-outros"></p>
                  </div>
                    <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      <div class="flex items-center gap-1">
                        Fatura C/GD (Total Distribuidora) ⚡
                        <span class="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200" title="Campo Calculado">🔄</span>
                      </div>
                      <div class="flex items-center gap-2">
                         <button id="view-calc-fatura_cgd" class="text-gray-400 hover:text-blue-600 focus:outline-none transition-colors" title="Ver Cálculo Detalhado">
                           <i class="fas fa-eye text-xs"></i>
                         </button>
                         <label class="flex items-center gap-1 cursor-pointer" title="Habilitar edição manual (sobrescrever cálculo)">
                           <input type="checkbox" id="override-fatura_cgd" class="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                           <span class="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Manual</span>
                         </label>
                      </div>
                    </label>
                    <div class="relative">
                      <span class="absolute left-3 top-2.5 text-gray-400 text-sm">R$</span>
                      <input type="number" id="edit-fatura_cgd" class="input pl-10 bg-gray-50 border-gray-200 font-semibold text-gray-800 transition-colors" step="0.01" readonly>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Calculado: Consumo×Tarifa - Crédito×TarifaComp + Outros</p>
                    <p class="text-xs text-red-500 mt-1 hidden" id="error-fatura_cgd"></p>
                  </div>
                </div>
              </div>
              
              <!-- Seção EGS -->
              <div class="bg-green-50/50 rounded-xl p-4 border border-green-100">
                <h4 class="text-xs font-semibold text-green-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <i class="fas fa-solar-panel text-green-500"></i>
                  EGS Energia (R$)
                </h4>
                
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                      <div class="flex items-center gap-1">
                        Boleto EGS
                        <span id="boleto-calctype-badge" class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200" title="Campo Calculado ou Fixo">🔄</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <button id="view-calc-boleto_egs" class="text-gray-400 hover:text-blue-600 focus:outline-none transition-colors" title="Ver Cálculo Detalhado">
                           <i class="fas fa-eye text-xs"></i>
                         </button>
                        <span class="text-xs text-gray-500">Modo:</span>
                        <label class="relative inline-flex items-center cursor-pointer" title="Fixar valor (sobrescrever cálculo da tarifa)">
                          <input type="checkbox" id="edit-boleto_fixo" class="sr-only peer">
                          <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <span id="boleto-mode-badge" class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 border border-blue-200 transition-colors">FIXO</span>
                      </div>
                    </label>
                    <div class="relative">
                      <span class="absolute left-3 top-2.5 text-gray-400 text-sm">R$</span>
                      <input type="number" id="edit-boleto_egs" class="input pl-10 font-bold text-lg text-blue-700" step="0.01">
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Edite diretamente ou use Tarifa EGS × Crédito</p>
                    <p class="text-xs text-red-500 mt-1 hidden" id="error-boleto_egs"></p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Coluna 3: Simulação de Resultados -->
            <div class="space-y-6">
              
              <!-- Card de Economia -->
              <div class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
                <h4 class="text-xs font-semibold uppercase tracking-wide opacity-80 mb-3 flex items-center gap-2">
                  <i class="fas fa-piggy-bank"></i>
                  Economia do Mês
                </h4>
                <div class="text-3xl font-bold" id="res-economia_mes">R$ 0,00</div>
                <p class="text-xs opacity-70 mt-2">
                  Diferença entre custo SEM e COM geração distribuída
                </p>
              </div>
              
              <!-- Detalhamento -->
              <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <i class="fas fa-calculator text-gray-400"></i>
                  Detalhamento
                </h4>
                
                <div class="space-y-3">
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600">Custo SEM GD</span>
                    <span id="res-custo_sem_gd" class="font-medium text-gray-900">R$ 0,00</span>
                  </div>
                  
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600">(-) Fatura Distribuidora</span>
                    <span id="res-fatura_cgd" class="font-medium text-gray-700">R$ 0,00</span>
                  </div>
                  
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600">(-) Boleto EGS</span>
                    <span id="res-boleto_egs" class="font-medium text-gray-700">R$ 0,00</span>
                  </div>
                  
                  <div class="pt-3 border-t border-gray-200">
                    <div class="flex justify-between items-center">
                      <span class="text-sm font-semibold text-gray-900">= Custo COM GD (Total)</span>
                      <span id="res-custo_com_gd" class="text-lg font-bold text-primary">R$ 0,00</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Métricas Ambientais -->
              <div class="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                <h4 class="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <i class="fas fa-leaf text-emerald-500"></i>
                  Impacto Ambiental
                </h4>
                
                <div class="grid grid-cols-2 gap-3">
                  <div class="text-center p-2 bg-white rounded-lg">
                    <div id="res-co2" class="text-lg font-bold text-emerald-600">0 kg</div>
                    <div class="text-xs text-gray-500">CO₂ evitado</div>
                  </div>
                  <div class="text-center p-2 bg-white rounded-lg">
                    <div id="res-arvores" class="text-lg font-bold text-emerald-600">0</div>
                    <div class="text-xs text-gray-500">Árvores equiv.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center rounded-b-2xl sticky bottom-0">
          <div class="text-xs text-gray-500">
            <i class="fas fa-info-circle mr-1"></i>
            Campos com <span class="text-purple-500">⚡</span> são calculados automaticamente
          </div>
          <div class="flex gap-3">
            <button id="cancel-edit-btn" class="btn btn-secondary px-6">Cancelar</button>
            <button id="save-edit-btn" class="btn btn-primary px-6 shadow-lg hover:shadow-xl">
              <i class="fas fa-save mr-2"></i>Salvar e Gerar PDF
            </button>
          </div>
        </div>
      </div>

      <!-- Popover de Fórmula (Hidden by default) -->
      <div id="formula-popover" class="hidden absolute z-[60] bg-white rounded-xl shadow-2xl border border-gray-100 p-4 w-80 transform transition-all duration-200">
        <div class="flex justify-between items-start mb-3 border-b border-gray-50 pb-2">
          <h5 class="text-sm font-bold text-gray-900 flex items-center gap-2">
            <i class="fas fa-calculator text-blue-500"></i>
            <span id="popover-title">Cálculo Detalhado</span>
          </h5>
          <button id="close-popover" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="space-y-3">
          <div>
            <p class="text-[10px] text-gray-500 uppercase font-semibold mb-1">Fórmula</p>
            <div id="popover-formula" class="bg-gray-50 rounded p-2 text-xs font-mono text-blue-700 break-words border border-blue-50">
              <!-- A + B - C -->
            </div>
          </div>
          
          <div>
            <p class="text-[10px] text-gray-500 uppercase font-semibold mb-1">Valores Reais</p>
            <div id="popover-values" class="bg-white rounded p-2 text-xs text-gray-700 space-y-1 border border-gray-100">
              <!-- A = 100 -->
            </div>
          </div>
          
          <div class="pt-2 border-t border-gray-50 flex justify-between items-center">
            <span class="text-xs font-medium text-gray-500">Resultado</span>
            <span id="popover-result" class="text-base font-bold text-gray-900">R$ 0,00</span>
          </div>
        </div>
        
        <!-- Seta do Popover -->
        <div id="popover-arrow" class="absolute w-3 h-3 bg-white border-l border-b border-gray-100 transform rotate-45 -bottom-1.5 left-1/2 -translate-x-1/2"></div>
      </div>
    </div>
  `;
}