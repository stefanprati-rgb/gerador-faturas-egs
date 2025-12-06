import pandas as pd
import io, json
import traceback
import warnings as python_warnings
from datetime import datetime
import re
from typing import Optional, Dict, Any

# =================================================================
# MÓDULO DE CÁLCULOS INTEGRADO (MODO ESPELHO)
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
        if isinstance(val, (int, float)): return float(val)
        
        val_str = str(val).strip()
        val_str = val_str.replace('R$', '').replace(' ', '')

        if ',' in val_str and '.' in val_str:
            if val_str.rfind(',') > val_str.rfind('.'): # BR: 1.200,50
                val_str = val_str.replace('.', '').replace(',', '.')
            else: # US: 1,200.50
                val_str = val_str.replace(',', '')
        elif ',' in val_str: # Apenas vírgula -> BR
            val_str = val_str.replace(',', '.')
        
        return float(val_str)
    except:
        return 0.0

def compute_metrics(row, cols_map, vencimento_iso):
    """
    Prepara os dados para o PDF priorizando os valores já calculados na planilha.
    """
    def get(key, default=0.0):
        col = cols_map.get(key)
        return to_num(row.get(col, default)) if col else default

    # 1. Leitura dos Valores Financeiros Reais (Padrão Ouro)
    dist_total_real = get('fatura_c_gd') 
    egs_total_real = get('boleto_ev')
    consumo_qtd = get('consumo_qtd')
    comp_qtd = get('comp_qtd')

    # 2. Engenharia Reversa Visual (Para preencher tabelas do PDF)
    if consumo_qtd > 0 and dist_total_real > 0:
        tarifa_cons_visual = dist_total_real / consumo_qtd
        if tarifa_cons_visual > 10: tarifa_cons_visual = 0.0
    else:
        tarifa_cons_visual = 0.0

    if comp_qtd > 0 and egs_total_real > 0:
        tarifa_credito_visual = egs_total_real / comp_qtd
    else:
        tarifa_credito_visual = 0.0

    # 3. Estimativa de Economia (Se não houver na planilha)
    custo_com_solar = dist_total_real + egs_total_real
    if consumo_qtd > 0:
        custo_sem_solar = consumo_qtd * 1.15 # Estimativa Tarifa Cheia (~R$ 1.15)
    else:
        custo_sem_solar = custo_com_solar * 1.10

    economia_mes = custo_sem_solar - custo_com_solar
    if economia_mes < 0: economia_mes = 0.0

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
# PROCESSADOR PRINCIPAL
# =================================================================

# Suprime warnings do openpyxl
python_warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')

COLUMNS_MAP = {
    'ref': ["REF", "Mês de Referência", "Competência"],
    'inst': ["Instalação", "Nº Instalação", "UC", "Codigo"],
    # Dados Cadastrais (Buscados na aba Clientes)
    'nome': ["Nome Cliente", "Nome/Razão Social", "Cliente", "NOME", "RAZÃO SOCIAL"],
    'doc': ["Documento", "CPF/CNPJ", "CPF", "CNPJ"],
    'endereco': ["Endereço", "Logradouro", "Rua"],
    'bairro': ["Bairro"],
    'cidade': ["Cidade", "Município"],
    'num_conta': ["Número da conta", "Conta Contrato", "Conta"],
    # Dados Financeiros (Buscados na aba Detalhe)
    'consumo_qtd': ["CONSUMO_FP", "Energia consumida - Fora ponta - quantidade", "Consumo KWh"],
    'comp_qtd': ["CRÉD. CONSUMIDO_FP", "Creditos consumidos - Fora ponta - quantidade", "Energia Compensada"],
    'tarifa_consumo': ["TARIFA FP", "Energia consumida - Fora ponta - tarifa", "Tarifa Cheia"],
    'tarifa_comp_ev': ["TARIFA_Comp_FP", "Tarifa EGS", "Tarifa Acordada"],
    'tarifa_comp_dist': ["TARIFA DE ENERGIA COMPENSADA", "Tarifa Fio B", "Tarifa Compensação"],
    'fatura_c_gd': ["FATURA C/GD", "Saldo Próximo Mês", "Valor Fatura Distribuidora"],
    'boleto_ev': ["Boleto Hube", "Valor enviado para emissão", "Valor Cobrado"]
}

