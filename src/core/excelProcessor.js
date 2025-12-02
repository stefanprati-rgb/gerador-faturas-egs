/**
 * Módulo de processamento Excel com Pyodide
 */

import CONSTANTS from '../utils/constants.js';
import notification from '../components/Notification.js';

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

            // Carregar pandas
            await this.pyodide.loadPackage(['pandas', 'micropip']);

            if (statusCallback) statusCallback('Instalando openpyxl...');

            // Instalar openpyxl
            await this.pyodide.pyimport('micropip').install('openpyxl');

            if (statusCallback) statusCallback('Carregando script de processamento...');

            // Carregar script Python
            const response = await fetch('/src/python/processor.py');
            const pythonCode = await response.text();
            this.pyodide.runPython(pythonCode);

            this.isLoaded = true;
            this.isLoading = false;

            return true;
        } catch (error) {
            this.isLoading = false;
            console.error('Erro ao inicializar Pyodide:', error);
            notification.error('Erro ao carregar ambiente Python');
            throw error;
        }
    }

    /**
     * Processa arquivo Excel
     * @param {File} file - Arquivo Excel
     * @param {string} mesReferencia - Mês no formato YYYY-MM
     * @param {string} dataVencimento - Data no formato YYYY-MM-DD
     * @returns {Promise<Array>} Lista de clientes processados
     */
    async processFile(file, mesReferencia, dataVencimento) {
        if (!this.isLoaded) {
            throw new Error('Pyodide não está carregado. Chame init() primeiro.');
        }

        try {
            // Ler arquivo como ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Passar para Python
            this.pyodide.globals.set('file_content_js', this.pyodide.toPy(uint8Array));
            this.pyodide.globals.set('mes_referencia_js', mesReferencia + '-01');
            this.pyodide.globals.set('vencimento_js', dataVencimento);

            // Executar processamento
            const resultJson = await this.pyodide.runPythonAsync(
                'processar_relatorio_para_fatura(file_content_js, mes_referencia_js, vencimento_js)'
            );

            // Parsear resultado
            const result = JSON.parse(resultJson);

            // Verificar erro
            if (result.error) {
                throw new Error(result.error);
            }

            return result;
        } catch (error) {
            console.error('Erro ao processar arquivo:', error);
            throw error;
        }
    }
}

export default new ExcelProcessor();
