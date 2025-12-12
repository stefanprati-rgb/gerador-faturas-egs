// src/modules/corretor/services/InvoiceRecalculator.js
// Sistema de Recálculo Bidirecional de Faturas

/**
 * Constantes de métricas ambientais
 */
const CO2_PER_KWH = 0.07;
const TREES_PER_TON_CO2 = 8;

/**
 * Definição dos campos e suas dependências
 */
export const CAMPOS_CONFIG = {
    // Quantidades (kWh)
    consumo_fp: {
        tipo: 'input',
        unidade: 'kWh',
        label: 'Consumo FP',
        step: 1,
        dependentes: ['custo_sem_gd', 'fatura_cgd', 'custo_com_gd', 'economia']
    },
    cred_fp: {
        tipo: 'input',
        unidade: 'kWh',
        label: 'Crédito Consumido FP',
        step: 1,
        dependentes: ['fatura_cgd', 'boleto_egs', 'custo_com_gd', 'economia']
    },

    // Tarifas (R$/kWh)
    tarifa_fp: {
        tipo: 'input',
        unidade: 'R$/kWh',
        label: 'Tarifa FP (CEMIG)',
        step: 0.000001,
        dependentes: ['custo_sem_gd', 'fatura_cgd', 'custo_com_gd', 'economia']
    },
    tarifa_comp_fp: {
        tipo: 'input',
        unidade: 'R$/kWh',
        label: 'Tarifa Compensada FP',
        step: 0.000001,
        dependentes: ['fatura_cgd', 'custo_com_gd', 'economia']
    },
    tarifa_egs: {
        tipo: 'input',
        unidade: 'R$/kWh',
        label: 'Tarifa Média EGS',
        step: 0.000001,
        dependentes: ['boleto_egs', 'custo_com_gd', 'economia']
    },

    // Valores (R$)
    outros: {
        tipo: 'input',
        unidade: 'R$',
        label: 'Outros/CIP',
        step: 0.01,
        dependentes: ['custo_sem_gd', 'fatura_cgd', 'custo_com_gd', 'economia']
    },
    boleto_egs: {
        tipo: 'input_ou_derivado',
        unidade: 'R$',
        label: 'Boleto EGS',
        step: 0.01,
        formula: 'cred_fp * tarifa_egs',
        dependentes: ['custo_com_gd', 'economia'],
        podeSerFixo: true
    },

    // Campos derivados (calculados, mas editáveis com resolução de conflito)
    fatura_cgd: {
        tipo: 'derivado',
        unidade: 'R$',
        label: 'Fatura C/GD (Distribuidora)',
        step: 0.01,
        formula: 'consumo_fp * tarifa_fp - cred_fp * tarifa_comp_fp + outros',
        dependentes: ['custo_com_gd', 'economia'],
        conflitos: ['consumo_fp', 'tarifa_fp', 'cred_fp', 'tarifa_comp_fp', 'outros']
    },
    custo_sem_gd: {
        tipo: 'derivado',
        unidade: 'R$',
        label: 'Custo SEM GD',
        step: 0.01,
        formula: 'consumo_fp * tarifa_fp + outros',
        dependentes: ['economia'],
        conflitos: ['consumo_fp', 'tarifa_fp', 'outros']
    },
    custo_com_gd: {
        tipo: 'derivado',
        unidade: 'R$',
        label: 'Custo COM GD (Total)',
        step: 0.01,
        formula: 'fatura_cgd + boleto_egs',
        dependentes: ['economia'],
        conflitos: ['fatura_cgd', 'boleto_egs']
    },
    economia: {
        tipo: 'derivado',
        unidade: 'R$',
        label: 'Economia Mensal',
        step: 0.01,
        formula: 'custo_sem_gd - custo_com_gd',
        conflitos: ['custo_sem_gd', 'custo_com_gd']
    }
};

/**
 * Arredonda valor para N casas decimais
 */
