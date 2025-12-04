import pandas as pd
import io, json
import traceback
import warnings as python_warnings
from datetime import datetime

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
    # ADICIONADO: 'NOME' e 'RAZÃO SOCIAL' como alternativas de mapeamento
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


def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    """
    Função principal de orquestração.
    Chama as funções modularizadas para: 1. Leer Excel, 2. Mapear, 3. Filtrar, 4. Calcular.
    """
    try:
        # 1. Carregar Excel
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        # 2. Encontrar aba/cabeçalho
        core_keys = ["REF", "Instalação", "CRÉD. CONSUMIDO_FP"]
        # Assumes find_sheet_and_header is global
        aba, header_idx = find_sheet_and_header(xls, core_keys, prefer_name="Detalhe") 
        
        if not aba:
            # Assumes find_sheet_and_header is global
            aba, header_idx = find_sheet_and_header(xls, ["REF", "Instalação"], prefer_name="Detalhe")
        
        if not aba:
            return json.dumps({"error": "Não foi possível identificar a estrutura da planilha. Verifique os cabeçalhos."})

        df = pd.read_excel(xls, sheet_name=aba, header=header_idx)
        df.columns = [str(c).strip() for c in df.columns]

        # 3. Mapear colunas
        # Assumes pick_col is global
        cols_map = {k: pick_col(df, *v) for k, v in COLUMNS_MAP.items()} 
        
        # DEBUG: Log das colunas mapeadas e disponíveis
        print("=== DEBUG: Mapeamento de Colunas ===")
        print(f"Colunas disponíveis no DataFrame: {list(df.columns)}")
        print(f"Mapeamento encontrado:")
        for key, col_name in cols_map.items():
            print(f"  {key}: {col_name}")
        print("=" * 40)
        
        if not cols_map['inst']:
            return json.dumps({"error": "Coluna de Instalação/UC não encontrada."})

        # 4. Filtrar pelo Mês de Referência
        df_mes = df.copy()
        if cols_map['ref']:
            date_input = mes_referencia_str.strip()
            if len(date_input) == 7: 
                date_input += '-01'
            
            mes_ref_dt = datetime.strptime(date_input, '%Y-%m-%d')
            # Assumes safe_parse_date is global
            df['__ref_dt'] = df[cols_map['ref']].apply(safe_parse_date) 
            
            df_mes = df[
                (df['__ref_dt'].dt.year == mes_ref_dt.year) & 
                (df['__ref_dt'].dt.month == mes_ref_dt.month)
            ].copy()
            
            if df_mes.empty:
                return json.dumps({"error": f"Nenhum registro encontrado para {mes_referencia_str}."})

        # 5. Filtro de Valor Mínimo (R$ 5,00)
        col_val = cols_map.get('boleto_ev')
        if col_val:
            # Assumes to_num is global
            df_mes = df_mes[df_mes[col_val].apply(to_num) >= 5].copy() 
        
        # 6. Processamento e Cálculo
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
                
                # ========== EXTRAÇÃO ROBUSTA DO NOME COM FALLBACK INTELIGENTE ==========
                nome_col = cols_map.get('nome')
                nome_valor = None
                fonte_nome = "principal"
                
                # Tentativa 1: Coluna mapeada principal
                if nome_col:
                    nome_valor = safe_str(row.get(nome_col))
                
                # Tentativa 2: Fallback - buscar em TODAS as colunas que possam conter nome
                if not nome_valor or nome_valor == "":
                    # Lista de possíveis colunas que podem conter o nome (case-insensitive)
                    possible_name_cols = [
                        'nome', 'name', 'cliente', 'client', 'razao social', 'razão social',
                        'razao_social', 'razaosocial', 'titular', 'responsavel', 'responsável',
                        'consumidor', 'proprietario', 'proprietário'
                    ]
                    
                    # Normaliza os nomes das colunas do DataFrame
                    df_cols_normalized = {_norm(c): c for c in df.columns}
                    
                    # Tenta encontrar o nome em qualquer coluna que pareça conter nome
                    for possible_col in possible_name_cols:
                        normalized_possible = _norm(possible_col)
                        # Busca exata
                        if normalized_possible in df_cols_normalized:
                            col_original = df_cols_normalized[normalized_possible]
                            nome_valor = safe_str(row.get(col_original))
                            if nome_valor:
                                fonte_nome = f"fallback-exato:{col_original}"
                                print(f"  ✓ Nome encontrado via fallback na coluna: {col_original}")
                                break
                        
                        # Busca parcial (contém)
                        if not nome_valor:
                            for norm_col, orig_col in df_cols_normalized.items():
                                if normalized_possible in norm_col or norm_col in normalized_possible:
                                    nome_valor = safe_str(row.get(orig_col))
                                    if nome_valor:
                                        fonte_nome = f"fallback-parcial:{orig_col}"
                                        print(f"  ✓ Nome encontrado via fallback parcial na coluna: {orig_col}")
                                        break
                            if nome_valor:
                                break
                
                # Tentativa 3: Último recurso - usar instalação como identificador
                if not nome_valor or nome_valor == "":
                    instalacao_id = safe_str(row.get(cols_map.get('inst')))
                    if instalacao_id:
                        nome_valor = f"Cliente {instalacao_id}"
                        fonte_nome = "ultimo-recurso:instalacao"
                        print(f"  ⚠ Usando instalação como nome: {nome_valor}")
                
                # DEBUG: Log detalhado quando nome não é encontrado
                if not nome_valor or nome_valor == "" or nome_valor.startswith("Cliente "):
                    print(f"\n{'='*60}")
                    print(f"AVISO: Nome não encontrado para instalação {row.get(cols_map.get('inst'))}")
                    print(f"  Coluna mapeada: {nome_col}")
                    print(f"  Valor bruto: {row.get(nome_col) if nome_col else 'N/A'}")
                    print(f"  Fonte usada: {fonte_nome}")
                    print(f"  Todas as colunas disponíveis: {list(df.columns)}")
                    print(f"  Valores da linha completa:")
                    for col in df.columns:
                        val = row.get(col)
                        if not pd.isna(val) and str(val).strip():
                            print(f"    {col}: {val}")
                    print(f"{'='*60}\n")
                
                # Monta objeto final
                cliente = {
                    "nome": nome_valor if nome_valor else "Nome não disponível",
                    "documento": safe_str(row.get(cols_map.get('doc'))),
                    "instalacao": safe_str(row.get(cols_map.get('inst'))),
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
                    "message": f"Erro na linha {idx}: {str(ex)}",
                    "details": str(row.to_dict())
                })

        return json.dumps({
            "data": clientes,
            "warnings": warnings
        })

    except Exception as e:
        return json.dumps({"error": f"Erro crítico no processamento: {traceback.format_exc()}"})