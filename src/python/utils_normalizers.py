import pandas as pd
import re
import unicodedata
from datetime import datetime

# =================================================================
# FUNÇÕES DE NORMALIZAÇÃO E CONVERSÃO DE DADOS (src/python/utils_normalizers.py)
# =================================================================

def _norm(s: str) -> str:
    """Normaliza strings para comparação (remove acentos, espaços, uppercase)."""
    s = str(s or "")
    # Remove acentos
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    # Remove todos os espaços para matching mais agressivo de colunas
    return re.sub(r"\s+", "", s).strip().upper()

def safe_str(val, default="") -> str:
    """Converte valor para string de forma segura, tratando NaN/None."""
    if val is None or pd.isna(val):
        return default
    s = str(val).strip()
    if s.lower() == 'nan':
        return default
    return s if s else default

def to_num(x) -> float:
    """Converte valores monetários/numéricos PT-BR para float."""
    if pd.isna(x): return 0.0
    if isinstance(x, (int, float)): return float(x)
    
    s = str(x).strip()
    # Tratamento de número negativo entre parênteses
    neg = False
    if s.startswith('(') and s.endswith(')'):
        neg = True
        s = s[1:-1]
    
    # Remove R$, %, espaços
    s = re.sub(r"[Rr]\$|\%|[A-Za-z]", "", s).replace(" ", "")
    s = s.replace('—', '0').replace('--', '0').replace('-', '-').strip()
    
    if not s or s in {",", ".", "-", "-."}: return 0.0
    
    s = s.replace("+", "")
    # Lógica para distinguir milhar de decimal (1.234,56 -> 1234.56)
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    
    try:
        v = float(s)
        return -v if neg else v
    except ValueError:
        return 0.0

def safe_parse_date(val):
    """Converte um valor para objeto datetime de forma segura."""
    if pd.isna(val): return None
    if isinstance(val, (datetime, pd.Timestamp)): return val
    s = str(val).strip()[:10]
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y'):
        try: return datetime.strptime(s, fmt)
        except: continue
    return None