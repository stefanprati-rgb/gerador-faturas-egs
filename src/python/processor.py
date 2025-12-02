# Script Python para processamento de Excel via Pyodide
# Este script será executado no navegador através do Pyodide

import pandas as pd
import io
import re
import unicodedata
import json
from datetime import datetime

# Constantes
CO2_PER_KWH = 0.07
TREES_PER_TON_CO2 = 8
FALLBACK_TARIFA_DIST = 0.916370
FALLBACK_TARIFA_COMP_EV = 0.716045


def _norm(s):
    """Normaliza string removendo acentos e espaços extras"""
    s = str(s or "")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().upper()


def pick_col(df, *alternativas):
    """Busca coluna no DataFrame por nome ou similaridade"""
    cols_norm = {_norm(c): c for c in df.columns}
    for alt in alternativas:
        key = _norm(alt)
        if key in cols_norm:
            return cols_norm[key]
    for k, original in cols_norm.items():
        if any(_norm(a) in k for a in alternativas):
            return original
    return None


def to_num(x):
    """Converte valor para número"""
    if pd.isna(x):
        return 0.0
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).replace("\u00a0", " ").strip()
    s = re.sub(r"[Rr]\$|\%", "", s).replace(" ", "")
    neg = s.startswith("-")
    s = s.lstrip("-")
    if s.count(",") == 1 and s.count(".") >= 1:
        s = s.replace(".", "").replace(",", ".")
    elif s.count(",") == 1 and s.count(".") == 0:
        s = s.replace(",", ".")
    try:
        v = float(s)
    except Exception:
        v = 0.0
    return -v if neg else v


def to_str(x):
    """Converte valor para string tratando NaN"""
    if pd.isna(x) or x is None:
        return ""
    return str(x).strip()


def find_sheet_and_header(xls, key_cols, prefer_name=None, max_rows=30):
    """Encontra aba e linha de cabeçalho no Excel"""
    sheet_names = list(xls.sheet_names)
    if prefer_name and prefer_name in sheet_names:
        sheet_names.insert(0, sheet_names.pop(sheet_names.index(prefer_name)))
    
    for sheet_name in sheet_names:
        try:
            df_sample = pd.read_excel(xls, sheet_name=sheet_name, header=None, nrows=max_rows)
            for i, row in df_sample.iterrows():
                row_as_string = ' '.join(str(v) for v in row.dropna().values)
                if all(k in row_as_string for k in key_cols):
                    return sheet_name, i
        except Exception:
            continue
    return None, -1


