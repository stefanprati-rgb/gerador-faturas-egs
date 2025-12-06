import pandas as pd
import io, json
import traceback
import warnings as python_warnings
from datetime import datetime
import re
from typing import Optional, Dict, Any

# =================================================================
# MÓDULO DE CÁLCULOS INTEGRADO (CORREÇÃO PYODIDE)
# =================================================================

CO2_PER_KWH = 0.07
TREES_PER_TON_CO2 = 8

def to_num(val):
    """
    Converte valores para float de forma segura, suportando:
    - Padrão Brasileiro: 1.000,00
    - Padrão Americano/Excel: 1,000.00 ou 1000.00
    """
    if pd.isna(val) or val == '': return 0.0
    
    try:
        # Se já for número (int ou float), retorna direto
        if isinstance(val, (int, float)): 
            return float(val)
        
        val_str = str(val).strip()
        
        # Remoção de símbolos de moeda e espaços extras
        val_str = val_str.replace('R$', '').replace(' ', '')

        # Lógica de Detecção de Formato
        if ',' in val_str and '.' in val_str:
            # Formato misto detectado (ex: 1.200,50 ou 1,200.50)
            if val_str.rfind(',') > val_str.rfind('.'):
                # Padrão BR (vírgula no final): 1.200,50 -> Remove ponto, troca vírgula
                val_str = val_str.replace('.', '').replace(',', '.')
            else:
                # Padrão US (ponto no final): 1,200.50 -> Remove vírgula
                val_str = val_str.replace(',', '')
        elif ',' in val_str:
            # Apenas vírgula (ex: 1200,50) -> Assume decimal BR
            val_str = val_str.replace(',', '.')
        # Se tiver apenas ponto (ex: 750.02), o Python já entende nativamente
        
        return float(val_str)
    except Exception as e:
        return 0.0

def compute_metrics(row, cols_map, vencimento_iso):
    """
    Prepara os dados para o PDF seguindo a regra "Padrão Ouro".
    """
    def get(key, default=0.0):
        col = cols_map.get(key)
        return to_num(row.get(col, default)) if col else default

    # --- 1. LEITURA DOS VALORES FINANCEIROS REAIS ---
    dist_total_real = get('fatura_c_gd') 
    egs_total_real = get('boleto_ev')
    consumo_qtd = get('consumo_qtd')
    comp_qtd = get('comp_qtd')

    # --- 2. ENGENHARIA REVERSA PARA "ENFEITAR" O PDF ---
    if consumo_qtd > 0 and dist_total_real > 0:
        tarifa_cons_visual = dist_total_real / consumo_qtd
        if tarifa_cons_visual > 10: tarifa_cons_visual = 0.0
    else:
        tarifa_cons_visual = 0.0

    if comp_qtd > 0 and egs_total_real > 0:
        tarifa_credito_visual = egs_total_real / comp_qtd
    else:
        tarifa_credito_visual = 0.0

    # --- 3. ESTIMATIVA DE ECONOMIA ---
    custo_com_solar = dist_total_real + egs_total_real
    if consumo_qtd > 0:
        custo_sem_solar = consumo_qtd * 1.15
    else:
        custo_sem_solar = custo_com_solar * 1.10

    economia_mes = custo_sem_solar - custo_com_solar
    if economia_mes < 0: economia_mes = 0.0

    # --- 4. RETORNO DOS DADOS FORMATADOS ---
    def r(x, d=2): return round(float(x or 0), d)

    return {
        "dist_consumo_qtd": r(consumo_qtd),
        "dist_consumo_tar": r(tarifa_cons_visual, 4),
        "dist_consumo_total": r(dist_total_real),     
        "dist_comp_qtd": 0, "dist_comp_tar": 0, "dist_comp_total": 0, "dist_outros": 0,
        "dist_total": r(dist_total_real),             
        "det_credito_qtd": r(comp_qtd),
        "det_credito_tar": r(tarifa_credito_visual, 4),
        "det_credito_total": r(egs_total_real),         
        "det_total_contrib": r(egs_total_real),
        "totalPagar": r(egs_total_real),
        "econ_total_sem": r(custo_sem_solar),
        "econ_total_com": r(custo_com_solar),
        "economiaMes": r(economia_mes),
        "co2Evitado": r(consumo_qtd * CO2_PER_KWH),
        "arvoresEquivalentes": r((consumo_qtd * CO2_PER_KWH / 1000.0) * TREES_PER_TON_CO2, 1),
        "vencimento_iso": vencimento_iso,
        "emissao_iso": datetime.now().strftime('%Y-%m-%d')
    }

# =================================================================
# FIM DO MÓDULO INTEGRADO
# =================================================================

# Suprime warnings do openpyxl
python_warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')

