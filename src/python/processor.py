import pandas as pd
import io, json
import traceback
import warnings as python_warnings
from datetime import datetime
import re
from typing import Optional, Dict, Any

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
    'endereco': ["Endereço", "Logradouro"],
    'bairro': ["Bairro"],
    'cidade': ["Cidade", "Município"],
    'num_conta': ["Número da conta", "Conta Contrato"]
}

# --- FUNÇÕES AUXILIARES ---

# _norm function is imported from utils_normalizers.py via global execution

def _diagnosticar_colunas(df: pd.DataFrame) -> str:
    """Retorna diagnóstico das colunas disponíveis para debugging."""
    colunas = list(df.columns)
    colunas_mostrar = colunas[:10]
    resultado = f"Colunas disponíveis ({len(colunas)} total): {', '.join(colunas_mostrar)}"
    if len(colunas) > 10:
        resultado += f"... (+{len(colunas)-10} mais)"
    return resultado

def _mapear_coluna_uc(df: pd.DataFrame) -> Optional[str]:
    """
    Localiza a coluna de Instalação (Chave Primária) com busca resiliente em 3 níveis.
    
    Nível 1: Match exato normalizado
    Nível 2: Match parcial (substring)
    Nível 3: Fallback para padrões comuns
    """
    # Nível 1: Tentativa de match exato (normalizado)
    termos_exatos = [
        "INSTALACAO", "INSTALAÇÃO", "Nº INSTALACAO", 
        "N INSTALACAO", "UC", "CODIGO", "COD INSTALACAO"
    ]
    
    colunas_map = {_norm(col): col for col in df.columns}
    
    for termo in termos_exatos:
        termo_norm = _norm(termo)
        if termo_norm in colunas_map:
            col_encontrada = colunas_map[termo_norm]
            print(f"✓ Coluna UC encontrada (Nível 1 - Match Exato): '{col_encontrada}'")
            return col_encontrada
    
    # Nível 2: Tentativa de match parcial (substring)
    termos_parciais = ["INSTAL", "UC", "CODIGO", "COD"]
    
    for termo in termos_parciais:
        termo_norm = _norm(termo)
        for col_norm, col_original in colunas_map.items():
            if termo_norm in col_norm:
                print(f"✓ Coluna UC encontrada (Nível 2 - Match Parcial): '{col_original}' (contém '{termo}')")
                return col_original
    
    # Nível 3: Fallback - procura por colunas que parecem IDs numéricos
    padroes_id = ["ID", "NUM", "NUMERO", "COD", "CODIGO"]
    
    for padrao in padroes_id:
        padrao_norm = _norm(padrao)
        for col_norm, col_original in colunas_map.items():
            if padrao_norm in col_norm and len(col_norm) <= 15:
                print(f"⚠ Coluna UC encontrada (Nível 3 - Fallback): '{col_original}' (padrão ID)")
                return col_original
    
    # Falha total
    print(f"✗ ERRO: Coluna de Instalação não encontrada após busca em 3 níveis")
    print(f"  {_diagnosticar_colunas(df)}")
    return None

def _mapear_coluna_nome(df: pd.DataFrame) -> Optional[str]:
    """Localiza a coluna de Nome."""
    termos_nome_norm = [_norm(c) for c in COLUMNS_MAP['nome']]
    for nome_coluna_original in df.columns:
        if _norm(nome_coluna_original) in termos_nome_norm:
             return nome_coluna_original
    return None

def criar_mapa_clientes(df_clientes: pd.DataFrame) -> Dict[str, str]:
    """
    Cria um Hash Map (Dicionário) otimizado: { Installation_Number : Client_Name }.
    """
    col_uc = _mapear_coluna_uc(df_clientes)
    col_nome = _mapear_coluna_nome(df_clientes)

    if not col_uc or not col_nome:
        print("AVISO: Não foi possível criar mapa de clientes (colunas não identificadas).")
        return {}

    # Normaliza a chave para string e remove espaços para garantir match
    df_clientes['__key'] = df_clientes[col_uc].astype(str).str.strip()
    
    # Remove duplicatas mantendo o primeiro
    df_unique = df_clientes.drop_duplicates(subset=['__key'])
    
    # Cria o dicionário
    return dict(zip(df_unique['__key'], df_unique[col_nome]))

# --- ORQUESTRAÇÃO PRINCIPAL ---

