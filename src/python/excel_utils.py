import pandas as pd
import re
# Importa a função de normalização
# from .utils_normalizers import _norm 

# =================================================================
# FUNÇÕES DE UTILIDADE DE EXCEL (src/python/excel_utils.py)
# =================================================================

def pick_col(df: pd.DataFrame, *alternativas) -> str:
    """Encontra coluna no DataFrame usando chaves normalizadas."""
    # Assume _norm é global após execução de utils_normalizers.py
    cols_norm = {_norm(c): c for c in df.columns} 
    
    # 1. Tentativa Exata
    for alt in alternativas:
        key = _norm(alt)
        if key in cols_norm: return cols_norm[key]
        
    # 2. Tentativa Parcial (contém)
    for alt in alternativas:
        key_part = _norm(alt)
        for k_norm, k_orig in cols_norm.items():
            if key_part in k_norm:
                return k_orig
    return None

def find_sheet_and_header(xls: pd.ExcelFile, key_cols, prefer_name=None, max_rows=50):
    """Localiza a aba e a linha de cabeçalho corretas procurando por palavras-chave."""
    sheet_names = list(xls.sheet_names)
    # Prioriza aba sugerida
    if prefer_name:
        matches = [s for s in sheet_names if prefer_name.lower() in s.lower()]
        if matches:
            sheet_names.insert(0, sheet_names.pop(sheet_names.index(matches[0])))

    for sheet_name in sheet_names:
        try:
            # Lê primeiras linhas para detectar cabeçalho
            df_sample = pd.read_excel(xls, sheet_name=sheet_name, header=None, nrows=max_rows)
            for i, row in df_sample.iterrows():
                # Converte linha para string única normalizada (depende de _norm)
                row_str = _norm(" ".join(str(v) for v in row.dropna().values))
                # Verifica se TODAS as colunas chave estão presentes (parcialmente)
                if all(_norm(k) in row_str for k in key_cols):
                    return sheet_name, i
        except Exception:
            continue
    return None, -1