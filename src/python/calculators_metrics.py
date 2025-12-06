import pandas as pd
from datetime import datetime

# =================================================================
# CONSTANTES E CÁLCULO DE MÉTRICAS (src/python/calculators_metrics.py)
# =================================================================

# Constantes de Fallback e Ambientais
CO2_PER_KWH = 0.07
TREES_PER_TON_CO2 = 8
# Valores médios 2025 baseados em principais distribuidoras (Atualizado: Reflete média real da planilha)
FALLBACK_TARIFA_DIST = 1.13  # Antes: 0.85
FALLBACK_TARIFA_COMP_EV = 0.85  # Antes: 0.75
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

    # --- 1.1. Extração do Desconto Praticado ---
    # Fórmula da planilha: Boleto = Crédito × Tarifa × (1 - Desconto)
    desconto_praticado = get('desconto_praticado')
    # Validação: desconto deve estar entre 0 e 1 (0% a 100%)
    if desconto_praticado < 0 or desconto_praticado > 1:
        desconto_praticado = 0.0

    # --- VALIDAÇÕES DE DADOS ---
    validations = []
    
    # Validação 1: Tarifas suspeitas (< R$ 0,50 ou > R$ 1,50)
    if 0 < tarifa_cons < 0.50 or tarifa_cons > 1.50:
        validations.append({
            "type": "warning",
            "severity": "warning",
            "title": "Tarifa de Consumo Suspeita",
            "message": f"Tarifa de consumo fora do padrão: R$ {tarifa_cons:.4f}/kWh",
            "details": "Valores esperados entre R$ 0,50 e R$ 1,50. Verifique se o valor está correto."
        })
    
    if 0 < tarifa_comp < 0.50 or tarifa_comp > 1.50:
        validations.append({
            "type": "warning",
            "severity": "warning",
            "title": "Tarifa de Compensação Suspeita",
            "message": f"Tarifa de compensação fora do padrão: R$ {tarifa_comp:.4f}/kWh",
            "details": "Valores esperados entre R$ 0,50 e R$ 1,50. Verifique se o valor está correto."
        })
    
    # Validação 2: Fio B atípico (> 40% da tarifa)
    if tarifa_cons > 0:
        percentual_fio_b = (tarifa_comp / tarifa_cons) * 100
        if percentual_fio_b > 40:
            validations.append({
                "type": "warning",
                "severity": "warning",
                "title": "Fio B Atípico",
                "message": f"Fio B representa {percentual_fio_b:.1f}% da tarifa (acima de 40%)",
                "details": f"Tarifa compensação: R$ {tarifa_comp:.4f} / Tarifa consumo: R$ {tarifa_cons:.4f}"
            })
    
    # Validação 3: Valores negativos críticos
    if consumo_qtd < 0:
        validations.append({
            "type": "error",
            "severity": "error",
            "title": "Consumo Negativo",
            "message": f"Consumo não pode ser negativo: {consumo_qtd} kWh",
            "details": "Erro crítico nos dados. Verifique a planilha de origem."
        })
    
    if comp_qtd < 0:
        validations.append({
            "type": "error",
            "severity": "error",
            "title": "Crédito Compensado Negativo",
            "message": f"Crédito compensado não pode ser negativo: {comp_qtd} kWh",
            "details": "Erro crítico nos dados. Verifique a planilha de origem."
        })

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
        # Cenário B: Cálculo por tarifa COM DESCONTO (fórmula idêntica à planilha)
        # Fórmula: Boleto = Crédito × Tarifa × (1 - Desconto)
        total_pagar_egs = comp_qtd * tarifa_egs * (1 - desconto_praticado)
        tarifa_egs_efetiva = tarifa_egs * (1 - desconto_praticado)
        
        # Adiciona alerta discreto se não houver boleto na planilha
        desc_pct = desconto_praticado * 100
        validations.append({
            "type": "info",
            "severity": "info",
            "title": "Cálculo Estimado (Cenário B)",
            "message": f"Valor do boleto calculado pelo sistema (Crédito x Tarifa x (1 - {desc_pct:.0f}% desconto)).",
            "details": f"Fórmula: {comp_qtd:.0f} kWh × R$ {tarifa_egs:.4f} × (1 - {desc_pct:.0f}%) = R$ {total_pagar_egs:.2f}"
        })

    # --- 4. Economia ---
    custo_sem_gd_calculado = valor_consumo_sem_gd + dist_outros
    custo_com_gd = dist_total + total_pagar_egs
    economia_mes = custo_sem_gd_calculado - custo_com_gd
    
    # --- 5. Retorno Formatado ---
    def r(x, d=2): return round(float(x or 0), d)

    result = {
        # Distribuidora
        "dist_consumo_qtd": r(consumo_qtd), "dist_consumo_tar": r(tarifa_cons, 4), "dist_consumo_total": r(valor_consumo_sem_gd),
        "dist_comp_qtd": r(comp_qtd), "dist_comp_tar": r(tarifa_comp, 4), "dist_comp_total": r(-valor_credito_abatido),
        "dist_outros": r(dist_outros), "dist_total": r(dist_total),
        "det_credito_qtd": r(comp_qtd), "det_credito_tar": r(tarifa_egs_efetiva, 4), "det_credito_total": r(total_pagar_egs),
        "totalPagar": r(total_pagar_egs), "econ_total_sem": r(custo_sem_gd_calculado), "econ_total_com": r(custo_com_gd),
        "economiaMes": r(economia_mes),
        "desconto_praticado": r(desconto_praticado * 100, 0),  # Percentual (ex: 25 = 25%)
        "co2Evitado": r(consumo_qtd * CO2_PER_KWH),
        "arvoresEquivalentes": r((consumo_qtd * CO2_PER_KWH / 1000.0) * TREES_PER_TON_CO2, 1),
        "vencimento_iso": vencimento_iso,
        "emissao_iso": datetime.now().strftime('%Y-%m-%d')
    }
    
    # Adiciona validações ao resultado se houver
    if validations:
        result["validations"] = validations
    
    return result