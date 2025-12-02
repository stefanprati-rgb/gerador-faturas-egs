// Constantes do sistema
export const CONSTANTS = {
    // Validação de arquivos
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
    ],
    ALLOWED_EXTENSIONS: ['.xlsx', '.xls', '.xlsm'],

    // Cálculos
    CO2_PER_KWH: 0.07,
    TREES_PER_TON_CO2: 8,
    FALLBACK_TARIFA_DIST: 0.916370,
    FALLBACK_TARIFA_COMP_EV: 0.716045,

    // Mensagens
    MESSAGES: {
        FILE_TOO_LARGE: 'Arquivo muito grande. O tamanho máximo permitido é 10MB.',
        INVALID_FILE_TYPE: 'Tipo de arquivo inválido. Por favor, selecione um arquivo Excel (.xls, .xlsx ou .xlsm).',
        PROCESSING: 'Processando...',
        GENERATING_PDF: 'Gerando PDF...',
        DOWNLOADING: 'Baixando...',
        SUCCESS: 'Operação concluída com sucesso!',
        ERROR: 'Ocorreu um erro. Por favor, tente novamente.',
    },

    // Rotas
    ROUTES: {
        HOME: '/',
        GERADOR: '/gerador',
        PROCESSADOR: '/processador',
        CORRETOR: '/corretor',
    },

    // Pyodide
    PYODIDE_VERSION: 'v0.25.1',
    PYODIDE_PACKAGES: ['pandas', 'micropip'],
    PYODIDE_PIP_PACKAGES: ['openpyxl'],
};

export default CONSTANTS;
