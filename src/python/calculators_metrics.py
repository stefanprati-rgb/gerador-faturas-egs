import pandas as pd
from datetime import datetime

# =================================================================
# MODO ESPELHO: TODOS OS DADOS VÊM DA PLANILHA (ZERO CÁLCULO)
# =================================================================

CO2_PER_KWH = 0.07
TREES_PER_TON_CO2 = 8

def compute_metrics(row, cols_map, vencimento_iso):
    """
    Prepara os dados para o PDF coletando TODOS os valores da planilha.
    NENHUM VALOR FINANCEIRO É CALCULADO - todos vêm da planilha.
    """
    
    def get(key, default=0.0):
        col = cols_map.get(key)
        return to_num(row.get(col, default)) if col else default

    # ============================================================
    # 1. COLETA DE QUANTIDADES (kWh)
    # ============================================================
    consumo_qtd = get('consumo_qtd')
    comp_qtd = get('comp_qtd')

    # ============================================================
    # 2. COLETA DE TARIFAS (R$/kWh) - DA PLANILHA
    # ============================================================
    tarifa_consumo = get('tarifa_consumo')     # Tarifa de consumo (TARIFA FP)
    tarifa_credito = get('tarifa_credito')     # Tarifa de crédito (Tarifa média compensada)

    # ============================================================
    # 3. COLETA DE VALORES FINANCEIROS (R$) - DA PLANILHA
    # ============================================================
    dist_total = get('fatura_c_gd')            # Total fatura distribuidora
    outros = get('outros')                      # Contrib. Ilum. Pública e Outros
    egs_total = get('boleto_ev')               # Total boleto EGS
    
    # ============================================================
    # 4. COLETA DE CUSTOS PARA ECONOMIA (R$) - DA PLANILHA
    # ============================================================
    custo_sem_solar = get('custo_sem_gd')      # Custo SEM GD
    custo_com_solar = get('custo_com_gd')      # Custo COM GD
    economia_planilha = get('economia')        # Economia direta da planilha
    
    # Se a planilha tiver a economia direta, usar ela
    # Senão, calcular a partir dos custos (se disponíveis)
    if economia_planilha > 0:
        economia_mes = economia_planilha
    elif custo_sem_solar > 0 and custo_com_solar > 0:
        economia_mes = max(0.0, custo_sem_solar - custo_com_solar)
    else:
        # Fallback final: se não tiver nada, zerar
        economia_mes = 0.0

    # ============================================================
    # 5. MÉTRICAS AMBIENTAIS (estas são calculadas, ok)
    # ============================================================
    co2_evitado = consumo_qtd * CO2_PER_KWH
    arvores = (co2_evitado / 1000.0) * TREES_PER_TON_CO2

    def r(x, d=2): return round(float(x or 0), d)

    return {
        # Bloco Distribuidora
        "dist_consumo_qtd": r(consumo_qtd),
        "dist_consumo_tar": r(tarifa_consumo, 4),    # ← COLETADO da planilha
        "dist_consumo_total": r(dist_total),
        "dist_comp_qtd": r(comp_qtd),
        "dist_comp_tar": 0,
        "dist_comp_total": 0,
        "dist_outros": r(outros),                     # ← COLETADO da planilha
        "dist_total": r(dist_total),
        
        # Bloco EGS / Boleto
        "det_credito_qtd": r(comp_qtd),
        "det_credito_tar": r(tarifa_credito, 4),     # ← COLETADO da planilha
        "det_credito_total": r(egs_total),
        "det_total_contrib": r(egs_total),
        "totalPagar": r(egs_total),
        
        # Economia
        "econ_total_sem": r(custo_sem_solar),        # ← COLETADO da planilha
        "econ_total_com": r(custo_com_solar),        # ← COLETADO da planilha
        "economiaMes": r(economia_mes),              # ← COLETADO da planilha
        
        # Métricas Ambientais (calculadas, ok)
        "co2Evitado": r(co2_evitado),
        "arvoresEquivalentes": r(arvores, 1),
        
        # Datas
        "vencimento_iso": vencimento_iso,
        "emissao_iso": datetime.now().strftime('%Y-%m-%d')
    }

# Função auxiliar
def to_num(val):
    if pd.isna(val) or val == '': return 0.0
    try:
        if isinstance(val, (int, float)): return float(val)
        if isinstance(val, str):
            val_str = val.strip().replace('R$', '').replace(' ', '')
            if ',' in val_str and '.' in val_str:
                if val_str.rfind(',') > val_str.rfind('.'):
                    val_str = val_str.replace('.', '').replace(',', '.')
                else:
                    val_str = val_str.replace(',', '')
            elif ',' in val_str:
                val_str = val_str.replace(',', '.')
            return float(val_str)
        return float(val)
    except:
        return 0.0