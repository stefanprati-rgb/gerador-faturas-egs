import pandas as pd
import io, re, json, unicodedata
from datetime import datetime

# Constantes de Fallback (usadas apenas se não houver dados no arquivo)
CO2_PER_KWH = 0.07
TREES_PER_TON_CO2 = 8
FALLBACK_TARIFA_DIST = 0.92  # Ajustado para média de mercado
FALLBACK_TARIFA_COMP_EV = 0.72

def _norm(s: str) -> str:
    """Normaliza strings para comparação (remove acentos, espaços extras, uppercase)."""
    s = str(s or "")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", "", s).strip().upper() # Removendo todos os espaços para matching mais agressivo

def safe_str(val, default="") -> str:
    """Converte valor para string de forma segura, tratando NaN/None como string vazia ou default."""
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
    # Remove caracteres invisíveis e normaliza espaços
    s = s.replace("\u00a0", " ").replace("\xa0", " ")
    
    # Tratamento de número negativo entre parênteses (100.00) -> -100.00
    neg = False
    if s.startswith('(') and s.endswith(')'):
        neg = True
        s = s[1:-1]
    
    # Remove R$, %, espaços
    s = re.sub(r"[Rr]\$|\%|[A-Za-z]", "", s).replace(" ", "")
    s = s.replace('—', '0').replace('--', '0').replace('-', '-').strip()
    
    if not s or s in {",", ".", "-", "-."}: return 0.0
    
    s = s.replace("+", "")
    # Lógica para distinguir milhar de decimal
    if "," in s and "." in s:
        # Formato 1.234,56 -> remove ponto, troca vírgula
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        # Formato 1234,56 -> troca vírgula
        s = s.replace(",", ".")
    # Se só tem ponto (1.234), assume-se que é float Python padrão se não for 1.234.567
    
    try:
        v = float(s)
        return -v if neg else v
    except ValueError:
        return 0.0

def pick_col(df: pd.DataFrame, *alternativas) -> str:
    """Encontra coluna no DataFrame usando chaves normalizadas."""
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
                # Converte linha para string única normalizada
                row_str = _norm(" ".join(str(v) for v in row.dropna().values))
                # Verifica se TODAS as colunas chave estão presentes (parcialmente)
                if all(_norm(k) in row_str for k in key_cols):
                    return sheet_name, i
        except Exception:
            continue
    return None, -1

def safe_parse_date(val):
    if pd.isna(val): return None
    if isinstance(val, (datetime, pd.Timestamp)): return val
    s = str(val).strip()[:10]
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y'):
        try: return datetime.strptime(s, fmt)
        except: continue
    return None

