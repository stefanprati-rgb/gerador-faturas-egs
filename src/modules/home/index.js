/**
 * Página inicial
 */
export function renderHome() {
    return `
    <div class="max-w-4xl mx-auto">
      <!-- Hero Section -->
      <div class="text-center mb-12">
        <h1 class="text-5xl font-bold mb-4">Sistema de Faturas EGS</h1>
        <p class="text-xl text-text-muted">
          Plataforma unificada para geração, processamento e correção de faturas
        </p>
      </div>

      <!-- Cards de Funcionalidades -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <!-- Gerador -->
        <a href="#/gerador" class="card hover:shadow-lg transition-shadow cursor-pointer group">
          <div class="text-center">
            <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <i class="fas fa-file-pdf text-3xl text-primary group-hover:text-white"></i>
            </div>
            <h3 class="text-xl font-semibold mb-2">Gerador de Faturas</h3>
            <p class="text-text-muted text-sm">
              Gere faturas em PDF a partir de planilhas Excel com cálculos automáticos
            </p>
          </div>
        </a>

        <!-- Processador -->
        <a href="#/processador" class="card hover:shadow-lg transition-shadow cursor-pointer group">
          <div class="text-center">
            <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <i class="fas fa-cogs text-3xl text-primary group-hover:text-white"></i>
            </div>
            <h3 class="text-xl font-semibold mb-2">Processador</h3>
            <p class="text-text-muted text-sm">
              Processe e valide dados de planilhas com regras personalizadas
            </p>
          </div>
        </a>

        <!-- Corretor -->
        <a href="#/corretor" class="card hover:shadow-lg transition-shadow cursor-pointer group">
          <div class="text-center">
            <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <i class="fas fa-edit text-3xl text-primary group-hover:text-white"></i>
            </div>
            <h3 class="text-xl font-semibold mb-2">Corretor de Faturas</h3>
            <p class="text-text-muted text-sm">
              Edite e recalcule faturas já processadas com facilidade
            </p>
          </div>
        </a>
      </div>

      <!-- Informações Adicionais -->
      <div class="card bg-primary/5 border-primary/20">
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0">
            <i class="fas fa-info-circle text-3xl text-primary"></i>
          </div>
          <div>
            <h3 class="text-lg font-semibold mb-2">Como usar</h3>
            <ol class="list-decimal list-inside space-y-2 text-text-muted">
              <li>Escolha a funcionalidade desejada acima</li>
              <li>Faça upload da planilha Excel</li>
              <li>Configure os parâmetros necessários</li>
              <li>Processe e baixe os resultados</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- Estatísticas -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <div class="card text-center">
          <div class="text-3xl font-bold text-primary mb-1">3</div>
          <div class="text-sm text-text-muted">Módulos</div>
        </div>
        <div class="card text-center">
          <div class="text-3xl font-bold text-success mb-1">100%</div>
          <div class="text-sm text-text-muted">Automático</div>
        </div>
        <div class="card text-center">
          <div class="text-3xl font-bold text-warning mb-1">10MB</div>
          <div class="text-sm text-text-muted">Máx. Arquivo</div>
        </div>
        <div class="card text-center">
          <div class="text-3xl font-bold text-error mb-1">PDF</div>
          <div class="text-sm text-text-muted">Formato</div>
        </div>
      </div>
    </div>
  `;
}
