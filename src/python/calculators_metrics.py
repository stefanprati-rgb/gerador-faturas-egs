import pandas as pd
from datetime import datetime

# =================================================================
# CONSTANTES E CÁLCULO DE MÉTRICAS (src/python/calculators_metrics.py)
# =================================================================

# Constantes de Fallback e Ambientais
CO2_PER_KWH = 0.07
TREES_PER_TON_CO2 = 8
# Valores médios 2025 baseados em principais distribuidoras
FALLBACK_TARIFA_DIST = 0.85  # Média nacional 2025
FALLBACK_TARIFA_COMP_EV = 0.75  # Tarifa típica EGS
FALLBACK_FIO_B_PERCENTUAL = 0.28  # 28% da tarifa total

# Percentuais do Fio B por ano (Resolução Normativa ANEEL)
ANO_ATUAL = 2025
PERCENTUAIS_FIO_B = {
    2023: 0.15,  # 15%
    2024: 0.30,  # 30%
    2025: 0.45,  # 45%
    2026: 0.60,  # 60%
    2027: 0.75,  # 75%
    2028: 0.90   # 90%
}
PERCENTUAL_FIO_B_ATUAL = PERCENTUAIS_FIO_B.get(ANO_ATUAL, 0.90)

def compute_metrics(row, cols_map, vencimento_iso):
    """Realiza toda a matemática financeira e ambiental da fatura."""
    
    def get(key, default=0.0):
        col = cols_map.get(key)
        val = to_num(row.get(col, default)) if col else default
        return val

    # --- 1. Extração e Fallbacks de Tarifas ---
    consumo_qtd = get('consumo_qtd')
    comp_qtd = get('comp_qtd')
    
    tarifa_cons = get('tarifa_consumo')
    if tarifa_cons <= 0: tarifa_cons = FALLBACK_TARIFA_DIST
        
    tarifa_comp = get('tarifa_comp_dist') # Tarifa usada para crédito na distribuidora
    if tarifa_comp <= 0: tarifa_comp = get('tarifa_comp_ev') 
    if tarifa_comp <= 0: tarifa_comp = FALLBACK_TARIFA_COMP_EV

    tarifa_egs = get('tarifa_comp_ev') # Tarifa cobrada pelo EGS
    if tarifa_egs <= 0: tarifa_egs = FALLBACK_TARIFA_COMP_EV

    # --- 2. Cálculos da Distribuidora ---
    valor_consumo_sem_gd = consumo_qtd * tarifa_cons
    valor_credito_abatido = comp_qtd * tarifa_comp
    fatura_dist_real = get('fatura_c_gd')
    
    # Cálculo de "Outros" (Ajuste para fechar a conta com a fatura real)
    dist_outros = 0.0
    if fatura_dist_real > 0:
        dist_outros = fatura_dist_real - (valor_consumo_sem_gd - valor_credito_abatido)
        # Proteção contra valores negativos absurdos (erros na planilha)
        if dist_outros < -10.0:
            dist_outros = 0.0 
    else:
        fatura_dist_real = max(0, valor_consumo_sem_gd - valor_credito_abatido)

    dist_total = fatura_dist_real
    
    # --- 3. Cálculos EGS (Boleto) ---
    boleto_fechado = get('boleto_ev')
    
    if boleto_fechado > 0:
        total_pagar_egs = boleto_fechado
        # Engenharia reversa da tarifa efetiva para exibição
        tarifa_egs_efetiva = (total_pagar_egs / comp_qtd) if comp_qtd > 0 else 0.0
    else:
        total_pagar_egs = comp_qtd * tarifa_egs
        tarifa_egs_efetiva = tarifa_egs

    # --- 4. Economia ---
    custo_sem_gd_calculado = valor_consumo_sem_gd + dist_outros
    custo_com_gd = dist_total + total_pagar_egs
    economia_mes = custo_sem_gd_calculado - custo_com_gd
    
    # --- 5. Retorno Formatado ---
    def r(x, d=2): return round(float(x or 0), d)

    return {
        # Distribuidora
        "dist_consumo_qtd": r(consumo_qtd), "dist_consumo_tar": r(tarifa_cons, 4), "dist_consumo_total": r(valor_consumo_sem_gd),
        "dist_comp_qtd": r(comp_qtd), "dist_comp_tar": r(tarifa_comp, 4), "dist_comp_total": r(-valor_credito_abatido),
        "dist_outros": r(dist_outros), "dist_total": r(dist_total),
        "det_credito_qtd": r(comp_qtd), "det_credito_tar": r(tarifa_egs_efetiva, 4), "det_credito_total": r(total_pagar_egs),
        "totalPagar": r(total_pagar_egs), "econ_total_sem": r(custo_sem_gd_calculado), "econ_total_com": r(custo_com_gd),
        "economiaMes": r(economia_mes),
        "co2Evitado": r(consumo_qtd * CO2_PER_KWH),
        "arvoresEquivalentes": r((consumo_qtd * CO2_PER_KWH / 1000.0) * TREES_PER_TON_CO2, 1),
        "vencimento_iso": vencimento_iso,
        "emissao_iso": datetime.now().strftime('%Y-%m-%d')
    }