function round(val, decimals = 2) {
    return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Extrai os valores base de um objeto cliente para cálculo
 * IMPORTANTE: Preserva os valores originais da planilha!
 */
export function extrairValoresBase(client) {
    // Quantidades
    const consumo_fp = client.dist_consumo_qtd || 0;
    const cred_fp = client.det_credito_qtd || 0;

    // Tarifas
    const tarifa_fp = client.dist_consumo_tar || 0;
    let tarifa_comp_fp = client.dist_comp_tar || 0;
    const tarifa_egs = client.det_credito_tar || 0;

    // Valores originais da planilha
    const outros = client.dist_outros || 0;
    const boleto_egs = client.totalPagar || client.det_credito_total || 0;
    const fatura_cgd = client.dist_total || 0;
    const custo_sem_gd = client.econ_total_sem || 0;
    const custo_com_gd = client.econ_total_com || 0;
    const economia = client.economiaMes || 0;

    // CORREÇÃO: Se tarifa_comp_fp veio zerada, calcular reversamente usando a fatura
    // Fatura = Consumo × Tarifa_FP - Crédito × Tarifa_Comp + Outros
    // Tarifa_Comp = (Consumo × Tarifa_FP + Outros - Fatura) / Crédito
    if (tarifa_comp_fp === 0 && cred_fp > 0 && fatura_cgd > 0) {
        const valor_consumo = consumo_fp * tarifa_fp;
        const numerador = valor_consumo + outros - fatura_cgd;
        if (numerador > 0) {
            tarifa_comp_fp = round(numerador / cred_fp, 6);
        }
    }

    return {
        // Quantidades
        consumo_fp,
        cred_fp,

        // Tarifas
        tarifa_fp,
        tarifa_comp_fp,
        tarifa_egs,

        // Valores ORIGINAIS (preservados da planilha)
        outros,
        boleto_egs,
        fatura_cgd,
        custo_sem_gd,
        custo_com_gd,
        economia,

        // CO2 baseado no crédito
        co2_evitado: round(cred_fp * CO2_PER_KWH),
        arvores: round((cred_fp * CO2_PER_KWH / 1000.0) * TREES_PER_TON_CO2, 1),

        // Flag para boleto fixo (por padrão SIM, vem da planilha)
        boleto_fixo: true,

        // Flag para indicar se usuário editou algum campo
        _editado: false
    };
}

/**
 * Calcula valores derivados a partir dos inputs.
 * IMPORTANTE: Só recalcula se o usuário editou um campo de input.
 * 
 * @param {object} valores - Objeto com todos os valores atuais
 * @param {string|null} campoEditado - Campo que foi editado (null = preservar originais)
 * @returns {object} - Valores recalculados
 */
export function calcularDerivados(valores, campoEditado = null) {
    const v = { ...valores };

    // Se nenhum campo foi editado, apenas retorna os valores originais
    // (usado na inicialização do modal)
    if (!campoEditado) {
        // Apenas recalcular métricas ambientais que são sempre derivadas
        v.co2_evitado = round(v.cred_fp * CO2_PER_KWH);
        v.arvores = round((v.co2_evitado / 1000.0) * TREES_PER_TON_CO2, 1);
        return v;
    }

    // Lista de campos de INPUT (quando editados, disparam recálculo de derivados)
    const camposInput = ['consumo_fp', 'cred_fp', 'tarifa_fp', 'tarifa_comp_fp', 'tarifa_egs', 'outros', 'boleto_egs'];

    // Se editou um campo de input, recalcula TODOS os derivados
    if (camposInput.includes(campoEditado)) {
        // F1: Custo SEM GD = Consumo × Tarifa_FP + Outros
        v.custo_sem_gd = round(v.consumo_fp * v.tarifa_fp + v.outros);

        // F2: Fatura C/GD = Consumo × Tarifa_FP - Crédito × Tarifa_Comp + Outros
        v.fatura_cgd = round(v.consumo_fp * v.tarifa_fp - v.cred_fp * v.tarifa_comp_fp + v.outros);

        // F3: Boleto EGS - pode ser fixo ou calculado
        if (!v.boleto_fixo && v.cred_fp > 0 && v.tarifa_egs > 0) {
            v.boleto_egs = round(v.cred_fp * v.tarifa_egs);
        }

        // F4: Custo COM GD = Fatura C/GD + Boleto EGS
        v.custo_com_gd = round(v.fatura_cgd + v.boleto_egs);

        // F5: Economia = Custo SEM GD - Custo COM GD
        v.economia = round(Math.max(0, v.custo_sem_gd - v.custo_com_gd));
    }

    // Métricas ambientais (sempre recalculadas)
    v.co2_evitado = round(v.cred_fp * CO2_PER_KWH);
    v.arvores = round((v.co2_evitado / 1000.0) * TREES_PER_TON_CO2, 1);

    return v;
}

/**
 * Detecta quais campos entraram em conflito ao editar um campo derivado
 * @param {string} campoEditado - Nome do campo que foi editado
 * @returns {object|null} - Info de conflito ou null se não há conflito
 */
export function detectarConflito(campoEditado) {
    const config = CAMPOS_CONFIG[campoEditado];

    if (!config || config.tipo !== 'derivado') {
        return null;
    }

    return {
        campo: campoEditado,
        label: config.label,
        opcoesResolucao: config.conflitos.map(c => ({
            campo: c,
            label: CAMPOS_CONFIG[c]?.label || c
        }))
    };
}

/**
 * Resolve um conflito recalculando um campo de input baseado no valor desejado para o derivado
 * @param {object} valores - Valores atuais
 * @param {string} campoAlterado - Campo derivado que foi alterado
 * @param {number} novoValor - Novo valor desejado
 * @param {string} manterFixo - Qual campo manter fixo na resolução
 * @returns {object} - Valores recalculados
 */
export function resolverConflito(valores, campoAlterado, novoValor, manterFixo) {
    const v = { ...valores };

    switch (campoAlterado) {
        case 'economia':
            // Economia = custo_sem_gd - custo_com_gd
            if (manterFixo === 'custo_sem_gd') {
                // Recalcular custo_com_gd
                v.custo_com_gd = round(v.custo_sem_gd - novoValor);
                // Agora precisa distribuir entre fatura_cgd e boleto_egs
                // Por simplicidade, ajustamos o boleto_egs
                v.boleto_egs = round(v.custo_com_gd - v.fatura_cgd);
                v.boleto_fixo = true;
            } else if (manterFixo === 'custo_com_gd') {
                // Recalcular custo_sem_gd
                v.custo_sem_gd = round(v.custo_com_gd + novoValor);
                // Ajustar o que faz custo_sem_gd: consumo × tarifa + outros
                // Por simplicidade, ajustamos 'outros'
                v.outros = round(v.custo_sem_gd - v.consumo_fp * v.tarifa_fp);
            }
            v.economia = novoValor;
            break;

        case 'custo_com_gd':
            // Custo COM GD = fatura_cgd + boleto_egs
            if (manterFixo === 'fatura_cgd') {
                v.boleto_egs = round(novoValor - v.fatura_cgd);
                v.boleto_fixo = true;
            } else if (manterFixo === 'boleto_egs') {
                v.fatura_cgd = round(novoValor - v.boleto_egs);
                // Ajustar 'outros' para bater a fatura
                v.outros = round(v.fatura_cgd - v.consumo_fp * v.tarifa_fp + v.cred_fp * v.tarifa_comp_fp);
            }
            v.custo_com_gd = novoValor;
            // Recalcular economia
            v.economia = round(Math.max(0, v.custo_sem_gd - v.custo_com_gd));
            break;

        case 'custo_sem_gd':
            // Custo SEM GD = consumo × tarifa + outros
            if (manterFixo === 'consumo_fp' || manterFixo === 'tarifa_fp') {
                // Ajustar 'outros'
                v.outros = round(novoValor - v.consumo_fp * v.tarifa_fp);
            } else if (manterFixo === 'outros') {
                // Ajustar consumo (mantendo tarifa)
                if (v.tarifa_fp > 0) {
                    v.consumo_fp = round((novoValor - v.outros) / v.tarifa_fp, 0);
                }
            }
            v.custo_sem_gd = novoValor;
            // Recalcular economia
            v.economia = round(Math.max(0, v.custo_sem_gd - v.custo_com_gd));
            break;

        case 'fatura_cgd':
            // Fatura = consumo × tarifa - crédito × tarifa_comp + outros
            // Por simplicidade, ajustamos 'outros'
            v.outros = round(novoValor - v.consumo_fp * v.tarifa_fp + v.cred_fp * v.tarifa_comp_fp);
            v.fatura_cgd = novoValor;
            // Recalcular derivados em cascata
            v.custo_com_gd = round(v.fatura_cgd + v.boleto_egs);
            v.economia = round(Math.max(0, v.custo_sem_gd - v.custo_com_gd));
            break;
    }

    return v;
}

/**
 * Recalcula a fatura completa com suporte a edição bidirecional
 * @param {object} client - Dados originais do cliente
 * @param {object} edicoes - Objeto com campos editados {campo: valor}
 * @param {object} resolucoes - Objeto com resoluções de conflito {campo: campoFixo}
 * @returns {object} - Cliente com valores recalculados
 */
export function recalculateInvoice(client, edicoes = null, resolucoes = null) {
    // Inicializa valores base
    let valores = extrairValoresBase(client);

    // Inicializa _editor se não existir
    if (!client._editor) {
        // Calcular tarifa EGS reversa se não informada
        if (valores.tarifa_egs === 0 && valores.cred_fp > 0 && valores.boleto_egs > 0) {
            valores.tarifa_egs = round(valores.boleto_egs / valores.cred_fp, 6);
        }
        valores.boleto_fixo = true; // Por padrão, boleto vem fixo da planilha
    }

    // Aplica edições se fornecidas
    if (edicoes) {
        for (const [campo, valor] of Object.entries(edicoes)) {
            const config = CAMPOS_CONFIG[campo];

            if (config?.tipo === 'derivado' && resolucoes?.[campo]) {
                // Campo derivado com resolução de conflito
                valores = resolverConflito(valores, campo, valor, resolucoes[campo]);
            } else {
                // Campo de input ou derivado simples
                valores[campo] = valor;

                // Se editou o boleto diretamente, marcar como fixo
                if (campo === 'boleto_egs') {
                    valores.boleto_fixo = true;
                    // Recalcular tarifa EGS reversa
                    if (valores.cred_fp > 0) {
                        valores.tarifa_egs = round(valor / valores.cred_fp, 6);
                    }
                }

                // Se editou a tarifa EGS, desativar boleto fixo
                if (campo === 'tarifa_egs') {
                    valores.boleto_fixo = false;
                }
            }
        }
    }

    // Recalcula todos os derivados
    valores = calcularDerivados(valores);

    // Retorna cliente atualizado
    return {
        ...client,
        // Quantidades
        dist_consumo_qtd: valores.consumo_fp,
        det_credito_qtd: valores.cred_fp,

        // Tarifas
        dist_consumo_tar: valores.tarifa_fp,
        dist_comp_tar: valores.tarifa_comp_fp,
        det_credito_tar: valores.tarifa_egs,

        // Valores
        dist_outros: valores.outros,
        dist_total: valores.fatura_cgd,
        det_credito_total: valores.boleto_egs,
        totalPagar: valores.boleto_egs,

        // Economia
        econ_total_sem: valores.custo_sem_gd,
        econ_total_com: valores.custo_com_gd,
        economiaMes: valores.economia,

        // Métricas Ambientais
        co2Evitado: valores.co2_evitado,
        arvoresEquivalentes: valores.arvores,

        // Estado do editor
        _editor: valores,
        _boleto_fixo: valores.boleto_fixo
    };
}

/**
 * Converte valores do editor para cliente (formato de saída)
 */
export function editorParaCliente(valores) {
    return {
        dist_consumo_qtd: valores.consumo_fp,
        det_credito_qtd: valores.cred_fp,
        dist_consumo_tar: valores.tarifa_fp,
        dist_comp_tar: valores.tarifa_comp_fp,
        det_credito_tar: valores.tarifa_egs,
        dist_outros: valores.outros,
        dist_total: valores.fatura_cgd,
        det_credito_total: valores.boleto_egs,
        totalPagar: valores.boleto_egs,
        econ_total_sem: valores.custo_sem_gd,
        econ_total_com: valores.custo_com_gd,
        economiaMes: valores.economia,
        co2Evitado: valores.co2_evitado,
        arvoresEquivalentes: valores.arvores
    };
}