def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    try:
        # 1. Carregar o arquivo Excel
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        # 2. Localizar aba principal (Detalhe)
        # Assumes find_sheet_and_header is available in global scope from excel_utils execution
        aba_detalhe, header_idx_detalhe = find_sheet_and_header(xls, ["REF", "Instalação"], prefer_name="Detalhe")
        
        if not aba_detalhe:
            return json.dumps({"error": "Aba 'Detalhe Por UC' não encontrada."})

        df = pd.read_excel(xls, sheet_name=aba_detalhe, header=header_idx_detalhe)
        df.columns = [str(c).strip() for c in df.columns]

        # 3. Mapeamento de Colunas
        # Assumes pick_col is available
        cols_map = {k: pick_col(df, *v) for k, v in COLUMNS_MAP.items()}
        col_instalacao_detalhe = _mapear_coluna_uc(df)
        
        if not col_instalacao_detalhe:
            diagnostico = _diagnosticar_colunas(df)
            return json.dumps({
                "error": "Coluna de Instalação não identificada no detalhe.",
                "details": diagnostico,
                "suggestion": "Verifique se o arquivo contém uma coluna chamada 'Instalação', 'INSTALACAO', 'UC' ou similar."
            })

        # 4. CARREGAMENTO E MAPEAMENTO (Lógica Solicitada)
        # Carrega base de referência para memória
        aba_clientes, header_idx_clientes = find_sheet_and_header(xls, COLUMNS_MAP['nome'] + COLUMNS_MAP['inst'], prefer_name="Infos Clientes")
        
        mapa_clientes = {}
        if aba_clientes:
            # Cabeçalho geralmente na linha 2 (index 1) para Infos Clientes
            df_ref = pd.read_excel(xls, sheet_name=aba_clientes, header=1)
            mapa_clientes = criar_mapa_clientes(df_ref)
            print(f"Mapa de clientes carregado com {len(mapa_clientes)} registros.")
        else:
            print("AVISO: Aba 'Infos Clientes' não encontrada. O mapeamento falhará.")

        # 5. Filtragem por Mês
        df_mes = df.copy()
        if cols_map['ref']:
            date_input = mes_referencia_str.strip()
            if len(date_input) == 7: date_input += '-01'
            mes_ref_dt = datetime.strptime(date_input, '%Y-%m-%d')
            
            # Assumes safe_parse_date is available
            df['__ref_dt'] = df[cols_map['ref']].apply(safe_parse_date)
            df_mes = df[
                (df['__ref_dt'].dt.year == mes_ref_dt.year) & 
                (df['__ref_dt'].dt.month == mes_ref_dt.month)
            ].copy()

        # Filtro de valor mínimo
        if cols_map.get('boleto_ev'):
            # Assumes to_num is available
            df_mes = df_mes[df_mes[cols_map['boleto_ev']].apply(to_num) >= 5].copy()

        if df_mes.empty:
            return json.dumps({"error": f"Nenhum registro encontrado para {mes_referencia_str}."})

        # 6. Processamento Linha a Linha com Lógica Condicional
        clientes = []
        warnings = []

        for idx, row in df_mes.iterrows():
            try:
                # Extração Inicial de Chave (Key Identifier)
                raw_id = str(row.get(col_instalacao_detalhe, '')).strip()
                
                # Consulta ao Mapa
                nome_cliente = mapa_clientes.get(raw_id)
                status_mapeamento = "OK"
                
                # Atribuição Condicional (Lógica Solicitada)
                if nome_cliente:
                    # SE encontrado no mapa
                    final_client_name = nome_cliente
                else:
                    # SE NÃO encontrado -> Usa Instalação e Sinaliza
                    final_client_name = f"UC {raw_id}" # Fallback visual (Unidade Consumidora)
                    status_mapeamento = "Nome Não Mapeado"
                    warnings.append({
                        "type": "warning",
                        "severity": "warning",
                        "title": "Nome Não Mapeado",
                        "message": f"Instalação {raw_id} não encontrada na base de clientes. Usando ID como nome.",
                        "details": f"Raw ID: {raw_id}"
                    })

                # Métricas e Endereço
                # Assumes compute_metrics is available
                metrics = compute_metrics(row, cols_map, vencimento_str)
                
                ends = []
                for k in ['endereco', 'bairro', 'cidade']:
                    col_name = cols_map.get(k)
                    if col_name:
                        # Assumes safe_str is available
                        val = safe_str(row.get(col_name))
                        if val: ends.append(val)
                endereco_completo = " - ".join(ends) or "Endereço não informado"

                # Construção do Objeto Final
                cliente = {
                    "raw_id": raw_id,                 # Campo para auditoria
                    "nome": final_client_name,        # Campo corrigido
                    "status_mapeamento": status_mapeamento,
                    "documento": safe_str(row.get(cols_map.get('doc'))),
                    "instalacao": raw_id,             # Mantém instalação original
                    "endereco": endereco_completo,
                    "num_conta": safe_str(row.get(cols_map.get('num_conta'))),
                    "economiaTotal": metrics['economiaMes'],
                }
                
                cliente.update(metrics)
                clientes.append(cliente)

            except Exception as ex:
                warnings.append({
                    "type": "error", 
                    "severity": "error",
                    "title": "Erro de Processamento",
                    "message": f"Erro na linha {idx}: {str(ex)}",
                    "details": str(row.to_dict())
                })

        return json.dumps({
            "data": clientes,
            "warnings": warnings
        })

    except Exception as e:
        return json.dumps({"error": f"Erro crítico no processamento: {traceback.format_exc()}"})