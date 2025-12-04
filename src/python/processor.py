import pandas as pd
import io, json
import traceback
import warnings as python_warnings
from datetime import datetime
import re # Adicionado para mapeamento flexível de colunas

# Suprime warnings do openpyxl sobre Data Validation
python_warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')

# Importa as novas dependências
# Nota: As funções são importadas, mas o Pyodide as executará no mesmo escopo, garantindo o funcionamento.
# from .utils_normalizers import to_num, safe_str, safe_parse_date 
# from .excel_utils import pick_col, find_sheet_and_header
# from .calculators_metrics import compute_metrics

# Definição das Colunas (Centralizada para fácil manutenção de mapeamento)
COLUMNS_MAP = {
    'ref': ["REF", "Mês de Referência", "Competência"],
    'inst': ["Instalação", "Nº Instalação", "UC", "Codigo"],
    # 'Nome/Razão Social' será resolvido via JOIN, mas mantido para mapeamento inicial.
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

# --- FUNÇÕES AUXILIARES PARA MAPEAMENTO FLEXÍVEL (Mecanismo de Mapeamento) ---

def _norm(text: str) -> str:
    """Normaliza o texto para comparação (lowercase e remove espaços/acentos)."""
    if pd.isna(text) or text is None:
        return ""
    text = str(text).strip().lower()
    # Substituições simples de acentos/cedilhas
    text = text.replace('á', 'a').replace('ã', 'a').replace('à', 'a').replace('é', 'e').replace('ê', 'e')
    text = text.replace('í', 'i').replace('ó', 'o').replace('ô', 'o').replace('ú', 'u').replace('ç', 'c')
    # Remove caracteres não alfanuméricos (mantém o espaço/barra por segurança)
    text = re.sub(r'[^a-z0-9\s/]', '', text) 
    return ' '.join(text.split())

def _mapear_coluna_uc(df: pd.DataFrame) -> Optional[str]:
    """
    Mapeia de forma flexível a coluna de Identificador de UC (Instalação, instalacao, etc.).
    """
    # Usamos re.search para flexibilidade (cobrindo instalacao, instalção, instalacap, etc.)
    termos_uc = [r'instala.ao', r'instalaçao', r'instalacao', r'uc']
    
    colunas_df_norm = {col: _norm(col) for col in df.columns}

    for termo in termos_uc:
        for col_original, col_norm in colunas_df_norm.items():
            if re.search(termo, col_norm):
                return col_original

    # Falha se não encontrar
    return None

def _mapear_coluna_nome(df: pd.DataFrame) -> Optional[str]:
    """Mapeia a coluna de nome/razão social usando a COLUMNS_MAP."""
    termos_nome_norm = [_norm(c) for c in COLUMNS_MAP['nome']]
    
    for nome_coluna_original in df.columns:
        if _norm(nome_coluna_original) in termos_nome_norm:
             return nome_coluna_original
    return None

# --- FUNÇÃO PRINCIPAL DE RESOLUÇÃO DE JOIN ---

def resolver_join_clientes(df_detalhe: pd.DataFrame, df_clientes: pd.DataFrame, instalacao_col_detalhe: str) -> pd.DataFrame:
    """
    Realiza o LEFT JOIN dos dados de consumo (Detalhe) com os dados mestre de clientes (Master)
    para resolver o campo Nome/Razão Social, e marca o status de faturamento.
    """
    # Mapeamento dinâmico das colunas chave no Master
    col_nome_master = _mapear_coluna_nome(df_clientes) 
    col_uc_clientes = _mapear_coluna_uc(df_clientes) 

    if not col_uc_clientes or not col_nome_master:
        # Se as colunas master não forem encontradas, retorna o detalhe sem JOIN, 
        # mas marcando todos como erro de nome ausente, conforme a instrução.
        df_detalhe['Nome/Razão Social_RESOLVIDO'] = pd.NA
        df_detalhe['STATUS_FATURAMENTO'] = 'ERRO: Master Inválido/Nome Ausente (Não Faturar)'
        return df_detalhe
    
    # 1. Preparação dos Dados Mestre (Master)
    df_clientes_join = df_clientes[[col_uc_clientes, col_nome_master]].rename(
        columns={col_uc_clientes: 'UC_ID_JOIN', col_nome_master: 'Nome_Cliente_Master'}
    )
    df_clientes_join = df_clientes_join.drop_duplicates(subset=['UC_ID_JOIN'], keep='first')
    
    # 2. Preparação dos Dados de Detalhe (Left Side)
    # Copia o DataFrame para não alterar o original em caso de renomeação de coluna
    df_detalhe_temp = df_detalhe.copy()
    
    # Renomeia para chave de junção comum
    df_detalhe_temp.rename(columns={instalacao_col_detalhe: 'UC_ID_JOIN'}, inplace=True)
    
    # Garante o tipo de dados string para a chave de junção
    df_detalhe_temp['UC_ID_JOIN'] = df_detalhe_temp['UC_ID_JOIN'].astype(str).str.strip()
    df_clientes_join['UC_ID_JOIN'] = df_clientes_join['UC_ID_JOIN'].astype(str).str.strip()

    # 3. Executa o LEFT JOIN
    df_processado = pd.merge(
        df_detalhe_temp,
        df_clientes_join,
        on='UC_ID_JOIN',
        how='left'
    )
    
    # 4. Resolução de Mapeamento: Preenchimento do Nome do Cliente
    
    # Encontra a coluna de nome original na planilha de Detalhe
    col_nome_original = _mapear_coluna_nome(df_detalhe) 
    if col_nome_original is None:
        # Se não houver coluna de nome mapeada no Detalhe, usa o nome do Master
        df_processado['Nome/Razão Social_RESOLVIDO'] = df_processado['Nome_Cliente_Master']
    else:
        # Pega o nome existente no Detalhe
        df_processado['Nome/Razão Social_RESOLVIDO'] = df_processado[col_nome_original]
        
        # Trata nulos/vazios na coluna original
        df_processado['Nome/Razão Social_RESOLVIDO'] = df_processado['Nome/Razão Social_RESOLVIDO'].replace(['0', '', 'NaN'], pd.NA)
        
        # Preenche os nulos com o nome do cliente Master
        df_processado['Nome/Razão Social_RESOLVIDO'] = df_processado['Nome/Razão Social_RESOLVIDO'].fillna(
            df_processado['Nome_Cliente_Master']
        )
    
    # 5. Marcação/Flag de Registros Inválidos
    df_processado['STATUS_FATURAMENTO'] = 'OK'
    
    # Marca como ERRO se o nome final (após o JOIN) ainda estiver ausente/nulo
    condicao_erro = df_processado['Nome/Razão Social_RESOLVIDO'].isnull() | (df_processado['Nome/Razão Social_RESOLVIDO'] == '')
    
    df_processado.loc[condicao_erro, 'STATUS_FATURAMENTO'] = 'ERRO: Nome/Razão Social Ausente (Não Faturar)'

    # 6. Limpeza e Retorno
    df_processado.drop(columns=['Nome_Cliente_Master'], inplace=True)
    # Renomeia a coluna de instalação de volta, garantindo o nome original
    df_processado.rename(columns={'UC_ID_JOIN': instalacao_col_detalhe}, inplace=True) 

    return df_processado

# --- FUNÇÃO PRINCIPAL DE ORQUESTRAÇÃO ---

def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    """
    Função principal de orquestração.
    Chama as funções modularizadas para: 1. Leer Excel, 2. Mapear, 3. Filtrar, 4. Resolver Nomes, 5. Calcular.
    """
    try:
        # 1. Carregar Excel (Workbook)
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        # 2. Encontrar aba/cabeçalho da Detalhe Por UC (Principal)
        core_keys = ["REF", "Instalação", "CRÉD. CONSUMIDO_FP"]
        # Assumes find_sheet_and_header is global
        aba_detalhe, header_idx_detalhe = find_sheet_and_header(xls, core_keys, prefer_name="Detalhe") 
        
        if not aba_detalhe:
            # Assumes find_sheet_and_header is global
            aba_detalhe, header_idx_detalhe = find_sheet_and_header(xls, ["REF", "Instalação"], prefer_name="Detalhe")
        
        if not aba_detalhe:
            return json.dumps({"error": "Não foi possível identificar a estrutura da planilha (Detalhe Por UC). Verifique os cabeçalhos."})

        # Lê a planilha de Detalhe Por UC
        df = pd.read_excel(xls, sheet_name=aba_detalhe, header=header_idx_detalhe)
        df.columns = [str(c).strip() for c in df.columns]

        # 3. Mapear colunas no Detalhe Por UC
        # Assumes pick_col is global
        cols_map = {k: pick_col(df, *v) for k, v in COLUMNS_MAP.items()} 
        
        # DEBUG: Log das colunas mapeadas e disponíveis
        print("=== DEBUG: Mapeamento de Colunas (Detalhe Por UC) ===")
        print(f"Colunas disponíveis no DataFrame: {list(df.columns)}")
        print(f"Mapeamento encontrado:")
        for key, col_name in cols_map.items():
            print(f"  {key}: {col_name}")
        print("=" * 40)
        
        # Tenta encontrar a coluna de UC dinamicamente no Detalhe Por UC
        col_instalacao_detalhe = _mapear_coluna_uc(df)
        if not col_instalacao_detalhe:
             return json.dumps({"error": "Coluna de Instalação/UC não encontrada na planilha de Detalhes."})

        # 4. Carregar Planilha Master (Infos Clientes) para o JOIN
        
        # Assumes find_sheet_and_header is global - Busca 'Infos Clientes'
        aba_clientes, header_idx_clientes = find_sheet_and_header(xls, COLUMNS_MAP['nome'] + COLUMNS_MAP['inst'], prefer_name="Infos Clientes") 

        df_clientes = None
        if aba_clientes:
            # Planilha Infos Clientes usa cabeçalho na linha 2 (índice 1) conforme snippet
            df_clientes = pd.read_excel(xls, sheet_name=aba_clientes, header=1)
            df_clientes.columns = [str(c).strip() for c in df_clientes.columns]
        else:
             print("AVISO: Planilha 'Infos Clientes' não encontrada. Apenas a lógica original será usada para nome.")
        
        # 5. Lógica de Resolução de Nome por JOIN (Se o Master for encontrado)
        
        df_final = df.copy()
        if df_clientes is not None:
             # Aplica a lógica de JOIN e Resolução de Mapeamento
            df_final = resolver_join_clientes(df.copy(), df_clientes, col_instalacao_detalhe)
            # A coluna de nome resolvida é 'Nome/Razão Social_RESOLVIDO'
            cols_map['nome'] = ['Nome/Razão Social_RESOLVIDO'] # Redireciona o mapeamento de nome
            
            # Filtra os registros que não devem ser faturados (Nome ausente)
            df_final = df_final[df_final['STATUS_FATURAMENTO'] == 'OK'].copy()
            
            # Se o DataFrame for vazio após o filtro de status
            if df_final.empty:
                return json.dumps({"error": "Nenhum registro apto para faturamento após a resolução de nome (nomes ausentes em todas as fontes)."}),
        
        # 6. Filtrar pelo Mês de Referência
        df_mes = df_final.copy()
        if cols_map['ref']:
            date_input = mes_referencia_str.strip()
            if len(date_input) == 7: 
                date_input += '-01'
            
            mes_ref_dt = datetime.strptime(date_input, '%Y-%m-%d')
            # Assumes safe_parse_date is global
            df_final['__ref_dt'] = df_final[pick_col(df_final, *COLUMNS_MAP['ref'])].apply(safe_parse_date) 
            
            df_mes = df_final[
                (df_final['__ref_dt'].dt.year == mes_ref_dt.year) & 
                (df_final['__ref_dt'].dt.month == mes_ref_dt.month)
            ].copy()
            
            if df_mes.empty:
                return json.dumps({"error": f"Nenhum registro encontrado para {mes_referencia_str}."})

        # 7. Filtro de Valor Mínimo (R$ 5,00)
        col_val = cols_map.get('boleto_ev')
        if col_val:
            # Assumes to_num is global
            df_mes = df_mes[df_mes[pick_col(df_mes, *COLUMNS_MAP['boleto_ev'])].apply(to_num) >= 5].copy() 
        
        # 8. Processamento e Cálculo
        clientes = []
        warnings = []
        
        for idx, row in df_mes.iterrows():
            try:
                # Assumes compute_metrics is global
                metrics = compute_metrics(row, cols_map, vencimento_str) 
                
                # Monta endereço de forma segura
                ends = []
                for k in ['endereco', 'bairro', 'cidade']:
                    col_name = cols_map.get(k)
                    if col_name:
                        # Assumes safe_str is global
                        val = safe_str(row.get(col_name)) 
                        if val: ends.append(val)
                endereco_completo = " - ".join(ends) or "Endereço não informado"
                
                # ========== EXTRAÇÃO ROBUSTA DO NOME: AGORA USAMOS APENAS O RESULTADO DO JOIN ==========
                nome_col = pick_col(df_mes, *cols_map.get('nome'))
                nome_valor = safe_str(row.get(nome_col))
                
                # Se o JOIN não foi possível, ou se o nome ainda está nulo/vazio, usamos a Instalação
                if not nome_valor or nome_valor == "":
                    instalacao_id = safe_str(row.get(col_instalacao_detalhe))
                    if instalacao_id:
                        nome_valor = f"Cliente {instalacao_id}"
                        print(f"  ⚠ Usando instalação como nome (FALLBACK): {nome_valor}")

                # Monta objeto final
                cliente = {
                    "nome": nome_valor if nome_valor else "Nome não disponível",
                    "documento": safe_str(row.get(cols_map.get('doc'))),
                    "instalacao": safe_str(row.get(col_instalacao_detalhe)), # Usamos a coluna UC mapeada
                    "endereco": endereco_completo,
                    "num_conta": safe_str(row.get(cols_map.get('num_conta'))),
                    "economiaTotal": metrics['economiaMes'], 
                }
                
                # Merge com métricas calculadas
                cliente.update(metrics)
                clientes.append(cliente)
                
            except Exception as ex:
                warnings.append({
                    "type": "error", 
                    "severity": "error",
                    "message": f"Erro na linha {idx} (UC: {row.get(col_instalacao_detalhe)}): {str(ex)}",
                    "details": str(row.to_dict())
                })

        return json.dumps({
            "data": clientes,
            "warnings": warnings
        })

    except Exception as e:
        return json.dumps({"error": f"Erro crítico no processamento: {traceback.format_exc()}"})