import pandas as pd
import io, json
import traceback
from datetime import datetime

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
                
                # Monta objeto final
                cliente = {
                    # Assumes safe_str is global
                    "nome": safe_str(row.get(cols_map.get('nome')), "Nome não disponível"), 
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