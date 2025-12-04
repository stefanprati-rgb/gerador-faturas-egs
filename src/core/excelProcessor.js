/**
 * Módulo de processamento Excel com Pyodide
 */

import notification from '../components/Notification.js';
// Importação estática garante que o conteúdo do arquivo seja incluído no bundle final como string
import pythonProcessorCode from '../python/processor.py?raw';

class ExcelProcessor {
    constructor() {
        this.pyodide = null;
        this.isLoaded = false;
        this.isLoading = false;
    }

    /**
     * Inicializa o Pyodide
     */
    async init(statusCallback) {
        if (this.isLoaded) return true;
        if (this.isLoading) {
            // Aguardar carregamento em andamento
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.isLoaded;
        }

        this.isLoading = true;

        try {
            if (statusCallback) statusCallback('Carregando Pyodide...');

            // Carregar Pyodide
            this.pyodide = await loadPyodide();

            if (statusCallback) statusCallback('Carregando pacotes Python...');

            // Carregar pandas e dependências
            await this.pyodide.loadPackage(['pandas', 'micropip']);

            if (statusCallback) statusCallback('Instalando openpyxl...');

            // Instalar openpyxl via micropip
            await this.pyodide.pyimport('micropip').install('openpyxl');

            if (statusCallback) statusCallback('Configurando motor de processamento...');

            // Executar o script Python carregado estaticamente
            // Não usamos mais fetch aqui para evitar erros de rota (404/HTML)
            try {
                this.pyodide.runPython(pythonProcessorCode);
            } catch (pyError) {
                console.error('Erro ao executar script Python inicial:', pyError);
                throw new Error('Falha na inicialização do código Python.');
            }

            this.isLoaded = true;
            this.isLoading = false;

            return true;
        } catch (error) {
            this.isLoading = false;
            console.error('Erro ao inicializar Pyodide:', error);
            notification.error('Erro crítico ao carregar ambiente de processamento.');
            throw error;
        }
    }

    /**
     * Processa arquivo Excel
     * @param {File} file - Arquivo Excel
     * @param {string} mesReferencia - Mês no formato YYYY-MM
     * @param {string} dataVencimento - Data no formato YYYY-MM-DD
     * @returns {Promise<Object>} Resultado { data, warnings }
     */
    async processFile(file, mesReferencia, dataVencimento) {
        if (!this.isLoaded) {
            // Tenta inicializar se ainda não estiver pronto
            await this.init();
        }

        try {
            // Ler arquivo como ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Passar variáveis para o escopo global do Python
            this.pyodide.globals.set('file_content_js', this.pyodide.toPy(uint8Array));
            this.pyodide.globals.set('mes_referencia_js', mesReferencia + '-01');
            this.pyodide.globals.set('vencimento_js', dataVencimento);

            // Executar a função de processamento definida no Python
            const resultJson = await this.pyodide.runPythonAsync(
                'processar_relatorio_para_fatura(file_content_js, mes_referencia_js, vencimento_js)'
            );

            // Parsear resultado
            const result = JSON.parse(resultJson);

            // Verificar se houve erro retornado pelo Python
            if (result.error) {
                throw new Error(result.error);
            }

            // Normalizar retorno (compatibilidade com versões anteriores que retornavam array puro)
            if (Array.isArray(result)) {
                return { data: result, warnings: [] };
            }

            return result;
        } catch (error) {
            console.error('Erro no processamento Python:', error);
            throw error;
        }
    }
}

export default new ExcelProcessor();