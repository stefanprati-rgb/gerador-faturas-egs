import './styles/main.css';
import router from './router.js';

import { renderGerador, initGerador } from './modules/gerador/index.js';
import { renderProcessador, initProcessador } from './modules/processador/index.js';
import { renderCorretor, initCorretor } from './modules/corretor/index.js';
import excelProcessor from './core/excelProcessor.js';
import notification from './components/Notification.js';
// Template do PDF agora é gerao no server-side
// import { getPDFTemplate } from './modules/gerador/pdfTemplate.js';

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
            // Mostrar loading inicial
            this.showLoading('Inicializando aplicação...');

            // 1. Injetar Template PDF (Removido - Server Side)
            // this.injectGlobalResources();

            // 2. Configurar menu mobile
            this.setupMobileMenu();

            // 3. Registrar rotas
            this.registerRoutes();

            // 4. Inicializar router
            router.init();

            // 5. Esconder loading (App interativa)
            this.hideLoading();

            // Mensagem de boas-vindas
            notification.success('Sistema carregado com sucesso!', 3000);

            // 6. Pré-carregar Pyodide em background
            this.preloadEngine();

        } catch (error) {
            console.error('Erro ao inicializar aplicação:', error);
            if (this.loadingStatus) this.loadingStatus.textContent = 'Erro ao carregar aplicação';
            notification.error('Erro ao carregar aplicação. Por favor, recarregue a página.');
        }
    }

    /**
     * Injeta recursos globais ocultos (Templates, Modais globais)
     */
    injectGlobalResources() {
        // Verifica se já existe para não duplicar
        if (!document.getElementById('pdf-container')) {
            const div = document.createElement('div');
            // O template já vem com styles de ocultação (position: fixed; left: -9999px)
            div.innerHTML = getPDFTemplate();
            document.body.appendChild(div);
            console.log('Template PDF injetado no DOM.');
        }
    }

    /**
     * Inicia o carregamento do motor Python em background
     */
    async preloadEngine() {
        console.log('Iniciando pré-carregamento do Pyodide...');

        // Elementos do indicador de progresso
        const progressOverlay = document.getElementById('progress-overlay');
        const progressStatus = document.getElementById('progress-status');
        const progressDetail = document.getElementById('progress-detail');
        const progressBar = document.getElementById('progress-bar');

        // Mostrar overlay de progresso
        if (progressOverlay) {
            progressOverlay.classList.remove('hidden');
        }

        const updateProgress = (status, percent) => {
            if (progressStatus) progressStatus.textContent = status;
            if (progressDetail) progressDetail.textContent = `${percent}%`;
            if (progressBar) progressBar.style.width = `${percent}%`;
        };

        try {
            updateProgress('Inicializando motor Python...', 0);

            await excelProcessor.init((status) => {
                console.log(`[Pyodide Background]: ${status}`);

                // Mapear mensagens de status para progresso
                if (status.includes('Carregando Pyodide')) {
                    updateProgress('Carregando Pyodide...', 20);
                } else if (status.includes('Carregando pacotes')) {
                    updateProgress('Carregando bibliotecas Python...', 40);
                } else if (status.includes('Instalando openpyxl')) {
                    updateProgress('Instalando openpyxl...', 60);
                } else if (status.includes('Configurando motor')) {
                    updateProgress('Configurando processador...', 80);
                }
            });

            updateProgress('Motor Python pronto!', 100);
            console.log('Motor Python pronto para uso!');

            // Esconder overlay após 500ms
            setTimeout(() => {
                if (progressOverlay) progressOverlay.classList.add('hidden');
            }, 500);

        } catch (e) {
            console.warn('Pré-carregamento do Pyodide falhou (será tentado novamente ao usar a ferramenta).', e);
            updateProgress('Erro ao carregar motor Python', 0);

            // Esconder overlay após 2s em caso de erro
            setTimeout(() => {
                if (progressOverlay) progressOverlay.classList.add('hidden');
            }, 2000);
        }
    }

    /**
     * Registra as rotas da aplicação
     */
    registerRoutes() {
        // Rota inicial - Redireciona para o Processador
        router.register('/', async () => {
            router.navigate('/processador');
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
        const mobileNav = document.getElementById('mobile-nav'); // Nota: Verifique se este ID existe no seu HTML atualizado

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