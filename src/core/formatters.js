/**
 * Formata um valor numérico como moeda brasileira
 * @param {number} value - Valor a ser formatado
 * @returns {string} Valor formatado como R$ X.XXX,XX
 */
export function formatCurrency(value) {
    return (value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

/**
 * Formata um número com casas decimais
 * @param {number} value - Valor a ser formatado
 * @param {number} decimals - Número de casas decimais (padrão: 2)
 * @returns {string} Número formatado
 */
export function formatNumber(value, decimals = 2) {
    return (value || 0).toFixed(decimals).replace('.', ',');
}

/**
 * Formata uma data no padrão brasileiro
 * @param {string|Date} date - Data a ser formatada
 * @param {object} options - Opções de formatação
 * @returns {string} Data formatada
 */
export function formatDate(date, options = {}) {
    const defaultOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
        ...options
    };

    const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
    return dateObj.toLocaleDateString('pt-BR', defaultOptions);
}

/**
 * Formata nome de mês
 * @param {string} monthYear - String no formato YYYY-MM
 * @returns {string} Nome do mês capitalizado
 */
export function formatMonthName(monthYear) {
    const date = new Date(monthYear + '-02T00:00:00');
    const monthName = date.toLocaleDateString('pt-BR', {
        month: 'long',
        timeZone: 'UTC'
    });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
}

/**
 * Sanitiza string para nome de arquivo
 * @param {string} str - String a ser sanitizada
 * @returns {string} String sanitizada
 */
export function sanitizeFilename(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_\-]+/gi, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Normaliza string removendo acentos e convertendo para maiúsculas
 * @param {string} str - String a ser normalizada
 * @returns {string} String normalizada
 */
export function normalizeString(str) {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

/**
 * Debounce de função
 * @param {Function} func - Função a ser debounced
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function} Função com debounce
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Converte bytes para formato legível
 * @param {number} bytes - Número de bytes
 * @param {number} decimals - Casas decimais
 * @returns {string} Tamanho formatado
 */
export function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
