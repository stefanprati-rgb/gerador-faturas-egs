import pandas as pd
import io, re, json, unicodedata
from datetime import datetime

# Constantes
CO2_PER_KWH = 0.07
TREES_PER_TON_CO2 = 8
FALLBACK_TARIFA_DIST = 0.916370
FALLBACK_TARIFA_COMP_EV = 0.716045

def _norm(s: str) -> str:
    s = str(s or "")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().upper()

def to_num(x) -> float:
    if pd.isna(x): return 0.0
    if isinstance(x, (int, float)): return float(x)
    s = str(x).replace("\u00a0", " ").strip()
    neg = False
    if s.startswith('(') and s.endswith(')'):
        neg = True
        s = s[1:-1]
    s = re.sub(r"[Rr]\$|\%", "", s).replace(" ", "")
    s = s.replace('—', '0').replace('--', '0').replace('-', '-').strip()
    if s in {"", "--", "---"}: return 0.0
    s = s.replace("+", "")
    if s.count(",") == 1 and s.count(".") >= 1: s = s.replace(".", "").replace(",", ".")
    elif s.count(",") == 1 and s.count(".") == 0: s = s.replace(",", ".")
    try: v = float(s)
    except Exception: v = 0.0
    return -v if neg else v

def pick_col(df: pd.DataFrame, *alternativas) -> str:
    cols_norm = {_norm(c): c for c in df.columns}
    for alt in alternativas:
        key = _norm(alt)
        if key in cols_norm: return cols_norm[key]
    for k, original in cols_norm.items():
        if any(_norm(a) in k for a in alternativas): return original
    return None

def find_sheet_and_header(xls: pd.ExcelFile, key_cols, prefer_name=None, max_rows=30):
    sheet_names = list(xls.sheet_names)
    if prefer_name and prefer_name in sheet_names:
        sheet_names.insert(0, sheet_names.pop(sheet_names.index(prefer_name)))
    for sheet_name in sheet_names:
        try:
            df_sample = pd.read_excel(xls, sheet_name=sheet_name, header=None, nrows=max_rows)
            for i, row in df_sample.iterrows():
                row_as_string = " ".join(str(v) for v in row.dropna().values)
                if all(k in row_as_string for k in key_cols):
                    return sheet_name, i
        except Exception:
            continue
    return None, -1

def safe_parse_date_column(series):
    def parse_single(val):
        if pd.isna(val): return pd.NaT
        if isinstance(val, (int, float)):
            try: return pd.to_datetime('1899-12-30') + pd.to_timedelta(val, 'D')
            except: return pd.NaT
        try: return pd.to_datetime(str(val)[:10], errors='coerce')
        except: return pd.NaT
    return series.apply(parse_single)

def month_period(dt: datetime):
    return pd.to_datetime(dt).to_period("M") if pd.notna(dt) else None

def compute_row_metrics(row, cols, vencimento_iso: str):
    consumo_qtd    = to_num(row.get(cols.get('consumo_qtd'), 0))
    comp_qtd       = to_num(row.get(cols.get('comp_qtd'), 0))
    tarifa_cons_raw = to_num(row.get(cols.get('tarifa_consumo'), None)) if cols.get('tarifa_consumo') else 0.0
    used_fallback_tar_cons = tarifa_cons_raw <= 0
    tarifa_cons = tarifa_cons_raw if tarifa_cons_raw > 0 else FALLBACK_TARIFA_DIST
    tarifa_comp_ev = to_num(row.get(cols.get('tarifa_comp_ev'), 0))
    tarifa_comp_dist_raw = to_num(row.get(cols.get('tarifa_comp_dist'), None)) if cols.get('tarifa_comp_dist') else 0.0
    tarifa_comp_dist = tarifa_comp_dist_raw if tarifa_comp_dist_raw > 0 else (tarifa_comp_ev or FALLBACK_TARIFA_COMP_EV)
    consumo_total_val   = consumo_qtd * tarifa_cons
    comp_total_val_dist = comp_qtd * tarifa_comp_dist
    fatura_dist_real = to_num(row.get(cols.get('fatura_c_gd'), 0))
    dist_outros_val = max(0.0, round(fatura_dist_real - (consumo_total_val - comp_total_val_dist), 2))
    dist_total = fatura_dist_real
    boleto_ev = to_num(row.get(cols.get('boleto_ev'), 0))
    if boleto_ev > 0:
        contrib_total = boleto_ev
        det_credito_tar = 0.0
        det_credito_total = contrib_total
    else:
        det_credito_tar = tarifa_comp_ev or FALLBACK_TARIFA_COMP_EV
        det_credito_total = comp_qtd * det_credito_tar
        contrib_total = det_credito_total
    econ_total_sem = consumo_total_val + dist_outros_val
    econ_total_com = dist_total + contrib_total
    co2_kg = comp_qtd * CO2_PER_KWH
    tarifa_efetiva = (contrib_total / comp_qtd) if comp_qtd > 0 else 0.0
    calc_dist_total = consumo_total_val - comp_total_val_dist + dist_outros_val
    diff = abs(calc_dist_total - dist_total)
    
    def r(x, d): return round(float(x or 0), d)
    return {
        "dist_consumo_qtd": r(consumo_qtd, 2), "dist_consumo_tar": r(tarifa_cons, 4), "dist_consumo_total": r(consumo_total_val, 2),
        "dist_comp_qtd": r(comp_qtd, 2), "dist_comp_tar": r(tarifa_comp_dist, 4), "dist_comp_total": r(-comp_total_val_dist, 2),
        "dist_outros": r(dist_outros_val, 2), "dist_total": r(dist_total, 2), "det_credito_qtd": r(comp_qtd, 2),
        "det_credito_tar": r(det_credito_tar, 4), "det_credito_total": r(det_credito_total, 2), "totalPagar": r(contrib_total, 2),
        "econ_total_sem": r(econ_total_sem, 2), "econ_total_com": r(econ_total_com, 2), "co2Evitado": r(co2_kg, 2),
        "arvoresEquivalentes": r((co2_kg / 1000.0) * TREES_PER_TON_CO2, 2), "vencimento_iso": vencimento_iso,
        "emissao_iso": datetime.now().strftime('%Y-%m-%d'), "det_credito_tar_efetiva": r(tarifa_efetiva, 4),
        "used_fallback_tar_cons": used_fallback_tar_cons, "_divergencia_calculo": r(diff, 2)
    }