def compute_metrics(row, cols_map, vencimento_iso):
    """Realiza toda a matemática financeira da fatura."""
    
    # --- 1. Extração de Dados ---
    def get(key, default=0.0):
        col = cols_map.get(key)
        val = to_num(row.get(col, default)) if col else default
        return val

    consumo_qtd = get('consumo_qtd')
    comp_qtd = get('comp_qtd')
    
    # Tarifas
    tarifa_cons = get('tarifa_consumo')
    if tarifa_cons <= 0: tarifa_cons = FALLBACK_TARIFA_DIST
        
    tarifa_comp = get('tarifa_comp_dist') # Tarifa usada para calcular o crédito na distribuidora
    if tarifa_comp <= 0: tarifa_comp = get('tarifa_comp_ev') # Tenta tarifa do EGS
    if tarifa_comp <= 0: tarifa_comp = FALLBACK_TARIFA_COMP_EV

    tarifa_egs = get('tarifa_comp_ev') # Tarifa cobrada pelo EGS
    if tarifa_egs <= 0: tarifa_egs = FALLBACK_TARIFA_COMP_EV

    # --- 2. Cálculos da Distribuidora ---
    # Quanto custaria a energia sem créditos
    valor_consumo_sem_gd = consumo_qtd * tarifa_cons
    
    # Valor do crédito abatido
    valor_credito_abatido = comp_qtd * tarifa_comp
    
    # Fatura Real da Distribuidora (coluna do Excel ou Calculada)
    fatura_dist_real = get('fatura_c_gd')
    
    # Cálculo de "Outros" (CIP, Taxas, Multas)
    # Fórmula: FaturaReal = (Consumo - Credito) + Outros
    # Logo: Outros = FaturaReal - (Consumo - Credito)
    if fatura_dist_real > 0:
        dist_outros = fatura_dist_real - (valor_consumo_sem_gd - valor_credito_abatido)
        # Ajuste fino: Se 'Outros' for muito negativo, provavelmente o cálculo de tarifa está errado ou fatura_dist_real está errada.
        # Vamos assumir 0 se for negativo irrelevante, ou manter para debug.
        if dist_outros < -1.0: 
            # Fallback: Se a conta não fecha, assumimos que Fatura Real é a verdade e ajustamos 'Outros' para 0 visualmente
            # Mas matematicamente mantemos o valor residual
            pass
    else:
        # Se não temos a fatura real, estimamos Outros como 0 (ou um valor fixo de CIP se quiséssemos)
        dist_outros = 0.0
        fatura_dist_real = max(0, valor_consumo_sem_gd - valor_credito_abatido)

    # --- 3. Cálculos EGS (Boleto) ---
    boleto_fechado = get('boleto_ev')
    
    if boleto_fechado > 0:
        total_pagar_egs = boleto_fechado
        # Engenharia reversa da tarifa efetiva para exibição
        tarifa_egs_efetiva = (total_pagar_egs / comp_qtd) if comp_qtd > 0 else 0.0
    else:
        total_pagar_egs = comp_qtd * tarifa_egs
        tarifa_egs_efetiva = tarifa_egs

    # --- 4. Economia ---
    # Custo Sem GD (Cenário de Comparação)
    # O cliente pagaria: Consumo Total + Outros (CIP)
    custo_sem_gd_calculado = valor_consumo_sem_gd + dist_outros
    
    # Custo Com GD (Realidade)
    # O cliente paga: Fatura Distribuidora (Resíduo) + Fatura EGS
    custo_com_gd = fatura_dist_real + total_pagar_egs
    
    economia_mes = custo_sem_gd_calculado - custo_com_gd
    
    # Proteção contra economia negativa por erro de dados
    if economia_mes < -10: # Aceita pequena variação negativa
        # Flag de alerta poderia ser setada aqui
        pass

    # --- 5. Retorno Formatado ---
    def r(x, d=2): return round(float(x or 0), d)

    return {
        # Distribuidora
        "dist_consumo_qtd": r(consumo_qtd),
        "dist_consumo_tar": r(tarifa_cons, 4),
        "dist_consumo_total": r(valor_consumo_sem_gd),
        
        "dist_comp_qtd": r(comp_qtd),
        "dist_comp_tar": r(tarifa_comp, 4),
        "dist_comp_total": r(-valor_credito_abatido), # Negativo visualmente
        
        "dist_outros": r(dist_outros),
        "dist_total": r(fatura_dist_real),
        
        # EGS
        "det_credito_qtd": r(comp_qtd),
        "det_credito_tar": r(tarifa_egs_efetiva, 4),
        "det_credito_total": r(total_pagar_egs),
        
        # Totais e Economia
        "totalPagar": r(total_pagar_egs),
        "econ_total_sem": r(custo_sem_gd_calculado),
        "econ_total_com": r(custo_com_gd),
        "economiaMes": r(economia_mes),
        
        # Ambientais
        "co2Evitado": r(comp_qtd * CO2_PER_KWH),
        "arvoresEquivalentes": r((comp_qtd * CO2_PER_KWH / 1000.0) * TREES_PER_TON_CO2, 1),
        
        # Metadados
        "vencimento_iso": vencimento_iso,
        "emissao_iso": datetime.now().strftime('%Y-%m-%d')
    }

