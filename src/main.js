import './styles/main.css';
import router from './router.js';

import { renderGerador, initGerador } from './modules/gerador/index.js';
import { renderProcessador, initProcessador } from './modules/processador/index.js';
import { renderCorretor, initCorretor } from './modules/corretor/index.js';
import notification from './components/Notification.js';

/**
 * Inicialização da aplicação
 */
class App {
    constructor() {
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingStatus = document.getElementById('loading-status');
    }

    /**
     * Inicializa a aplicação
     */
    async init() {
        try {
            // Mostrar loading
            this.showLoading('Inicializando aplicação...');

            // Configurar menu mobile
            this.setupMobileMenu();

            // Registrar rotas
            this.registerRoutes();

            // Inicializar router
            router.init();

            // Esconder loading
            this.hideLoading();

            // Mensagem de boas-vindas
            notification.success('Sistema carregado com sucesso!', 3000);

        } catch (error) {
            console.error('Erro ao inicializar aplicação:', error);
            this.loadingStatus.textContent = 'Erro ao carregar aplicação';
            notification.error('Erro ao carregar aplicação. Por favor, recarregue a página.');
        }
    }

    /**
     * Registra as rotas da aplicação
     */
    registerRoutes() {
        // Rota inicial
        // Rota inicial - Redireciona para o Processador
        router.register('/', async () => {
            router.navigate('/processador');
            // Opcional: renderizar o processador diretamente se a navegação não disparar renderização imediata
            // mas o router.navigate deve lidar com isso via hashchange
        });

        // Gerador de Faturas
        router.register('/gerador', async () => {
            const content = await renderGerador();
            setTimeout(() => initGerador(), 100);
            return content;
        });

        // Processador de Planilhas
        router.register('/processador', async () => {
            const content = await renderProcessador();
            setTimeout(() => initProcessador(), 100);
            return content;
        });

        // Corretor de Faturas
        router.register('/corretor', async () => {
            const content = await renderCorretor();
            setTimeout(() => initCorretor(), 100);
            return content;
        });
    }

    /**
     * Configura menu mobile
     */
    setupMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileNav = document.getElementById('mobile-nav');

        if (mobileMenuBtn && mobileNav) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileNav.classList.toggle('hidden');
            });

            // Fechar menu ao clicar em um link
            mobileNav.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') {
                    mobileNav.classList.add('hidden');
                }
            });
        }
    }

    /**
     * Mostra overlay de loading
     * @param {string} message - Mensagem a ser exibida
     */
    showLoading(message = 'Carregando...') {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex';
            if (this.loadingStatus) {
                this.loadingStatus.textContent = message;
            }
        }
    }

    /**
     * Esconde overlay de loading
     */
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    }
}

// Inicializar aplicação quando DOM estiver pronto
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());

export default app;