# Definição das Colunas
COLUMNS_MAP = {
    'ref': ["REF", "Mês de Referência", "Competência"],
    'inst': ["Instalação", "Nº Instalação", "UC", "Codigo"],
    'nome': ["Nome Cliente", "Nome/Razão Social", "Cliente", "NOME", "RAZÃO SOCIAL"],
    'doc': ["Documento", "CPF/CNPJ", "CPF", "CNPJ"],
    'consumo_qtd': ["CONSUMO_FP", "Energia consumida - Fora ponta - quantidade", "Consumo KWh"],
    'comp_qtd': ["CRÉD. CONSUMIDO_FP", "Creditos consumidos - Fora ponta - quantidade", "Energia Compensada"],
    'tarifa_consumo': ["TARIFA FP", "Energia consumida - Fora ponta - tarifa", "Tarifa Cheia"],
    'tarifa_comp_ev': ["TARIFA_Comp_FP", "Tarifa EGS", "Tarifa Acordada"],
    'tarifa_comp_dist': ["TARIFA DE ENERGIA COMPENSADA", "Tarifa Fio B", "Tarifa Compensação"],
    'fatura_c_gd': ["FATURA C/GD", "Saldo Próximo Mês", "Valor Fatura Distribuidora"],
    'boleto_ev': ["Boleto Hube", "Valor enviado para emissão", "Valor Cobrado"],
    'endereco': ["Endereço", "Logradouro", "Rua"],
    'bairro': ["Bairro"],
    'cidade': ["Cidade", "Município"],
    'num_conta': ["Número da conta", "Conta Contrato"]
}

# --- FUNÇÕES AUXILIARES ---

def limpar_uc(valor):
    """Remove caracteres especiais da UC para comparação robusta (ex: 10/10232-7 -> 10102327)"""
    if not valor: return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(valor)).upper()

def safe_str(val):
    if pd.isna(val) or val is None: return ""
    return str(val).strip()

def safe_parse_date(val):
    try:
        if pd.isna(val): return None
        if isinstance(val, datetime): return val
        return pd.to_datetime(val, dayfirst=True)
    except:
        return None

def find_sheet_and_header(xls, mandatory_cols, prefer_name=None):
    """Encontra a aba e a linha de cabeçalho correta procurando por colunas obrigatórias."""
    best_sheet = None
    
    sheets_to_try = xls.sheet_names
    if prefer_name:
        sheets_to_try = sorted(sheets_to_try, key=lambda x: 0 if prefer_name.lower() in x.lower() else 1)

    for sheet in sheets_to_try:
        try:
            df_preview = pd.read_excel(xls, sheet_name=sheet, header=None, nrows=20)
            for r in range(len(df_preview)):
                row_vals = [str(v).strip().lower() for v in df_preview.iloc[r] if pd.notna(v)]
                if any(m.lower() in row_vals for m in mandatory_cols):
                    return sheet, r
        except:
            continue
            
    return None, 0

def pick_col(df, *possibles):
    cols_lower = {str(c).strip().lower(): c for c in df.columns}
    for p in possibles:
        if p.lower() in cols_lower:
            return cols_lower[p.lower()]
    return None

def _norm(s):
    return re.sub(r'[^a-zA-Z0-9]', '', str(s).lower())

def _diagnosticar_colunas(df: pd.DataFrame) -> str:
    colunas = list(df.columns)
    colunas_mostrar = colunas[:10]
    resultado = f"Colunas disponíveis ({len(colunas)} total): {', '.join(colunas_mostrar)}"
    if len(colunas) > 10:
        resultado += f"... (+{len(colunas)-10} mais)"
    return resultado

def _mapear_coluna_uc(df: pd.DataFrame) -> Optional[str]:
    termos_exatos = ["INSTALACAO", "INSTALAÇÃO", "Nº INSTALACAO", "UC", "CODIGO"]
    colunas_map = {_norm(col): col for col in df.columns}
    
    for termo in termos_exatos:
        if _norm(termo) in colunas_map:
            return colunas_map[_norm(termo)]
    
    for col_norm, col_original in colunas_map.items():
        if "instal" in col_norm or "cod" in col_norm:
            return col_original
    return None

def _mapear_coluna_nome(df: pd.DataFrame) -> Optional[str]:
    termos_nome_norm = [_norm(c) for c in COLUMNS_MAP['nome']]
    for nome_coluna_original in df.columns:
        if _norm(nome_coluna_original) in termos_nome_norm:
             return nome_coluna_original
    return None

def criar_mapa_clientes(df_clientes: pd.DataFrame) -> Dict[str, str]:
    col_uc = _mapear_coluna_uc(df_clientes)
    col_nome = _mapear_coluna_nome(df_clientes)

    if not col_uc or not col_nome:
        return {}

    mapa = {}
    for idx, row in df_clientes.iterrows():
        raw_uc = str(row.get(col_uc, '')).strip()
        nome = str(row.get(col_nome, '')).strip()
        if not raw_uc or not nome or raw_uc.lower() == 'nan':
            continue
        mapa[raw_uc] = nome
        chave_limpa = limpar_uc(raw_uc)
        if chave_limpa:
            mapa[chave_limpa] = nome 
    return mapa