def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    try:
        # Carregar Excel
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        # Definição flexível de colunas (Suporta layout antigo e novo)
        col_defs = {
            'ref': ["REF", "Mês de Referência", "Competência"],
            'inst': ["Instalação", "Nº Instalação", "UC", "Codigo"],
            'nome': ["Nome Cliente", "Nome/Razão Social", "Cliente"],
            'doc': ["Documento", "CPF/CNPJ", "CPF", "CNPJ"],
            'consumo_qtd': ["CONSUMO_FP", "Energia consumida - Fora ponta - quantidade", "Consumo KWh"],
            'comp_qtd': ["CRÉD. CONSUMIDO_FP", "Creditos consumidos - Fora ponta - quantidade", "Energia Compensada"],
            'tarifa_consumo': ["TARIFA FP", "Energia consumida - Fora ponta - tarifa", "Tarifa Cheia"],
            'tarifa_comp_ev': ["TARIFA_Comp_FP", "Tarifa EGS", "Tarifa Acordada"],
            'tarifa_comp_dist': ["TARIFA DE ENERGIA COMPENSADA", "Tarifa Fio B", "Tarifa Compensação"],
            'fatura_c_gd': ["FATURA C/GD", "Saldo Próximo Mês", "Valor Fatura Distribuidora"], # "Saldo Próximo Mês" às vezes é usado como fatura residual em alguns layouts
            'boleto_ev': ["Boleto Hube", "Valor enviado para emissão", "Valor Cobrado"],
            'endereco': ["Endereço", "Logradouro"],
            'bairro': ["Bairro"],
            'cidade': ["Cidade", "Município"],
            'num_conta': ["Número da conta", "Conta Contrato"]
        }

        # Tenta encontrar aba com colunas cruciais
        # CORREÇÃO: Usar um conjunto mínimo de chaves para identificar a linha do cabeçalho
        core_keys = ["REF", "Instalação", "CRÉD. CONSUMIDO_FP"]
        aba, header_idx = find_sheet_and_header(xls, core_keys, prefer_name="Detalhe")
        
        if not aba:
             # Tenta um fallback mais simples, procurando apenas por REF e Instalação
             aba, header_idx = find_sheet_and_header(xls, ["REF", "Instalação"], prefer_name="Detalhe")
        
        if not aba:
            return json.dumps({"error": "Não foi possível identificar a estrutura da planilha. Verifique os cabeçalhos."})

        df = pd.read_excel(xls, sheet_name=aba, header=header_idx)
        df.columns = [str(c).strip() for c in df.columns]

        # Mapear colunas encontradas
        cols_map = {k: pick_col(df, *v) for k, v in col_defs.items()}
        
        # Validação Mínima
        if not cols_map['inst']:
            return json.dumps({"error": "Coluna de Instalação/UC não encontrada."})

        # Filtrar pelo Mês de Referência (se a coluna existir)
        # Se não existir coluna REF, assumimos que a planilha toda é do mês solicitado
        if cols_map['ref']:
            # Tratamento robusto para a data que vem do JS (pode ser YYYY-MM ou YYYY-MM-DD)
            date_input = mes_referencia_str.strip()
            if len(date_input) == 7: # YYYY-MM
                date_input += '-01'
            
            mes_ref_dt = datetime.strptime(date_input, '%Y-%m-%d')
            
            df['__ref_dt'] = df[cols_map['ref']].apply(safe_parse_date)
            
            # Filtra apenas mês/ano correspondente
            df_mes = df[
                (df['__ref_dt'].dt.year == mes_ref_dt.year) & 
                (df['__ref_dt'].dt.month == mes_ref_dt.month)
            ].copy()
            
            if df_mes.empty:
                return json.dumps({"error": f"Nenhum registro encontrado para {mes_referencia_str}."})
        else:
            df_mes = df.copy()

        # Filtro de Valor Mínimo (R$ 5,00)
        # Se tiver coluna de boleto, usa ela. Se não, calcula estimado.
        col_val = cols_map.get('boleto_ev')
        if col_val:
            df_mes = df_mes[df_mes[col_val].apply(to_num) >= 5].copy()
        
        # Processamento
        clientes = []
        warnings = []
        
        # Acumulador para cálculo de economia acumulada (simplificado por enquanto, pois requer histórico)
        # TODO: Implementar histórico real se os dados vierem acumulados na planilha
        
        for idx, row in df_mes.iterrows():
            try:
                metrics = compute_metrics(row, cols_map, vencimento_str)
                
                # Monta endereço de forma segura
                ends = []
                for k in ['endereco', 'bairro', 'cidade']:
                    col_name = cols_map.get(k)
                    if col_name:
                        val = safe_str(row.get(col_name))
                        if val: ends.append(val)
                endereco_completo = " - ".join(ends) or "Endereço não informado"
                
                # Dados básicos com tratamento safe_str
                cliente = {
                    "nome": safe_str(row.get(cols_map.get('nome')), "Nome não disponível"),
                    "documento": safe_str(row.get(cols_map.get('doc'))),
                    "instalacao": safe_str(row.get(cols_map.get('inst'))),
                    "endereco": endereco_completo,
                    "num_conta": safe_str(row.get(cols_map.get('num_conta'))),
                    "economiaTotal": metrics['economiaMes'], # Fallback temporário: Acumulado = Mês (se não tiver histórico)
                }
                
                # Merge com métricas calculadas
                cliente.update(metrics)
                clientes.append(cliente)
                
            except Exception as ex:
                warnings.append({
                    "type": "error", 
                    "message": f"Erro na linha {idx}: {str(ex)}",
                    "details": str(row.to_dict())
                })

        return json.dumps({
            "data": clientes,
            "warnings": warnings
        })

    except Exception as e:
        import traceback
        return json.dumps({"error": f"Erro crítico no processamento: {traceback.format_exc()}"})