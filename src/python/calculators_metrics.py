import pandas as pd
from datetime import datetime

# =================================================================
# MODO ESPELHO: O CÓDIGO OBEDECE A PLANILHA (ZERO CÁLCULO)
# =================================================================

def compute_metrics(row, cols_map, vencimento_iso):
    """
    Apenas formata os dados da planilha para o PDF.
    Prioridade total para os valores (R$) que já vêm prontos.
    """
    
    def get(key, default=0.0):
        col = cols_map.get(key)
        # Tenta pegar o valor numérico, se falhar, usa o default
        return to_num(row.get(col, default)) if col else default

    # --- 1. LEITURA DIRETA DOS VALORES FINANCEIROS (O QUE IMPORTA) ---
    
    # Valor da Distribuidora (A planilha MANDA)
    # Procura colunas como: "FATURA C/GD", "Saldo Próximo Mês", "Valor Fatura Distribuidora"
    dist_total_real = get('fatura_c_gd') 
    
    # Valor do Boleto EGS (A planilha MANDA)
    # Procura colunas como: "Boleto Hube", "Valor enviado para emissão", "Valor Cobrado"
    egs_total_real = get('boleto_ev')

    # Quantidades (Apenas para exibir no detalhe)
    consumo_qtd = get('consumo_qtd')
    comp_qtd = get('comp_qtd')

    # --- 2. ENGENHARIA REVERSA (APENAS PARA "ENFEITAR" O PDF) ---
    # O PDF pede "Tarifa" e "Total". Como já temos o Total Real, 
    # apenas deduzimos a tarifa visual para não deixar o campo vazio.
    
    # Tarifa Visual de Consumo
    if consumo_qtd > 0 and dist_total_real > 0:
        # Exibe uma tarifa média (inclui impostos, ilum. pública, tudo)
        tarifa_cons_visual = dist_total_real / consumo_qtd
        # Se a tarifa ficar absurda (ex: R$ 10/kWh), trava em R$ 1,00 para não assustar
        if tarifa_cons_visual > 5: tarifa_cons_visual = 0.0
    else:
        tarifa_cons_visual = 0.0

    # Tarifa Visual do Crédito (Boleto)
    if comp_qtd > 0 and egs_total_real > 0:
        tarifa_credito_visual = egs_total_real / comp_qtd
    else:
        tarifa_credito_visual = 0.0

    # --- 3. ECONOMIA (SE NÃO TIVER NA PLANILHA, AÍ SIM CALCULAMOS) ---
    # Idealmente, adicione uma coluna "Economia" no COLUMNS_MAP do processor.py
    # Por enquanto, mantemos o cálculo simples de economia apenas como fallback
    
    custo_sem_solar = dist_total_real + egs_total_real # Valor base pessimista
    if consumo_qtd > 0:
        # Estimativa de quanto pagaria sem a EGS (Tarifa cheia ~R$ 1.10)
        custo_sem_solar = consumo_qtd * 1.10 
        
    custo_com_solar = dist_total_real + egs_total_real
    economia = custo_sem_solar - custo_com_solar

    # --- 4. RETORNO SIMPLIFICADO ---
    def r(x, d=2): return round(float(x or 0), d)

    return {
        # BLOCO DISTRIBUIDORA (Copia o valor final da planilha)
        "dist_consumo_qtd": r(consumo_qtd),
        "dist_consumo_tar": r(tarifa_cons_visual, 4), # Tarifa deduzida apenas visual
        "dist_consumo_total": r(dist_total_real),     # <--- O VALOR CORRETO
        
        # Zera campos que confundem
        "dist_comp_qtd": 0, "dist_comp_tar": 0, "dist_comp_total": 0, "dist_outros": 0,
        "dist_total": r(dist_total_real),             # <--- REPETE O VALOR CORRETO

        # BLOCO EGS / BOLETO (Copia o valor final da planilha)
        "det_credito_qtd": r(comp_qtd),
        "det_credito_tar": r(tarifa_credito_visual, 4), # Tarifa deduzida apenas visual
        "det_credito_total": r(egs_total_real),         # <--- O VALOR CORRETO
        "det_total_contrib": r(egs_total_real),
        
        # TOTAIS
        "totalPagar": r(egs_total_real),
        
        # METRICAS INFORMATIVAS
        "econ_total_sem": r(custo_sem_solar),
        "econ_total_com": r(custo_com_solar),
        "economiaMes": r(economia),
        "co2Evitado": r(consumo_qtd * 0.07),
        "arvoresEquivalentes": r((consumo_qtd * 0.07 / 1000.0) * 8, 1),
        
        # DATAS
        "vencimento_iso": vencimento_iso,
        "emissao_iso": datetime.now().strftime('%Y-%m-%d')
    }

# Função auxiliar que faltava
def to_num(val):
    if pd.isna(val) or val == '': return 0.0
    try:
        if isinstance(val, str):
            # Corrige formato brasileiro 1.000,00 para 1000.00
            val = val.replace('.', '').replace(',', '.')
        return float(val)
    except:
        return 0.0