// src/modules/corretor/services/InvoiceRecalculator.js

/**
 * Recalcula todos os valores da fatura com base nos inputs do usuário (_editor).
 * Esta lógica deve ser idêntica à do Pyodide para garantir consistência.
 * @param {object} client - Dados originais do cliente.
 * @returns {object} Dados do cliente com métricas recalculadas.
 */
export function recalculateInvoice(client) {
    const d = { ...client };

    if (!d._editor) {
        // Inicializa o objeto _editor se for a primeira vez
        const consumo_total_val = d.dist_consumo_qtd * d.dist_consumo_tar;
        const comp_total_val_dist = d.det_credito_qtd * d.dist_comp_tar;

        // Tentativa de calcular o 'Outros' reverso
        // dist_total = consumo_total_val - comp_total_val_dist + dist_outros_inicial
        // dist_outros_inicial = dist_total - (consumo_total_val - comp_total_val_dist)
        const dist_outros_inicial = parseFloat((d.dist_total - (consumo_total_val + d.dist_comp_total)).toFixed(2));

        d._editor = {
            // Usa os valores brutos processados pelo Pyodide como ponto de partida
            comp_qtd: d.det_credito_qtd || 0,
            tarifa_comp_ev: d.det_credito_tar || 0,
            // Boleto fixo se não tem tarifa EGS (Pyodide usou valor fixo)
            boleto_ev: (d.det_credito_tar === 0 && d.totalPagar > 0) ? d.totalPagar : 0,
            dist_outros: d.dist_outros || dist_outros_inicial
        };
    }

    const editor = d._editor;
    const comp_qtd = editor.comp_qtd;
    // Mantemos valores de consumo e tarifas da distribuidora constantes (não editáveis por enquanto)
    const consumo_qtd = d.dist_consumo_qtd;
    const tarifa_cons = d.dist_consumo_tar;
    const tarifa_comp_dist = d.dist_comp_tar;

    let det_credito_total, det_credito_tar_recalc;
    if (editor.boleto_ev > 0) {
        det_credito_total = editor.boleto_ev;
        // Calcula a tarifa efetiva para exibição no PDF, mesmo sendo boleto fixo
        det_credito_tar_recalc = (comp_qtd > 0) ? editor.boleto_ev / comp_qtd : 0;
    } else {
        det_credito_total = comp_qtd * editor.tarifa_comp_ev;
        det_credito_tar_recalc = editor.tarifa_comp_ev;
    }

    const consumo_total_val = consumo_qtd * tarifa_cons;
    const comp_total_val_dist = comp_qtd * tarifa_comp_dist;
    // Recalcula o total da fatura da distribuidora
    const dist_total = consumo_total_val - comp_total_val_dist + editor.dist_outros;

    // Recalcula o custo total final (distribuidora + EGS)
    const econ_total_com = dist_total + det_credito_total;
    // Recalcula o custo total sem GD (para comparação)
    const econ_total_sem = consumo_total_val + editor.dist_outros;
    // Recalcula a economia
    const economiaMes = Math.max(0, econ_total_sem - econ_total_com);

    // Recalcula métricas ambientais
    const co2_kg = comp_qtd * 0.07;
    const arvores = (co2_kg / 1000.0) * 8;

    return {
        ...d,
        totalPagar: det_credito_total,
        economiaMes: economiaMes,
        co2Evitado: co2_kg,
        arvoresEquivalentes: arvores,
        det_credito_qtd: comp_qtd,
        det_credito_tar: det_credito_tar_recalc,
        det_credito_total: det_credito_total,
        dist_outros: editor.dist_outros,
        dist_total: dist_total,
        econ_total_sem: econ_total_sem,
        econ_total_com: econ_total_com,
        // Note: economiaTotal histórica não é recalculada, apenas a do mês
    };
}