
import { recalculateInvoice } from './InvoiceRecalculator.js';

/**
 * Aplica uma alteração em massa numa lista de clientes
 * @param {Array} clientes - Lista total de clientes
 * @param {Set} selectedIds - IDs dos clientes selecionados
 * @param {string} campo - Campo a ser alterado (ex: 'tarifa_fp')
 * @param {string} operacao - Tipo de operação ('set', 'add_percent', 'sub_percent', 'add_value')
 * @param {number} valor - Valor da operação
 * @returns {Array} - Nova lista de clientes com alterações aplicadas
 */
export function applyBulkAction(clientes, selectedIds, campo, operacao, valor) {
    return clientes.map(cliente => {
        // Se não estiver selecionado, mantém original
        if (!selectedIds.has(cliente.id)) {
            return cliente;
        }

        // Extrair valor atual base
        // Mapeamento de campos do cliente para campos do recálculo
        const mapCampos = {
            'tarifa_fp': 'dist_consumo_tar',
            'tarifa_comp_fp': 'dist_comp_tar',
            'tarifa_egs': 'det_credito_tar',
            'outros': 'dist_outros'
        };

        const campoCliente = mapCampos[campo] || campo;
        const valorAtual = parseFloat(cliente[campoCliente] || 0);
        let novoValor = valorAtual;

        // Aplicar operação
        switch (operacao) {
            case 'set':
                novoValor = valor;
                break;
            case 'add_percent':
                novoValor = valorAtual * (1 + valor / 100);
                break;
            case 'sub_percent':
                novoValor = valorAtual * (1 - valor / 100);
                break;
            case 'add_value':
                novoValor = valorAtual + valor;
                break;
        }

        // Garantir não negativo se necessário
        if (novoValor < 0) novoValor = 0;

        // Criar objeto de edições para o recalculador
        // O recalculador espera nomes de chaves internos (ex: 'tarifa_fp', não 'dist_consumo_tar')
        const edicoes = {};
        edicoes[campo] = novoValor;

        // Recalcular cliente
        // Atenção: recalculateInvoice retorna um novo objeto cliente
        return recalculateInvoice(cliente, edicoes);
    });
}