# --- ORQUESTRAÇÃO PRINCIPAL ---

def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    try:
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        aba_detalhe, header_idx_detalhe = find_sheet_and_header(xls, ["REF", "Instalação"], prefer_name="Detalhe")
        
        if not aba_detalhe:
            return json.dumps({"error": "Aba 'Detalhe Por UC' não encontrada."})

        df = pd.read_excel(xls, sheet_name=aba_detalhe, header=header_idx_detalhe)
        df.columns = [str(c).strip() for c in df.columns]

        cols_map = {k: pick_col(df, *v) for k, v in COLUMNS_MAP.items()}
        col_instalacao_detalhe = _mapear_coluna_uc(df)
        
        if not col_instalacao_detalhe:
            return json.dumps({
                "error": "Coluna de Instalação não identificada no detalhe.",
                "details": _diagnosticar_colunas(df)
            })

        mapa_clientes = {}
        warnings = []
        
        aba_clientes = None
        for sheet in xls.sheet_names:
            if 'info' in sheet.lower() and 'cliente' in sheet.lower():
                aba_clientes = sheet; break
        
        if not aba_clientes:
            aba_clientes, h_idx = find_sheet_and_header(xls, ["Nome", "Razão Social", "Instalação"], prefer_name="Infos")
            header_idx_cli = h_idx
        else:
            _, header_idx_cli = find_sheet_and_header(xls, ["Nome", "Instalação"], prefer_name=aba_clientes)
        
        if aba_clientes:
            try:
                df_ref = pd.read_excel(xls, sheet_name=aba_clientes, header=header_idx_cli)
                mapa_clientes = criar_mapa_clientes(df_ref)
                print(f"✓ Mapa de clientes carregado: {len(mapa_clientes)} registros.")
            except Exception as e:
                print(f"✗ ERRO ao processar aba clientes: {str(e)}")

        df_mes = df.copy()
        if cols_map['ref']:
            date_input = mes_referencia_str.strip()
            if len(date_input) == 7: date_input += '-01'
            try:
                mes_ref_dt = datetime.strptime(date_input, '%Y-%m-%d')
                df['__ref_dt'] = df[cols_map['ref']].apply(safe_parse_date)
                df_mes = df[
                    (df['__ref_dt'].dt.year == mes_ref_dt.year) & 
                    (df['__ref_dt'].dt.month == mes_ref_dt.month)
                ].copy()
            except:
                pass 

        if cols_map.get('boleto_ev'):
            df_mes = df_mes[df_mes[cols_map['boleto_ev']].apply(to_num) >= 5].copy()

        if df_mes.empty:
            return json.dumps({"error": f"Nenhum registro encontrado para {mes_referencia_str}."})

        clientes = []

        for idx, row in df_mes.iterrows():
            try:
                raw_id = str(row.get(col_instalacao_detalhe, '')).strip()
                id_limpo = limpar_uc(raw_id)
                
                nome_cliente = None
                status_mapeamento = "OK"
                
                if raw_id in mapa_clientes:
                    nome_cliente = mapa_clientes[raw_id]
                elif id_limpo in mapa_clientes:
                    nome_cliente = mapa_clientes[id_limpo]
                
                if nome_cliente:
                    final_client_name = nome_cliente
                else:
                    final_client_name = "Cliente não identificado"
                    status_mapeamento = "Nome Não Mapeado"
                    warnings.append({
                        "type": "warning",
                        "severity": "warning",
                        "title": "Nome Não Mapeado",
                        "message": f"Instalação '{raw_id}' não encontrada na base.",
                        "details": {"uc_buscada": raw_id}
                    })

                metrics = compute_metrics(row, cols_map, vencimento_str)
                
                ends = []
                for k in ['endereco', 'bairro', 'cidade']:
                    col_name = cols_map.get(k)
                    if col_name:
                        val = safe_str(row.get(col_name))
                        if val: ends.append(val)
                
                endereco_completo = " - ".join(ends)

                cliente = {
                    "raw_id": raw_id,
                    "nome": final_client_name,
                    "status_mapeamento": status_mapeamento,
                    "documento": safe_str(row.get(cols_map.get('doc'))),
                    "instalacao": raw_id,
                    "endereco": endereco_completo,
                    "num_conta": safe_str(row.get(cols_map.get('num_conta'))),
                    "economiaTotal": metrics['economiaMes'],
                }
                
                cliente.update(metrics)
                clientes.append(cliente)

            except Exception as ex:
                warnings.append({
                    "type": "error", "severity": "error",
                    "title": "Erro na linha", "message": str(ex)
                })

        return json.dumps({
            "data": clientes,
            "warnings": warnings
        })

    except Exception as e:
        return json.dumps({"error": f"Erro crítico: {traceback.format_exc()}"})