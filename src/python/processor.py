import pandas as pd
import io, json
import traceback
import warnings as python_warnings
from datetime import datetime
import re
from typing import Optional, Dict, Any

# Importa o calculador (que agora está em Modo Espelho)
from .calculators_metrics import compute_metrics, to_num

# Suprime warnings do openpyxl
python_warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')

# Definição das Colunas
COLUMNS_MAP = {
    'ref': ["REF", "Mês de Referência", "Competência", "REF (sempre dia 01 de cada mês)"],
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
    'desconto_praticado': ["Desconto Praticado", "Desconto Praticado (Sobre Tarifa Compensada ou Tarifa Cheia)", "Desconto"],
    'endereco': ["Endereço", "Logradouro", "Rua"],
    'bairro': ["Bairro"],
    'cidade': ["Cidade", "Município"],
    'num_conta': ["Número da conta", "Conta Contrato"]
}

# --- FUNÇÕES AUXILIARES ---

def limpar_uc(valor):
    """Remove caracteres especiais da UC para comparação robusta (ex: 10/10232-7 -> 10102327)"""
    if not valor: return ""
    # Mantém apenas letras e números
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
    best_header_idx = 0
    
    # Se tiver preferência, tenta ela primeiro
    sheets_to_try = xls.sheet_names
    if prefer_name:
        # Ordena para tentar nomes similares primeiro
        sheets_to_try = sorted(sheets_to_try, key=lambda x: 0 if prefer_name.lower() in x.lower() else 1)

    for sheet in sheets_to_try:
        try:
            # Lê as primeiras 20 linhas para achar o cabeçalho
            df_preview = pd.read_excel(xls, sheet_name=sheet, header=None, nrows=20)
            
            for r in range(len(df_preview)):
                row_vals = [str(v).strip().lower() for v in df_preview.iloc[r] if pd.notna(v)]
                # Verifica se pelo menos uma das colunas obrigatórias está na linha
                if any(m.lower() in row_vals for m in mandatory_cols):
                    return sheet, r
        except:
            continue
            
    return None, 0

def pick_col(df, *possibles):
    """Retorna o nome da coluna do DataFrame que corresponde a uma das opções possíveis."""
    cols_lower = {str(c).strip().lower(): c for c in df.columns}
    for p in possibles:
        if p.lower() in cols_lower:
            return cols_lower[p.lower()]
    return None

def _norm(s):
    """Normaliza strings para busca de colunas (remove acentos e espaços)"""
    return re.sub(r'[^a-zA-Z0-9]', '', str(s).lower())

def _diagnosticar_colunas(df: pd.DataFrame) -> str:
    colunas = list(df.columns)
    colunas_mostrar = colunas[:10]
    resultado = f"Colunas disponíveis ({len(colunas)} total): {', '.join(colunas_mostrar)}"
    if len(colunas) > 10:
        resultado += f"... (+{len(colunas)-10} mais)"
    return resultado

def _mapear_coluna_uc(df: pd.DataFrame) -> Optional[str]:
    # Nível 1: Match exato normalizado
    termos_exatos = ["INSTALACAO", "INSTALAÇÃO", "Nº INSTALACAO", "UC", "CODIGO"]
    colunas_map = {_norm(col): col for col in df.columns}
    
    for termo in termos_exatos:
        if _norm(termo) in colunas_map:
            return colunas_map[_norm(termo)]
    
    # Nível 2: Match parcial
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
            
        # Salva tanto a chave original quanto a limpa
        mapa[raw_uc] = nome
        chave_limpa = limpar_uc(raw_uc)
        if chave_limpa:
            mapa[chave_limpa] = nome # Atalho para busca rápida
    
    return mapa

# --- ORQUESTRAÇÃO PRINCIPAL ---

def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    try:
        # 1. Carregar o arquivo Excel
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        # 2. Localizar aba principal (Detalhe)
        aba_detalhe, header_idx_detalhe = find_sheet_and_header(xls, ["REF", "Instalação"], prefer_name="Detalhe")
        
        if not aba_detalhe:
            return json.dumps({"error": "Aba 'Detalhe Por UC' não encontrada."})

        df = pd.read_excel(xls, sheet_name=aba_detalhe, header=header_idx_detalhe)
        df.columns = [str(c).strip() for c in df.columns]

        # 3. Mapeamento de Colunas
        cols_map = {k: pick_col(df, *v) for k, v in COLUMNS_MAP.items()}
        col_instalacao_detalhe = _mapear_coluna_uc(df)
        
        if not col_instalacao_detalhe:
            return json.dumps({
                "error": "Coluna de Instalação não identificada no detalhe.",
                "details": _diagnosticar_colunas(df)
            })

        # 4. CARREGAMENTO E MAPEAMENTO DE CLIENTES
        mapa_clientes = {}
        warnings = []
        
        aba_clientes = None
        # Procura aba de clientes
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

        # 5. Filtragem por Mês
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
                pass # Se falhar filtro de data, tenta processar tudo ou retorna vazio depois

        # Filtro de valor mínimo (se houver coluna de boleto)
        if cols_map.get('boleto_ev'):
            df_mes = df_mes[df_mes[cols_map['boleto_ev']].apply(to_num) >= 5].copy()

        if df_mes.empty:
            return json.dumps({"error": f"Nenhum registro encontrado para {mes_referencia_str}."})

        # 6. Processamento Linha a Linha
        clientes = []

        for idx, row in df_mes.iterrows():
            try:
                # Extração e Limpeza da Chave
                raw_id = str(row.get(col_instalacao_detalhe, '')).strip()
                id_limpo = limpar_uc(raw_id)
                
                nome_cliente = None
                status_mapeamento = "OK"
                
                # Busca Inteligente (Tenta chave exata, depois chave limpa)
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

                # Métricas (Agora em Modo Espelho)
                metrics = compute_metrics(row, cols_map, vencimento_str)
                
                # --- CONSTRUÇÃO DO ENDEREÇO (MODIFICADO) ---
                ends = []
                for k in ['endereco', 'bairro', 'cidade']:
                    col_name = cols_map.get(k)
                    if col_name:
                        val = safe_str(row.get(col_name))
                        if val: ends.append(val)
                
                # Se a lista estiver vazia, retorna string vazia (sem "Endereço não informado")
                endereco_completo = " - ".join(ends)

                # Construção do Objeto Final
                cliente = {
                    "raw_id": raw_id,
                    "nome": final_client_name,
                    "status_mapeamento": status_mapeamento,
                    "documento": safe_str(row.get(cols_map.get('doc'))),
                    "instalacao": raw_id,
                    "endereco": endereco_completo, # Agora pode ir vazio
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