def limpar_uc(valor):
    """Remove caracteres especiais da UC (ex: 10/10232-7 -> 10102327)"""
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
        if p.lower() in cols_lower: return cols_lower[p.lower()]
    return None

def _norm(s):
    return re.sub(r'[^a-zA-Z0-9]', '', str(s).lower())

def _diagnosticar_colunas(df: pd.DataFrame) -> str:
    colunas = list(df.columns)
    mostrar = colunas[:10]
    res = f"Colunas ({len(colunas)}): {', '.join(mostrar)}"
    if len(colunas) > 10: res += "..."
    return res

def _mapear_coluna_uc(df: pd.DataFrame) -> Optional[str]:
    termos = ["INSTALACAO", "INSTALAÇÃO", "Nº INSTALACAO", "UC", "CODIGO"]
    colunas_map = {_norm(col): col for col in df.columns}
    for t in termos:
        if _norm(t) in colunas_map: return colunas_map[_norm(t)]
    for c_norm, c_orig in colunas_map.items():
        if "instal" in c_norm or "cod" in c_norm: return c_orig
    return None

def _mapear_coluna_generic(df: pd.DataFrame, keys_list) -> Optional[str]:
    colunas_map = {_norm(col): col for col in df.columns}
    for k in keys_list:
        if _norm(k) in colunas_map: return colunas_map[_norm(k)]
    return None

def criar_mapa_completo_clientes(df_clientes: pd.DataFrame) -> Dict[str, Dict]:
    """Cria um mapa completo: ID -> {Nome, CNPJ, Endereço, Conta, etc}"""
    col_uc = _mapear_coluna_uc(df_clientes)
    cols_cli = {}
    for field in ['nome', 'doc', 'endereco', 'bairro', 'cidade', 'num_conta']:
        cols_cli[field] = _mapear_coluna_generic(df_clientes, COLUMNS_MAP[field])

    if not col_uc: return {}

    mapa = {}
    for idx, row in df_clientes.iterrows():
        raw_uc = str(row.get(col_uc, '')).strip()
        if not raw_uc or raw_uc.lower() == 'nan': continue
        
        # Ficha Cadastral Completa
        ficha = {}
        for field, col_name in cols_cli.items():
            if col_name:
                ficha[field] = safe_str(row.get(col_name))
        
        # Armazena pela chave original e pela chave limpa
        mapa[raw_uc] = ficha
        chave_limpa = limpar_uc(raw_uc)
        if chave_limpa:
            mapa[chave_limpa] = ficha
            
    return mapa

