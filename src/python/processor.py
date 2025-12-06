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
    Converte valores para float de forma segura (BR ou US).
    """
    if pd.isna(val) or val == '': return 0.0
    try:
        if isinstance(val, (int, float)): return float(val)
        val_str = str(val).strip().replace('R$', '').replace(' ', '')
        if ',' in val_str and '.' in val_str:
            if val_str.rfind(',') > val_str.rfind('.'): # BR
                val_str = val_str.replace('.', '').replace(',', '.')
            else: # US
                val_str = val_str.replace(',', '')
        elif ',' in val_str: # BR
            val_str = val_str.replace(',', '.')
        return float(val_str)
    except:
        return 0.0

def compute_metrics(row, cols_map, vencimento_iso):
    """Prepara os dados para o PDF priorizando valores da planilha."""
    def get(key, default=0.0):
        col = cols_map.get(key)
        return to_num(row.get(col, default)) if col else default

    # 1. Leitura dos Valores Reais (Padrão Ouro)
    dist_total_real = get('fatura_c_gd') 
    egs_total_real = get('boleto_ev')
    consumo_qtd = get('consumo_qtd')
    comp_qtd = get('comp_qtd')

    # 2. Engenharia Reversa Visual
    tarifa_cons_visual = (dist_total_real / consumo_qtd) if (consumo_qtd > 0 and dist_total_real > 0) else 0.0
    if tarifa_cons_visual > 10: tarifa_cons_visual = 0.0
    
    tarifa_credito_visual = (egs_total_real / comp_qtd) if (comp_qtd > 0 and egs_total_real > 0) else 0.0

    # 3. Estimativa de Economia
    custo_com_solar = dist_total_real + egs_total_real
    if consumo_qtd > 0:
        custo_sem_solar = consumo_qtd * 1.15 # Estimativa Tarifa Cheia
    else:
        custo_sem_solar = custo_com_solar * 1.10

    economia_mes = max(0.0, custo_sem_solar - custo_com_solar)

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

# COLUMNS_MAP AJUSTADO COM SEUS NOMES REAIS
COLUMNS_MAP = {
    'ref': ["REF (sempre dia 01 de cada mês)", "REF", "Mês de Referência", "Competência", "Data", "Data Ref", "Referencia", "Mês", "Referência", "Data Emissao"],
    'inst': ["Instalação", "Nº Instalação", "UC", "Codigo"],
    # Dados Cadastrais
    'nome': ["Nome Cliente", "Nome/Razão Social", "Cliente", "NOME", "RAZÃO SOCIAL"],
    'doc': ["Documento", "CPF/CNPJ", "CPF", "CNPJ"],
    'endereco': ["Endereço", "Logradouro", "Rua"],
    'bairro': ["Bairro"],
    'cidade': ["Cidade", "Município"],
    'num_conta': ["Número da conta", "Conta Contrato", "Conta"],
    # Dados Financeiros (Atualizados com sua lista)
    'consumo_qtd': ["CONSUMO_FP", "Energia consumida - Fora ponta - quantidade", "Consumo KWh"],
    'comp_qtd': ["CRÉD. CONSUMIDO_FP", "Creditos consumidos - Fora ponta - quantidade", "Energia Compensada"],
    'tarifa_consumo': ["TARIFA S/ IMPOSTOS FP", "TARIFA FP", "Energia consumida - Fora ponta - tarifa", "Tarifa Cheia"],
    'tarifa_comp_ev': ["TARIFA_Comp_FP", "Tarifa EGS", "Tarifa Acordada"],
    'tarifa_comp_dist': ["TARIFA DE ENERGIA COMPENSADA", "Tarifa Fio B", "Tarifa Compensação"],
    'fatura_c_gd': ["FATURA C/GD", "Saldo Próximo Mês", "Valor Fatura Distribuidora"],
    'boleto_ev': ["valorTotal", "Boleto Hube", "Valor enviado para emissão", "Valor Cobrado", "Valor Boleto"]
}

def limpar_uc(valor):
    if not valor: return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(valor)).upper()

def safe_str(val):
    if pd.isna(val) or val is None: return ""
    return str(val).strip()

def safe_parse_date(val):
    try:
        if pd.isna(val): return None
        if isinstance(val, datetime): return val
        # Tenta múltiplos formatos
        val_str = str(val).strip()[:10] # Pega só a data se tiver hora
        for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d']:
            try:
                return datetime.strptime(val_str, fmt)
            except: continue
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
        except: continue
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
    res = f"Colunas encontradas ({len(colunas)}): {', '.join(mostrar)}"
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
    col_uc = _mapear_coluna_uc(df_clientes)
    cols_cli = {}
    for field in ['nome', 'doc', 'endereco', 'bairro', 'cidade', 'num_conta']:
        cols_cli[field] = _mapear_coluna_generic(df_clientes, COLUMNS_MAP[field])

    if not col_uc: 
        print("✗ ERRO: Coluna UC não encontrada na aba Infos Clientes")
        return {}
    
    print(f"✓ Coluna UC encontrada: '{col_uc}'")
    print(f"✓ Colunas mapeadas: {cols_cli}")

    mapa = {}
    for idx, row in df_clientes.iterrows():
        raw_uc = str(row.get(col_uc, '')).strip()
        if not raw_uc or raw_uc.lower() == 'nan': continue
        ficha = {}
        for field, col_name in cols_cli.items():
            if col_name: 
                valor = safe_str(row.get(col_name))
                ficha[field] = valor
                if idx < 3:  # Debug primeiras 3 linhas
                    print(f"  UC {raw_uc} - {field}: '{valor}' (coluna: {col_name})")
        mapa[raw_uc] = ficha
        chave_limpa = limpar_uc(raw_uc)
        if chave_limpa: mapa[chave_limpa] = ficha
    
    print(f"✓ Mapa criado com {len(mapa)} registros")
    return mapa

def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    try:
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        # 1. Carregar Aba Detalhe
        aba_detalhe, h_idx_det = find_sheet_and_header(xls, ["REF", "Instalação", "Data"], prefer_name="Detalhe")
        if not aba_detalhe: return json.dumps({"error": "Aba 'Detalhe Por UC' não encontrada."})

        df = pd.read_excel(xls, sheet_name=aba_detalhe, header=h_idx_det)
        df.columns = [str(c).strip() for c in df.columns]
        
        cols_map_det = {k: pick_col(df, *v) for k, v in COLUMNS_MAP.items()}
        col_inst_det = _mapear_coluna_uc(df)
        
        if not col_inst_det:
            return json.dumps({"error": "Coluna Instalação não achada no detalhe.", "details": _diagnosticar_colunas(df)})

        # --- TRAVA DE SEGURANÇA: FILTRO DE DATA OBRIGATÓRIO ---
        if not cols_map_det['ref']:
            # Se não achou coluna de data, aborta para não gerar 850 faturas
            return json.dumps({
                "error": "Não encontrei a coluna de DATA/MÊS na planilha.", 
                "details": f"O sistema precisa saber o mês para gerar apenas as faturas corretas. {_diagnosticar_colunas(df)}"
            })

        # 2. Carregar Aba Clientes
        mapa_clientes = {}
        aba_clientes = None
        
        print(f"📋 Procurando aba de clientes. Abas disponíveis: {xls.sheet_names}")
        
        for sheet in xls.sheet_names:
            if 'info' in sheet.lower() and 'cliente' in sheet.lower(): 
                aba_clientes = sheet
                print(f"✓ Aba de clientes encontrada: '{aba_clientes}'")
                break
        
        if not aba_clientes:
            print("⚠ Aba 'Infos Clientes' não encontrada pelo nome, tentando busca por colunas...")
            aba_clientes, h_idx_cli = find_sheet_and_header(xls, ["Nome/Razão Social", "CPF/CNPJ", "Instalação"], prefer_name="Infos")
            if aba_clientes:
                print(f"✓ Aba encontrada por busca: '{aba_clientes}' (header linha {h_idx_cli})")
        else:
            # Para aba Infos Clientes, procurar por colunas específicas
            _, h_idx_cli = find_sheet_and_header(xls, ["Nome/Razão Social", "CPF/CNPJ", "Instalação"], prefer_name=aba_clientes)
            print(f"✓ Header da aba '{aba_clientes}' na linha {h_idx_cli}")
            
        if aba_clientes:
            try:
                df_cli = pd.read_excel(xls, sheet_name=aba_clientes, header=h_idx_cli)
                print(f"✓ Aba '{aba_clientes}' carregada com {len(df_cli)} linhas")
                print(f"  Colunas: {list(df_cli.columns[:10])}")
                mapa_clientes = criar_mapa_completo_clientes(df_cli)
                print(f"✓ Mapa de clientes carregado: {len(mapa_clientes)} registros.")
            except Exception as e:
                print(f"✗ ERRO ao carregar aba clientes: {str(e)}")
        else:
            print("✗ AVISO: Nenhuma aba de clientes encontrada!")

        # 3. Filtrar por Mês (AGORA COM LOG E TRATAMENTO DE ERRO)
        df_mes = pd.DataFrame()
        date_input = mes_referencia_str.strip()
        if len(date_input) == 7: date_input += '-01'
        
        try:
            mes_ref_dt = datetime.strptime(date_input, '%Y-%m-%d')
            df['__ref_dt'] = df[cols_map_det['ref']].apply(safe_parse_date)
            
            # Filtra onde Ano e Mês batem
            df_mes = df[(df['__ref_dt'].dt.year == mes_ref_dt.year) & (df['__ref_dt'].dt.month == mes_ref_dt.month)].copy()
            
            print(f"✓ Filtro de Data Aplicado: {len(df_mes)} registros encontrados para {mes_referencia_str}")
        except Exception as e:
            return json.dumps({"error": f"Erro ao filtrar data na coluna '{cols_map_det['ref']}': {str(e)}"})

        if cols_map_det.get('boleto_ev'):
            df_mes = df_mes[df_mes[cols_map_det['boleto_ev']].apply(to_num) >= 5].copy()

        if df_mes.empty: 
            return json.dumps({"error": f"Nenhum registro encontrado para {mes_referencia_str}. Verifique se a data na planilha bate com a data selecionada."})

        # 4. Processamento
        clientes = []
        warnings = []

        for idx, row in df_mes.iterrows():
            try:
                raw_id = str(row.get(col_inst_det, '')).strip()
                id_limpo = limpar_uc(raw_id)
                
                ficha = {}
                status_map = "OK"
                if raw_id in mapa_clientes: ficha = mapa_clientes[raw_id]
                elif id_limpo in mapa_clientes: ficha = mapa_clientes[id_limpo]
                
                if not ficha:
                    status_map = "Nome Não Mapeado"
                    warnings.append({"type": "warning", "title": "Cliente não achado", "message": f"UC {raw_id} sem cadastro."})

                def get_val(field):
                    col_det = cols_map_det.get(field)
                    if col_det and pd.notna(row.get(col_det)) and str(row.get(col_det)).strip() != '':
                        return safe_str(row.get(col_det))
                    if ficha and field in ficha and ficha[field]:
                        return ficha[field]
                    return ""

                metrics = compute_metrics(row, cols_map_det, vencimento_str)
                
                ends = []
                rua = get_val('endereco'); bairro = get_val('bairro'); cidade = get_val('cidade')
                if rua: ends.append(rua)
                if bairro: ends.append(bairro)
                if cidade: ends.append(cidade)
                endereco_completo = " - ".join(ends)

                cliente = {
                    "raw_id": raw_id,
                    "instalacao": raw_id,
                    "nome": get_val('nome') or "Cliente não identificado",
                    "documento": get_val('doc'),
                    "num_conta": get_val('num_conta'),
                    "endereco": endereco_completo,
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