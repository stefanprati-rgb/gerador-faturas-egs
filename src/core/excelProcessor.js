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
import configJson from '../python/config.json?raw';


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

            // **Escrever config.json no filesystem virtual do Pyodide**
            try {
                this.pyodide.FS.writeFile('/config.json', configJson, { encoding: 'utf8' });
                console.log('✓ config.json carregado no filesystem do Pyodide');
            } catch (fsError) {
                console.warn('⚠ Não foi possível escrever config.json no Pyodide:', fsError);
            }

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

    /**
     * Carrega base de clientes externa no Pyodide
     */
    async loadExternalClientDatabase(file) {
        if (!this.isLoaded) {
            await this.init();
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Escrever arquivo no filesystem do Pyodide
            this.pyodide.FS.writeFile('/external_client_db.xlsx', uint8Array);
            console.log('✓ Base de clientes externa carregada no Pyodide');

            // Atualizar config.json para apontar para o arquivo carregado
            const config = JSON.parse(configJson);
            config.client_database_path = '/external_client_db.xlsx';
            this.pyodide.FS.writeFile('/config.json', JSON.stringify(config), { encoding: 'utf8' });

            return { success: true, fileName: file.name };
        } catch (error) {
            console.error('Erro ao carregar base de clientes:', error);
            throw new Error('Falha ao carregar base de clientes: ' + error.message);
        }
    }

    /**
     * Verifica status da base de clientes externa
     */
    async getExternalDatabaseStatus() {
        if (!this.isLoaded) {
            return { loaded: false, recordCount: 0 };
        }

        try {
            // Verificar se o arquivo existe no filesystem
            const files = this.pyodide.FS.readdir('/');
            const hasExternalDb = files.includes('external_client_db.xlsx');

            if (hasExternalDb) {
                // Tentar obter contagem de registros via Python
                try {
                    const result = this.pyodide.runPython(`
import json
try:
    config = carregar_config()
    if config.get('enable_external_client_db'):
        mapa = carregar_base_clientes_externa(config)
        json.dumps({"loaded": True, "recordCount": len(mapa)})
    else:
        json.dumps({"loaded": False, "recordCount": 0})
except:
    json.dumps({"loaded": False, "recordCount": 0})
                    `);
                    return JSON.parse(result);
                } catch {
                    return { loaded: true, recordCount: 0 };
                }
            }

            return { loaded: false, recordCount: 0 };
        } catch (error) {
            console.error('Erro ao verificar status da base:', error);
            return { loaded: false, recordCount: 0 };
        }
    }

    /**
     * Remove base de clientes externa
     */
    async clearExternalDatabase() {
        if (!this.isLoaded) {
            return;
        }

        try {
            // Remover arquivo do filesystem
            try {
                this.pyodide.FS.unlink('/external_client_db.xlsx');
            } catch (e) {
                // Arquivo pode não existir
            }

            // Restaurar config.json original
            this.pyodide.FS.writeFile('/config.json', configJson, { encoding: 'utf8' });

            console.log('✓ Base de clientes externa removida');
            return { success: true };
        } catch (error) {
            console.error('Erro ao remover base de clientes:', error);
            throw new Error('Falha ao remover base de clientes: ' + error.message);
        }
    }
}

export default new ExcelProcessor();