def accumulate_economy(df_calc, cols_map):
    col_inst, col_ref = cols_map.get('inst'), cols_map.get('ref')
    
    # Criar colunas base com 0.0 se não existirem
    for key in ['comp_qtd', 'tarifa_comp_ev', 'boleto_ev', 'custo_s_gd', 'fatura_c_gd']:
        col_name = cols_map.get(key)
        if col_name and col_name in df_calc.columns:
            df_calc[f'_{key}'] = df_calc[col_name].apply(to_num)
        else:
            val = FALLBACK_TARIFA_COMP_EV if key == 'tarifa_comp_ev' else 0.0
            df_calc[f'_{key}'] = val

    # Valor final considerado para a fatura (boleto ou cálculo)
    valor_final = df_calc['_boleto_ev'].where(df_calc['_boleto_ev'] > 0, (df_calc['_comp_qtd'] * df_calc['_tarifa_comp_ev']))
    
    # Economia do mês: Custo sem GD - (Fatura com GD + Valor pago a EGS)
    df_calc['_econ_mes_raw'] = (df_calc['_custo_s_gd'] - (df_calc['_fatura_c_gd'] + valor_final)).round(2)
    df_calc['_econ_mes'] = df_calc['_econ_mes_raw'].clip(lower=0)
    
    if col_inst and col_ref and col_inst in df_calc.columns and col_ref in df_calc.columns:
        df_calc[col_ref] = safe_parse_date_column(df_calc[col_ref])
        df_calc.sort_values(by=[col_inst, col_ref], inplace=True)
        df_calc['_econ_acum'] = df_calc.groupby(col_inst)['_econ_mes'].cumsum().fillna(0)
    else:
        df_calc['_econ_acum'] = df_calc['_econ_mes']
    return df_calc

def run_validations(df_mes, cols_map):
    warnings = []
    
    # 1. Validar Duplicatas
    col_inst = cols_map.get('inst')
    if col_inst:
        duplicados = df_mes[df_mes.duplicated(subset=[col_inst], keep=False)]
        if not duplicados.empty:
            insts = duplicados[col_inst].unique().tolist()
            warnings.append({
                "type": "error",
                "severity": "error",
                "title": "Clientes Duplicados",
                "message": f"Foram encontradas múltiplas linhas para {len(insts)} instalação(ões) neste mês.",
                "details": {"instalacoes": insts[:10]}
            })

    # 2. Validar Consumo Zerado ou Negativo
    col_consumo = cols_map.get('consumo_qtd')
    if col_consumo:
        zerados = df_mes[df_mes[col_consumo].apply(to_num) <= 0]
        if not zerados.empty:
            count = len(zerados)
            warnings.append({
                "type": "warning",
                "severity": "warning",
                "title": "Consumo Zerado ou Negativo",
                "message": f"{count} cliente(s) possuem consumo registrado como 0 ou negativo.",
                "details": {"count": count}
            })

    # 3. Validar Economia Negativa (Anomalia)
    negativos = df_mes[df_mes['_econ_mes_raw'] < -5]  # Tolerância de R$5
    if not negativos.empty:
        count = len(negativos)
        warnings.append({
            "type": "warning",
            "severity": "warning",
            "title": "Economia Negativa Detectada",
            "message": f"{count} cliente(s) teriam prejuízo (economia negativa) com os dados atuais.",
            "details": {"count": count, "info": "O sistema ajustou a economia para 0 no relatório"}
        })

    return warnings

