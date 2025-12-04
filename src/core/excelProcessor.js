// src/core/excelProcessor.js
/**
 * Módulo de processamento Excel com Pyodide
 */

import notification from '../components/Notification.js';
// Importação estática de todos os novos módulos Python
import utilsNormalizersCode from '../python/utils_normalizers.py?raw';
import excelUtilsCode from '../python/excel_utils.py?raw';
import calculatorsMetricsCode from '../python/calculators_metrics.py?raw';
import mainProcessorCode from '../python/processor.py?raw';


class ExcelProcessor {
    constructor() {
        this.pyodide = null;
        this.isLoaded = false;
        this.isLoading = false;
        // Ordem de execução: Utilitários -> Utils Excel -> Cálculos -> Orquestrador
        this.pythonModules = [
            { name: 'Utils Normalizers', code: utilsNormalizersCode },
            { name: 'Excel Utils', code: excelUtilsCode },
            { name: 'Calculators Metrics', code: calculatorsMetricsCode },
            { name: 'Main Processor', code: mainProcessorCode },
        ];
    }

    /**
     * Inicializa o Pyodide
     */
    async init(statusCallback) {
        if (this.isLoaded) return true;
        if (this.isLoading) {
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.isLoaded;
        }

        this.isLoading = true;

        try {
            if (statusCallback) statusCallback('Carregando Pyodide...');
            this.pyodide = await loadPyodide();

            if (statusCallback) statusCallback('Carregando pacotes Python...');
            await this.pyodide.loadPackage(['pandas', 'micropip']);

            if (statusCallback) statusCallback('Instalando openpyxl...');
            await this.pyodide.pyimport('micropip').install('openpyxl');

            if (statusCallback) statusCallback('Configurando motor de processamento...');

            // **Executar TODOS os scripts Python em ordem**
            for (const module of this.pythonModules) {
                try {
                    this.pyodide.runPython(module.code);
                } catch (pyError) {
                    console.error(`Erro ao executar módulo Python: ${module.name}`, pyError);
                    throw new Error(`Falha na inicialização do código Python: ${module.name}.`);
                }
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
     */
    async processFile(file, mesReferencia, dataVencimento) {
        if (!this.isLoaded) {
            await this.init();
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            this.pyodide.globals.set('file_content_js', this.pyodide.toPy(uint8Array));
            this.pyodide.globals.set('mes_referencia_js', mesReferencia + '-01');
            this.pyodide.globals.set('vencimento_js', dataVencimento);

            // A função processar_relatorio_para_fatura agora está no escopo global
            const resultJson = await this.pyodide.runPythonAsync(
                'processar_relatorio_para_fatura(file_content_js, mes_referencia_js, vencimento_js)'
            );

            const result = JSON.parse(resultJson);

            if (result.error) {
                throw new Error(result.error);
            }

            // O novo formato de retorno é {data, warnings}
            return result;
        } catch (error) {
            console.error('Erro no processamento Python:', error);
            throw error;
        }
    }
}

export default new ExcelProcessor();