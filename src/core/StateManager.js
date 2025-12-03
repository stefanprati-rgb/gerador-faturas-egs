/**
 * StateManager - Single Source of Truth para o estado da aplicação
 */

class StateManager {
    constructor() {
        this.state = {
            file: null,
            meta: null,
            params: {
                mesReferencia: '',
                dataVencimento: ''
            },
            processedData: []
        };
        this.subscribers = [];
    }

    /**
     * Retorna o estado atual
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Define o arquivo carregado
     */
    setFile(file) {
        this.state.file = file;
        this.state.meta = {
            fileName: file.name,
            fileSize: file.size,
            uploadTime: new Date()
        };
        this.notify();
    }

    /**
     * Verifica se há arquivo carregado
     */
    hasFile() {
        return this.state.file !== null;
    }

    /**
     * Remove o arquivo atual
     */
    clearFile() {
        this.state.file = null;
        this.state.meta = null;
        this.state.processedData = [];
        this.notify();
    }

    /**
     * Atualiza parâmetros (mesReferencia, dataVencimento)
     */
    setParams(params) {
        this.state.params = { ...this.state.params, ...params };
        this.notify();
    }

    /**
     * Define os dados processados
     */
    setProcessedData(data) {
        this.state.processedData = data;
        this.notify();
    }

    /**
     * Limpa os dados processados
     */
    clearProcessedData() {
        this.state.processedData = [];
        this.notify();
    }

    /**
     * Reseta todo o estado
     */
    reset() {
        this.state = {
            file: null,
            meta: null,
            params: {
                mesReferencia: '',
                dataVencimento: ''
            },
            processedData: []
        };
        this.notify();
    }

    /**
     * Inscreve um listener para mudanças de estado
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        // Retorna função para cancelar inscrição
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    /**
     * Notifica todos os subscribers sobre mudança de estado
     */
    notify() {
        this.subscribers.forEach(callback => callback(this.getState()));
    }
}

// Exporta instância única (singleton)
const stateManager = new StateManager();
export default stateManager;