def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    try:
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        # 1. Carregar Aba Detalhe (Dados Financeiros)
        aba_detalhe, h_idx_det = find_sheet_and_header(xls, ["REF", "Instalação"], prefer_name="Detalhe")
        if not aba_detalhe: return json.dumps({"error": "Aba 'Detalhe Por UC' não encontrada."})

        df = pd.read_excel(xls, sheet_name=aba_detalhe, header=h_idx_det)
        df.columns = [str(c).strip() for c in df.columns]
        
        cols_map_det = {k: pick_col(df, *v) for k, v in COLUMNS_MAP.items()}
        col_inst_det = _mapear_coluna_uc(df)
        
        if not col_inst_det:
            return json.dumps({"error": "Coluna Instalação não achada no detalhe.", "details": _diagnosticar_colunas(df)})

        # 2. Carregar Aba Clientes (Dados Cadastrais)
        mapa_clientes = {}
        aba_clientes = None
        for sheet in xls.sheet_names:
            if 'info' in sheet.lower() and 'cliente' in sheet.lower(): aba_clientes = sheet; break
        
        if not aba_clientes:
            aba_clientes, h_idx_cli = find_sheet_and_header(xls, ["Nome", "Razão Social", "Instalação"], prefer_name="Infos")
        else:
            _, h_idx_cli = find_sheet_and_header(xls, ["Nome", "Instalação"], prefer_name=aba_clientes)
            
        if aba_clientes:
            try:
                df_cli = pd.read_excel(xls, sheet_name=aba_clientes, header=h_idx_cli)
                mapa_clientes = criar_mapa_completo_clientes(df_cli)
                print(f"✓ Mapa de clientes carregado: {len(mapa_clientes)} registros.")
            except Exception as e:
                print(f"✗ ERRO ao processar aba clientes: {str(e)}")

        # 3. Filtrar por Mês
        df_mes = df.copy()
        if cols_map_det['ref']:
            date_input = mes_referencia_str.strip()
            if len(date_input) == 7: date_input += '-01'
            try:
                mes_ref_dt = datetime.strptime(date_input, '%Y-%m-%d')
                df['__ref_dt'] = df[cols_map_det['ref']].apply(safe_parse_date)
                df_mes = df[(df['__ref_dt'].dt.year == mes_ref_dt.year) & (df['__ref_dt'].dt.month == mes_ref_dt.month)].copy()
            except: pass

        if cols_map_det.get('boleto_ev'):
            df_mes = df_mes[df_mes[cols_map_det['boleto_ev']].apply(to_num) >= 5].copy()

        if df_mes.empty: return json.dumps({"error": f"Sem dados para {mes_referencia_str}."})

        # 4. Processamento Final (Merge Inteligente)
        clientes = []
        warnings = []

        for idx, row in df_mes.iterrows():
            try:
                raw_id = str(row.get(col_inst_det, '')).strip()
                id_limpo = limpar_uc(raw_id)
                
                # Busca Ficha Cadastral (Prioridade na chave limpa)
                ficha = {}
                status_map = "OK"
                
                if raw_id in mapa_clientes: ficha = mapa_clientes[raw_id]
                elif id_limpo in mapa_clientes: ficha = mapa_clientes[id_limpo]
                
                if not ficha:
                    status_map = "Nome Não Mapeado"
                    warnings.append({"type": "warning", "title": "Cliente não achado", "message": f"UC {raw_id} sem cadastro."})

                # Função Get Inteligente: Tenta Detalhe -> Tenta Ficha -> Vazio
                def get_val(field):
                    col_det = cols_map_det.get(field)
                    # 1. Se tem na planilha de consumo e não é vazio
                    if col_det and pd.notna(row.get(col_det)) and str(row.get(col_det)).strip() != '':
                        return safe_str(row.get(col_det))
                    # 2. Se não, busca no cadastro do cliente
                    if ficha and field in ficha and ficha[field]:
                        return ficha[field]
                    return ""

                metrics = compute_metrics(row, cols_map_det, vencimento_str)
                
                # Monta endereço completo se os campos existirem na ficha
                ends = []
                rua = get_val('endereco')
                bairro = get_val('bairro')
                cidade = get_val('cidade')
                if rua: ends.append(rua)
                if bairro: ends.append(bairro)
                if cidade: ends.append(cidade)
                endereco_completo = " - ".join(ends)

                cliente = {
                    "raw_id": raw_id,
                    "instalacao": raw_id,
                    "nome": get_val('nome') or "Cliente não identificado",
                    "documento": get_val('doc'),       # Puxa do cadastro se faltar no detalhe
                    "num_conta": get_val('num_conta'), # Puxa do cadastro se faltar no detalhe
                    "endereco": endereco_completo,     # Puxa do cadastro se faltar no detalhe
                    "status_mapeamento": status_map,
                    "economiaTotal": metrics['economiaMes'],
                }
                
                cliente.update(metrics)
                clientes.append(cliente)

            except Exception as ex:
                warnings.append({"type": "error", "title": "Erro linha", "message": str(ex)})

        return json.dumps({"data": clientes, "warnings": warnings})

    except Exception as e:
        return json.dumps({"error": f"Erro crítico: {traceback.format_exc()}"})