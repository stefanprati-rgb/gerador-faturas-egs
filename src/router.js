/**
 * Sistema de rotas SPA
 */
class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.contentContainer = null;

        // Bind de métodos
        this.navigate = this.navigate.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
    }

    /**
     * Inicializa o router
     */
    init() {
        this.contentContainer = document.getElementById('main-content');

        // Listener para navegação
        window.addEventListener('hashchange', this.handlePopState);
        window.addEventListener('load', this.handlePopState);

        // Listener para links de navegação
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="#"]');
            if (link) {
                e.preventDefault();
                const route = link.getAttribute('href').substring(1);
                this.navigate(route);
            }
        });

        // Atualizar navegação ativa
        this.updateActiveNav();
    }

    /**
     * Registra uma rota
     * @param {string} path - Caminho da rota
     * @param {Function} handler - Função que renderiza o conteúdo
     */
    register(path, handler) {
        this.routes[path] = handler;
    }

    /**
     * Navega para uma rota
     * @param {string} path - Caminho da rota
     */
    navigate(path) {
        window.location.hash = path;
    }

    /**
     * Handler para mudança de rota
     */
    async handlePopState() {
        const hash = window.location.hash.substring(1) || '/';
        const route = this.routes[hash] || this.routes['/'];

        if (route && this.contentContainer) {
            this.currentRoute = hash;

            // Renderizar conteúdo
            try {
                const content = await route();
                this.contentContainer.innerHTML = content;

                // Atualizar navegação ativa
                this.updateActiveNav();

                // Scroll para o topo
                window.scrollTo(0, 0);
            } catch (error) {
                console.error('Erro ao carregar rota:', error);
                this.contentContainer.innerHTML = `
          <div class="text-center py-20">
            <i class="fas fa-exclamation-triangle text-6xl text-error mb-4"></i>
            <h2 class="text-2xl font-bold mb-2">Erro ao carregar página</h2>
            <p class="text-text-muted">Por favor, tente novamente.</p>
          </div>
        `;
            }
        }
    }

    /**
     * Atualiza links de navegação ativos
     */
    updateActiveNav() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const route = link.getAttribute('data-route');
            if (route === this.currentRoute) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
}

export default new Router();
