import CONSTANTS from '../utils/constants.js';

/**
 * Valida arquivo de upload
 * @param {File} file - Arquivo a ser validado
 * @returns {object} { valid: boolean, error: string|null }
 */
export function validateFile(file) {
    if (!file) {
        return { valid: false, error: 'Nenhum arquivo selecionado' };
    }

    // Validar tamanho
    if (file.size > CONSTANTS.MAX_FILE_SIZE) {
        return { valid: false, error: CONSTANTS.MESSAGES.FILE_TOO_LARGE };
    }

    // Validar tipo
    if (!CONSTANTS.ALLOWED_FILE_TYPES.includes(file.type)) {
        // Fallback: validar por extensão
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!CONSTANTS.ALLOWED_EXTENSIONS.includes(extension)) {
            return { valid: false, error: CONSTANTS.MESSAGES.INVALID_FILE_TYPE };
        }
    }

    return { valid: true, error: null };
}

/**
 * Valida campo de data
 * @param {string} date - Data no formato YYYY-MM-DD
 * @returns {object} { valid: boolean, error: string|null }
 */
export function validateDate(date) {
    if (!date) {
        return { valid: false, error: 'Data é obrigatória' };
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
        return { valid: false, error: 'Data inválida' };
    }

    return { valid: true, error: null };
}

/**
 * Valida campo de mês
 * @param {string} month - Mês no formato YYYY-MM
 * @returns {object} { valid: boolean, error: string|null }
 */
export function validateMonth(month) {
    if (!month) {
        return { valid: false, error: 'Mês é obrigatório' };
    }

    const regex = /^\d{4}-\d{2}$/;
    if (!regex.test(month)) {
        return { valid: false, error: 'Formato de mês inválido' };
    }

    return { valid: true, error: null };
}

/**
 * Valida número
 * @param {any} value - Valor a ser validado
 * @param {object} options - Opções de validação
 * @returns {object} { valid: boolean, error: string|null }
 */
export function validateNumber(value, options = {}) {
    const { min, max, required = false } = options;

    if (required && (value === null || value === undefined || value === '')) {
        return { valid: false, error: 'Campo obrigatório' };
    }

    const num = Number(value);
    if (isNaN(num)) {
        return { valid: false, error: 'Valor deve ser um número' };
    }

    if (min !== undefined && num < min) {
        return { valid: false, error: `Valor mínimo é ${min}` };
    }

    if (max !== undefined && num > max) {
        return { valid: false, error: `Valor máximo é ${max}` };
    }

    return { valid: true, error: null };
}

/**
 * Valida formulário completo
 * @param {object} formData - Dados do formulário
 * @param {object} rules - Regras de validação
 * @returns {object} { valid: boolean, errors: object }
 */
export function validateForm(formData, rules) {
    const errors = {};
    let valid = true;

    for (const [field, rule] of Object.entries(rules)) {
        const value = formData[field];
        let result;

        switch (rule.type) {
            case 'file':
                result = validateFile(value);
                break;
            case 'date':
                result = validateDate(value);
                break;
            case 'month':
                result = validateMonth(value);
                break;
            case 'number':
                result = validateNumber(value, rule.options);
                break;
            default:
                result = { valid: true, error: null };
        }

        if (!result.valid) {
            errors[field] = result.error;
            valid = false;
        }
    }

    return { valid, errors };
}