def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    try:
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        aba_consumo, header_consumo = find_sheet_and_header(xls, ["REF", "Instalação", "CRÉD. CONSUMIDO_FP"], prefer_name="Detalhe Por UC")
        if not aba_consumo: return json.dumps({"error": "Aba com dados de consumo não foi encontrada."})

        df = pd.read_excel(xls, sheet_name=aba_consumo, header=header_consumo)
        df.columns = [str(c).strip() for c in df.columns]
        
        def col(*alts): return pick_col(df, *alts)
        cols_map = {
            'ref': col("REF (sempre dia 01 de cada mês)", "REF"), 
            'inst': col("Instalação", "Nº Instalação"), 
            'nome': col("Nome Cliente", "Nome/Razão Social"), 
            'doc': col("Documento", "CPF/CNPJ"), 
            'consumo_qtd': col("CONSUMO_FP"), 
            'comp_qtd': col("CRÉD. CONSUMIDO_FP"), 
            'tarifa_consumo': col("TARIFA FP"), 
            'tarifa_comp_ev': col("TARIFA_Comp_FP"), 
            'tarifa_comp_dist': col("TARIFA DE ENERGIA COMPENSADA"), 
            'outros': col("OUTROS"), 
            'boleto_ev': col("Boleto Hube definido para a ref. Mensal", "Valor enviado para emissão", "Valor enviado p/ emissão"), 
            'num_conta': col("Número da conta"), 
            'endereco': col("Endereço"), 
            'bairro': col("Bairro"), 
            'cidade': col("Cidade"), 
            'custo_s_gd': col("CUSTO_S_GD"), 
            'fatura_c_gd': col("FATURA C/GD COM RESTITUIÇÃO", "FATURA C/GD COM RESTITUICAO")
        }
        
        if not cols_map['ref']: return json.dumps({"error": "Coluna de referência (REF) não encontrada."})

        df_calc = accumulate_economy(df.copy(), cols_map)
        mes_dt = safe_parse_date_column(pd.Series([mes_referencia_str]))[0]
        df_calc[cols_map.get('ref')] = safe_parse_date_column(df_calc[cols_map.get('ref')])
        df_mes = df_calc[df_calc[cols_map.get('ref')].dt.to_period("M") == month_period(mes_dt)].copy()
        
        if df_mes.empty: return json.dumps({"error": f"Nenhum dado encontrado para o mês {mes_referencia_str}."})

        # Filtro de Valor Mínimo
        col_valor_emissao = pick_col(df_mes, 'Valor enviado para emissão', 'Valor enviado p/ emissão', 'Valor Enviado para Emissao')
        if not col_valor_emissao: return json.dumps({"error": "Coluna 'Valor enviado para emissão' não encontrada."})
        
        df_mes['_valor_para_filtrar'] = df_mes[col_valor_emissao].apply(to_num)
        df_mes_filtrado = df_mes[df_mes['_valor_para_filtrar'] >= 5].copy()
        
        if df_mes_filtrado.empty: return json.dumps({"error": "Nenhum dado com valor superior a R$5,00."})

        # VALIDAÇÃO INTELIGENTE
        validation_warnings = run_validations(df_mes_filtrado, cols_map)

        venc_iso = safe_parse_date_column(pd.Series([vencimento_str]))[0].strftime('%Y-%m-%d')
        clientes = []
        for _, row in df_mes_filtrado.iterrows():
            metrics = compute_row_metrics(row, cols_map, venc_iso)
            endereco_parts = []
            for k in ['endereco', 'bairro', 'cidade']:
                if cols_map.get(k) and pd.notna(row.get(cols_map.get(k))): 
                    endereco_parts.append(str(row.get(cols_map.get(k))))
            
            cliente_data = {
                "nome": str(row.get(cols_map.get('nome'), "")), 
                "documento": str(row.get(cols_map.get('doc'), "")),
                "endereco": ' '.join(endereco_parts).strip(), 
                "instalacao": str(row.get(cols_map.get('inst'), "")),
                "num_conta": str(row.get(cols_map.get('num_conta'), "")),
                "economiaMes": row.get('_econ_mes', 0), 
                "economiaTotal": row.get('_econ_acum', 0),
                "_econ_mes_raw": row.get('_econ_mes_raw', 0),
                "custo_s_gd": to_num(row.get(cols_map.get('custo_s_gd'), 0)),
                "fatura_c_gd": to_num(row.get(cols_map.get('fatura_c_gd'), 0)),
            }
            cliente_data.update(metrics)
            clientes.append(cliente_data)
            
        # RETORNO ESTRUTURADO
        return json.dumps({
            "data": clientes,
            "warnings": validation_warnings
        })

    except Exception as e:
        import traceback
        return json.dumps({"error": f"Erro inesperado no Python: {traceback.format_exc()}"})
