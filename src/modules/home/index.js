/**
 * Página Inicial (Dashboard Executivo)
 */

export function renderHome() {
  return `
    <div class="max-w-5xl mx-auto p-6 animate-slide-up">
      <div class="text-center mb-16 pt-8">
        <div class="inline-flex items-center justify-center p-3 bg-blue-50 rounded-2xl mb-6 shadow-sm">
           <svg class="h-10 w-auto text-primary" viewBox="0 0 200 50" fill="currentColor">
              <text x="5" y="35" font-family="-apple-system, sans-serif" font-size="30" font-weight="700">EGS</text>
              <text x="70" y="35" font-family="-apple-system, sans-serif" font-size="30" font-weight="300">energia</text>
           </svg>
        </div>
        <h1 class="text-display text-4xl mb-4">Gestão Inteligente de Faturas</h1>
        <p class="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Sistema unificado para processamento, geração e auditoria de faturas de energia.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        
        <a href="#/processador" class="panel-card interactive group relative overflow-hidden text-left h-full flex flex-col delay-100 animate-slide-up" style="animation-fill-mode: backwards;">
          <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
            <i class="fas fa-cogs text-9xl"></i>
          </div>
          <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-300">
            <i class="fas fa-microchip"></i>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-2">Processador</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-4 flex-grow">
            Importe planilhas brutas, valide dados automaticamente e calcule economias em lote.
          </p>
          <div class="flex items-center text-blue-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
            Começar <i class="fas fa-chevron-right ml-2 text-xs"></i>
          </div>
        </a>

        <a href="#/gerador" class="panel-card interactive group relative overflow-hidden text-left h-full flex flex-col delay-200 animate-slide-up" style="animation-fill-mode: backwards;">
          <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
            <i class="fas fa-file-pdf text-9xl"></i>
          </div>
          <div class="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-300">
            <i class="fas fa-print"></i>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-2">Gerador PDF</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-4 flex-grow">
            Emissão em massa de faturas personalizadas com cálculo de CO₂ e árvores salvas.
          </p>
          <div class="flex items-center text-green-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
            Acessar <i class="fas fa-chevron-right ml-2 text-xs"></i>
          </div>
        </a>

        <a href="#/corretor" class="panel-card interactive group relative overflow-hidden text-left h-full flex flex-col delay-300 animate-slide-up" style="animation-fill-mode: backwards;">
          <div class="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
            <i class="fas fa-edit text-9xl"></i>
          </div>
          <div class="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-300">
            <i class="fas fa-wand-magic-sparkles"></i>
          </div>
          <h3 class="text-lg font-bold text-gray-900 mb-2">Corretor</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-4 flex-grow">
            Ajuste fino de valores, recálculo instantâneo e correção de anomalias pontuais.
          </p>
          <div class="flex items-center text-purple-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
            Editar <i class="fas fa-chevron-right ml-2 text-xs"></i>
          </div>
        </a>

      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-70 animate-fade-in delay-300">
        <div class="text-center p-4">
          <div class="text-2xl font-bold text-gray-900">100%</div>
          <div class="text-xs text-gray-500 uppercase tracking-wide mt-1">Navegador</div>
        </div>
        <div class="text-center p-4">
          <div class="text-2xl font-bold text-gray-900">PDF</div>
          <div class="text-xs text-gray-500 uppercase tracking-wide mt-1">Exportação</div>
        </div>
        <div class="text-center p-4">
          <div class="text-2xl font-bold text-gray-900">Auto</div>
          <div class="text-xs text-gray-500 uppercase tracking-wide mt-1">Validação</div>
        </div>
        <div class="text-center p-4">
          <div class="text-2xl font-bold text-gray-900">Secure</div>
          <div class="text-xs text-gray-500 uppercase tracking-wide mt-1">Local Data</div>
        </div>
      </div>
    </div>
  `;
}

export function initHome() {
  // Dashboard não precisa de inicialização específica
  // Apenas renderiza o conteúdo estático
  console.log('Dashboard Home carregado');
}