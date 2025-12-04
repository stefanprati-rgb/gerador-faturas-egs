import notification from '../components/Notification.js';

class StateManager {
    constructor() {
        this.state = {
            file: null,
            processedData: [],
            validationWarnings: [], // Armazena alertas de validação
            meta: {
                fileName: null,
                fileSize: 0,
                uploadTime: null
            },
            params: {
                mesReferencia: '',
                dataVencimento: ''
            }
        };
        this.listeners = [];
    }

    /**
     * Define o arquivo atual e limpa dados processados anteriores
     */
    setFile(file) {
        if (this.state.file) {
            console.warn('Substituindo arquivo existente...');
        }
        this.state.file = file;
        this.state.meta = {
            fileName: file.name,
            fileSize: file.size,
            uploadTime: new Date()
        };
        
        // Ao trocar o arquivo, invalidamos os dados processados antigos
        this.state.processedData = [];
        this.state.validationWarnings = [];
        
        this.notify();
    }

    /**
     * Define os dados processados e avisos retornados pelo Python
     * Aceita tanto o formato novo {data, warnings} quanto array simples
     */
    setProcessedResult(result) {
        if (Array.isArray(result)) {
            this.state.processedData = result;
            this.state.validationWarnings = [];
        } else {
            this.state.processedData = result.data || [];
            this.state.validationWarnings = result.warnings || [];
        }
        this.notify();
    }

    // Alias para compatibilidade, caso algum módulo antigo ainda chame assim
    setProcessedData(data) {
        this.setProcessedResult(data);
    }

    /**
     * Atualiza parâmetros globais (datas)
     */
    setParams(params) {
        this.state.params = { ...this.state.params, ...params };
        this.notify();
    }

    getState() {
        return { ...this.state };
    }

    hasFile() {
        return !!this.state.file;
    }

    hasData() {
        return this.state.processedData && this.state.processedData.length > 0;
    }

    /**
     * Remove o arquivo atual (limpeza manual)
     */
    clearFile() {
        this.state.file = null;
        this.state.meta = null;
        this.state.processedData = [];
        this.state.validationWarnings = [];
        this.notify();
    }

    /**
     * Limpa apenas os dados processados
     */
    clearProcessedData() {
        this.state.processedData = [];
        this.state.validationWarnings = [];
        this.notify();
    }

    /**
     * Reseta o sistema completamente (usado pelo botão Reset)
     */
    reset() {
        this.state = {
            file: null,
            processedData: [],
            validationWarnings: [],
            meta: { fileName: null, fileSize: 0, uploadTime: null },
            params: { mesReferencia: '', dataVencimento: '' }
        };
        notification.info('Sistema resetado. Pronto para novo arquivo.');
        this.notify('RESET');
    }

    /**
     * Inscreve um listener para mudanças de estado
     */
    subscribe(callback) {
        this.listeners.push(callback);
        // Retorna função para cancelar inscrição (unsubscribe)
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Notifica todos os ouvintes
     */
    notify(action = 'UPDATE') {
        // Passamos o estado e a ação para os ouvintes
        this.listeners.forEach(callback => callback(this.state, action));
    }
}

// Exporta instância única (Singleton)
export default new StateManager();