def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    """
    Processa relatório Excel e retorna dados para geração de faturas
    
    Args:
        file_content: Conteúdo do arquivo Excel em bytes
        mes_referencia_str: Mês de referência no formato YYYY-MM-DD
        vencimento_str: Data de vencimento no formato YYYY-MM-DD
    
    Returns:
        JSON string com lista de clientes ou erro
    """
    try:
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        # Encontrar aba de consumo
        aba_consumo, header_consumo = find_sheet_and_header(xls, ["REF"], prefer_name="Detalhe Por UC")
        if not aba_consumo or header_consumo < 0:
            return json.dumps({"error": "Aba com dados de consumo não encontrada."})
        
        print(f"DEBUG: Aba encontrada: {aba_consumo}, Header na linha: {header_consumo}")
        
        # Ler dados
        df = pd.read_excel(xls, sheet_name=aba_consumo, header=header_consumo)
        df.columns = [str(c).strip() for c in df.columns]
        
        print(f"DEBUG: Colunas disponíveis: {list(df.columns)}")
        print(f"DEBUG: Total de linhas: {len(df)}")
        
        # Identificar colunas
        col_ref = pick_col(df, "REF (sempre dia 01 de cada mês)", "REF")
        col_inst = pick_col(df, "Instalação", "Nº Instalação")
        col_nome = pick_col(df, "Nome Cliente", "Nome/Razão Social")
        col_doc = pick_col(df, "Documento", "CPF/CNPJ")
        col_consumo_qtd = pick_col(df, "CONSUMO_FP")
        col_comp_qtd = pick_col(df, "CRÉD. CONSUMIDO_FP")
        col_tarifa_consumo = pick_col(df, "TARIFA FP")
        col_tarifa_comp_ev = pick_col(df, "TARIFA_Comp_FP")
        col_tarifa_comp_dist = pick_col(df, "TARIFA DE ENERGIA COMPENSADA")
        col_outros = pick_col(df, "OUTROS")
        col_boleto_ev = pick_col(df, "Boleto Hube definido para a ref. Mensal")
        col_num_conta = pick_col(df, "Número da conta")
        col_endereco = pick_col(df, "Endereço")
        col_bairro = pick_col(df, "Bairro")
        col_cidade = pick_col(df, "Cidade")
        col_custo_s_gd = pick_col(df, 'CUSTO_S_GD')
        col_fatura_c_gd = pick_col(df, 'FATURA C/GD COM RESTITUIÇÃO', 'FATURA C/GD COM RESTITUICAO')
        
        print(f"DEBUG: col_nome = {col_nome}")
        print(f"DEBUG: col_doc = {col_doc}")
        print(f"DEBUG: col_inst = {col_inst}")
        print(f"DEBUG: col_consumo_qtd = {col_consumo_qtd}")
        print(f"DEBUG: col_comp_qtd = {col_comp_qtd}")
        print(f"DEBUG: col_custo_s_gd = {col_custo_s_gd}")
        print(f"DEBUG: col_fatura_c_gd = {col_fatura_c_gd}")
        
        if not col_ref:
            return json.dumps({"error": "Coluna de referência (REF) não encontrada."})
        
        # Cálculos
        df_calc = df.copy()
        
        # Converter colunas para numérico
        comp_qtd_series = df_calc[col_comp_qtd].apply(to_num) if col_comp_qtd and col_comp_qtd in df_calc.columns else pd.Series([0.0]*len(df_calc), index=df_calc.index)
        tarifa_comp_ev_series = df_calc[col_tarifa_comp_ev].apply(to_num) if col_tarifa_comp_ev and col_tarifa_comp_ev in df_calc.columns else pd.Series([FALLBACK_TARIFA_COMP_EV]*len(df_calc), index=df_calc.index)
        valor_boleto_series = df_calc[col_boleto_ev].apply(to_num) if col_boleto_ev and col_boleto_ev in df_calc.columns else pd.Series([0.0]*len(df_calc), index=df_calc.index)
        custo_s_gd_series = df_calc[col_custo_s_gd].apply(to_num) if col_custo_s_gd and col_custo_s_gd in df_calc.columns else pd.Series([0.0]*len(df_calc), index=df_calc.index)
        fatura_c_gd_series = df_calc[col_fatura_c_gd].apply(to_num) if col_fatura_c_gd and col_fatura_c_gd in df_calc.columns else pd.Series([0.0]*len(df_calc), index=df_calc.index)
        
        # Valor final enviado
        valor_final_series = valor_boleto_series.where(valor_boleto_series > 0, (comp_qtd_series * tarifa_comp_ev_series))
        
        # Economia correta
        df_calc['_econ_mes'] = (custo_s_gd_series - (fatura_c_gd_series + valor_final_series)).round(2)
        df_calc['_econ_mes'] = df_calc['_econ_mes'].clip(lower=0)
        
        # Economia acumulada
        if col_inst and col_ref and col_inst in df_calc.columns and col_ref in df_calc.columns:
            df_calc[col_ref] = pd.to_datetime(df_calc[col_ref], errors='coerce')
            df_calc = df_calc.sort_values(by=[col_inst, col_ref])
            df_calc['_econ_acum'] = df_calc.groupby(col_inst)['_econ_mes'].cumsum().fillna(0)
        else:
            df_calc['_econ_acum'] = df_calc['_econ_mes']
        
        # Filtrar por mês
        df_calc["_ref_month"] = df_calc[col_ref].dt.to_period("M")
        mes_referencia_dt = pd.to_datetime(mes_referencia_str)
        df_mes = df_calc[df_calc["_ref_month"] == mes_referencia_dt.to_period("M")].copy()
        
        print(f"DEBUG: Linhas após filtrar por mês {mes_referencia_str}: {len(df_mes)}")
        
        # Filtrar linhas vazias ou inválidas (sem instalação ou sem nome)
        if col_inst:
            df_mes = df_mes[df_mes[col_inst].notna()].copy()
            df_mes = df_mes[df_mes[col_inst].astype(str).str.strip() != ''].copy()
        
        if col_nome:
            df_mes = df_mes[df_mes[col_nome].notna()].copy()
            df_mes = df_mes[df_mes[col_nome].astype(str).str.strip() != ''].copy()
        
        print(f"DEBUG: Linhas após filtrar vazias: {len(df_mes)}")
        
        if df_mes.empty:
            return json.dumps({"error": f"Nenhum dado válido para o mês {mes_referencia_str}."})

        
        # Montar lista de clientes
        clientes = []
        for idx, row in df_mes.iterrows():
            consumo_qtd = to_num(row.get(col_consumo_qtd, 0)) if col_consumo_qtd else 0
            comp_qtd = to_num(row.get(col_comp_qtd, 0)) if col_comp_qtd else 0
            tarifa_consumo = to_num(row.get(col_tarifa_consumo, 0)) if col_tarifa_consumo else 0
            tarifa_comp_ev = to_num(row.get(col_tarifa_comp_ev, 0)) if col_tarifa_comp_ev else 0
            
            tarifa_comp_dist_raw = to_num(row.get(col_tarifa_comp_dist, None)) if col_tarifa_comp_dist else 0.0
            tarifa_comp_dist = tarifa_comp_dist_raw if tarifa_comp_dist_raw > 0 else tarifa_comp_ev
            
            consumo_total_val = consumo_qtd * tarifa_consumo
            comp_total_val_dist = comp_qtd * tarifa_comp_dist
            fatura_dist_real = to_num(row.get(col_fatura_c_gd, 0)) if col_fatura_c_gd else 0
            dist_outros_val = fatura_dist_real - (consumo_total_val - comp_total_val_dist)
            dist_total = fatura_dist_real
            
            boleto_ev = to_num(row.get(col_boleto_ev, 0)) if col_boleto_ev else 0
            if boleto_ev > 0:
                contrib_total = boleto_ev
                det_credito_tar = 0.0
                det_credito_total = contrib_total
            else:
                det_credito_tar = tarifa_comp_ev
                det_credito_total = comp_qtd * det_credito_tar
                contrib_total = det_credito_total
            
            econ_total_sem = consumo_total_val + dist_outros_val
            econ_total_com = dist_total + contrib_total
            economia_mes_calc = row.get('_econ_mes', 0)
            economia_acum = row.get('_econ_acum', economia_mes_calc)
            
            co2_kg = comp_qtd * CO2_PER_KWH
            emissao_iso = datetime.now().strftime('%Y-%m-%d')
            vencimento_iso = pd.to_datetime(vencimento_str).strftime('%Y-%m-%d')
            
            nome_val = to_str(row.get(col_nome, "")) if col_nome else ""
            doc_val = to_str(row.get(col_doc, "")) if col_doc else ""
            inst_val = to_str(row.get(col_inst, "")) if col_inst else ""
            
            if idx == df_mes.index[0]:  # Log primeiro cliente para debug
                print(f"DEBUG Primeiro cliente:")
                print(f"  nome: {nome_val}")
                print(f"  documento: {doc_val}")
                print(f"  instalacao: {inst_val}")
                print(f"  consumo_qtd: {consumo_qtd}")
                print(f"  comp_qtd: {comp_qtd}")
                print(f"  contrib_total: {contrib_total}")
            
            clientes.append({
                "nome": nome_val,
                "documento": doc_val,
                "endereco": "",
                "instalacao": inst_val,
                "num_conta": "",
                "emissao_iso": emissao_iso,
                "vencimento_iso": vencimento_iso,
                "totalPagar": contrib_total,
                "economiaMes": economia_mes_calc,
                "economiaTotal": economia_acum,
                "co2Evitado": co2_kg,
                "arvoresEquivalentes": (co2_kg / 1000.0) * TREES_PER_TON_CO2,
                "det_credito_qtd": comp_qtd,
                "det_credito_tar": det_credito_tar,
                "det_credito_total": det_credito_total,
                "dist_consumo_qtd": consumo_qtd,
                "dist_consumo_tar": tarifa_consumo,
                "dist_consumo_total": consumo_total_val,
                "dist_comp_qtd": comp_qtd,
                "dist_comp_tar": tarifa_comp_dist,
                "dist_comp_total": -comp_total_val_dist,
                "dist_outros": dist_outros_val,
                "dist_total": dist_total,
                "econ_total_sem": econ_total_sem,
                "econ_total_com": econ_total_com,
            })
        
        print(f"DEBUG: Total de clientes processados: {len(clientes)}")
        return json.dumps(clientes)
    
    except Exception as e:
        import traceback
        error_msg = f"Erro inesperado no Python: {str(e)}\n{traceback.format_exc()}"
        print(f"DEBUG ERROR: {error_msg}")
        return json.dumps({"error": error_msg})


