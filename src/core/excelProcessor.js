import CONSTANTS from '../utils/constants.js';
import notification from '../components/Notification.js';

class ExcelProcessor {
    constructor() {
        this.pyodide = null;
        this.isLoaded = false;
        this.isLoading = false;
    }

    async init(statusCallback) {
        if (this.isLoaded) return true;
        if (this.isLoading) {
            while (this.isLoading) await new Promise(r => setTimeout(r, 100));
            return this.isLoaded;
        }

        this.isLoading = true;
        try {
            if (statusCallback) statusCallback('Carregando Pyodide...');
            this.pyodide = await loadPyodide();

            if (statusCallback) statusCallback('Carregando bibliotecas...');
            await this.pyodide.loadPackage(['pandas', 'micropip']);
            await this.pyodide.pyimport('micropip').install('openpyxl');

            if (statusCallback) statusCallback('Configurando motor...');
            // Carregar script Python atualizado
            const response = await fetch('/src/python/processor.py');
            if (!response.ok) throw new Error('Falha ao carregar script Python');
            const pythonCode = await response.text();
            this.pyodide.runPython(pythonCode);

            this.isLoaded = true;
            this.isLoading = false;
            return true;
        } catch (error) {
            this.isLoading = false;
            console.error(error);
            notification.error('Falha ao iniciar processador');
            throw error;
        }
    }

    async processFile(file, mesReferencia, dataVencimento) {
        if (!this.isLoaded) throw new Error('Sistema não inicializado.');

        try {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);

            this.pyodide.globals.set('file_content_js', this.pyodide.toPy(data));
            this.pyodide.globals.set('mes_referencia_js', mesReferencia + '-01');
            this.pyodide.globals.set('vencimento_js', dataVencimento);

            const resultJson = await this.pyodide.runPythonAsync(
                'processar_relatorio_para_fatura(file_content_js, mes_referencia_js, vencimento_js)'
            );

            const result = JSON.parse(resultJson);

            if (result.error) throw new Error(result.error);

            // Suporte para o novo formato { data, warnings }
            // Se vier array direto (legado), normaliza
            if (Array.isArray(result)) {
                return { data: result, warnings: [] };
            }

            return result; // Retorna { data: [...], warnings: [...] }

        } catch (error) {
            console.error('Erro no processamento:', error);
            throw error;
        }
    }
}

export default new ExcelProcessor();
