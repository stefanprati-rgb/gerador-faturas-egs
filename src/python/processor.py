import pandas as pd
import io, json
import traceback
import warnings as python_warnings
from datetime import datetime
import re
from typing import Optional, Dict, Any
import os
from pathlib import Path

# =================================================================
# MÓDULO DE CÁLCULOS INTEGRADO (MODO ESPELHO)
# =================================================================

CO2_PER_KWH = 0.07
TREES_PER_TON_CO2 = 8

def to_num(val):
    """
    Converte valores para float de forma segura (BR ou US).
    """
    if pd.isna(val) or val == '': return 0.0
    try:
        if isinstance(val, (int, float)): return float(val)
        val_str = str(val).strip().replace('R$', '').replace(' ', '')
        if ',' in val_str and '.' in val_str:
            if val_str.rfind(',') > val_str.rfind('.'): # BR
                val_str = val_str.replace('.', '').replace(',', '.')
            else: # US
                val_str = val_str.replace(',', '')
        elif ',' in val_str: # BR
            val_str = val_str.replace(',', '.')
        return float(val_str)
    except:
        return 0.0

def compute_metrics(row, cols_map, vencimento_iso):
    """
    Prepara os dados para o PDF coletando TODOS os valores da planilha.
    NENHUM VALOR FINANCEIRO É CALCULADO - todos vêm da planilha.
    """
    def get(key, default=0.0):
        col = cols_map.get(key)
        return to_num(row.get(col, default)) if col else default

    # ============================================================
    # 1. COLETA DE QUANTIDADES (kWh)
    # ============================================================
    consumo_qtd = get('consumo_qtd')
    comp_qtd = get('comp_qtd')

    # ============================================================
    # 2. COLETA DE TARIFAS (R$/kWh) - DA PLANILHA
    # ============================================================
    tarifa_consumo = get('tarifa_consumo')     # Tarifa de consumo (TARIFA FP)
    tarifa_credito = get('tarifa_credito')     # Tarifa de crédito (Tarifa média compensada)

    # ============================================================
    # 3. COLETA DE VALORES FINANCEIROS (R$) - DA PLANILHA
    # ============================================================
    dist_total = get('fatura_c_gd')            # Total fatura distribuidora
    outros = get('outros')                      # Contrib. Ilum. Pública e Outros
    egs_total = get('boleto_ev')               # Total boleto EGS
    
    # ============================================================
    # 4. COLETA DE CUSTOS PARA ECONOMIA (R$) - DA PLANILHA
    # ============================================================
    custo_sem_solar = get('custo_sem_gd')      # Custo SEM GD
    custo_com_solar = get('custo_com_gd')      # Custo COM GD
    economia_planilha = get('economia')        # Economia direta da planilha
    
    # Se a planilha tiver a economia direta, usar ela
    # Senão, calcular a partir dos custos (se disponíveis)
    if economia_planilha > 0:
        economia_mes = economia_planilha
    elif custo_sem_solar > 0 and custo_com_solar > 0:
        economia_mes = max(0.0, custo_sem_solar - custo_com_solar)
    else:
        # Fallback final: se não tiver nada, zerar
        economia_mes = 0.0

    # ============================================================
    # 5. MÉTRICAS AMBIENTAIS (estas são calculadas, ok)
    # ============================================================
    co2_evitado = consumo_qtd * CO2_PER_KWH
    arvores = (co2_evitado / 1000.0) * TREES_PER_TON_CO2

    def r(x, d=2): return round(float(x or 0), d)

    return {
        # Bloco Distribuidora
        "dist_consumo_qtd": r(consumo_qtd),
        "dist_consumo_tar": r(tarifa_consumo, 4),    # ← COLETADO da planilha
        "dist_consumo_total": r(dist_total),
        "dist_comp_qtd": r(comp_qtd),
        "dist_comp_tar": 0,
        "dist_comp_total": 0,
        "dist_outros": r(outros),                     # ← COLETADO da planilha
        "dist_total": r(dist_total),
        
        # Bloco EGS / Boleto
        "det_credito_qtd": r(comp_qtd),
        "det_credito_tar": r(tarifa_credito, 4),     # ← COLETADO da planilha
        "det_credito_total": r(egs_total),
        "det_total_contrib": r(egs_total),
        "totalPagar": r(egs_total),
        
        # Economia
        "econ_total_sem": r(custo_sem_solar),        # ← COLETADO da planilha
        "econ_total_com": r(custo_com_solar),        # ← COLETADO da planilha
        "economiaMes": r(economia_mes),              # ← COLETADO da planilha
        
        # Métricas Ambientais (calculadas, ok)
        "co2Evitado": r(co2_evitado),
        "arvoresEquivalentes": r(arvores, 1),
        
        # Datas
        "vencimento_iso": vencimento_iso,
        "emissao_iso": datetime.now().strftime('%Y-%m-%d')
    }

# =================================================================
# PROCESSADOR PRINCIPAL
# =================================================================

# Suprime warnings do openpyxl
python_warnings.filterwarnings('ignore', category=UserWarning, module='openpyxl')

# =================================================================
# CONFIGURAÇÃO E CARREGAMENTO DE BASE EXTERNA
# =================================================================

def carregar_config():
    """Carrega configuração do arquivo config.json"""
    try:
        # Tentar diferentes caminhos para compatibilidade com Pyodide e servidor
        possible_paths = []
        
        # 1. Caminho raiz do Pyodide (onde excelProcessor.js escreve o arquivo)
        possible_paths.append(Path('/config.json'))
        
        # 2. Tentar usar __file__ (funciona em servidor Python normal)
        try:
            possible_paths.append(Path(__file__).parent / 'config.json')
        except NameError:
            pass  # __file__ não existe no Pyodide
        
        # 3. Tentar caminhos relativos
        possible_paths.append(Path('config.json'))
        possible_paths.append(Path('./config.json'))
        possible_paths.append(Path('src/python/config.json'))
        
        # Tentar cada caminho
        for config_path in possible_paths:
            try:
                if config_path.exists():
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                        print(f"✓ Configuração carregada de: {config_path}")
                        return config
            except:
                continue
        
        print("⚠ Arquivo config.json não encontrado em nenhum caminho")
    except Exception as e:
        print(f"⚠ Erro ao carregar config.json: {e}")
    return {}

def carregar_base_clientes_externa(config):
    """
    Carrega a base de clientes de um arquivo externo configurado.
    Retorna um mapa {UC: {nome, doc, endereco, bairro, cidade, num_conta}}
    """
    if not config.get('enable_external_client_db', False):
        print("📋 Base de clientes externa desabilitada na configuração")
        return {}
    
    db_path = config.get('client_database_path', '')
    
    # Prioridade 1: Arquivo carregado via upload no Pyodide (/external_client_db.xlsx)
    # Prioridade 2: Caminho do SharePoint (expandir variáveis de ambiente)
    if db_path and not db_path.startswith('/'):
        db_path = os.path.expandvars(db_path)
    
    if not db_path or not os.path.exists(db_path):
        print(f"⚠ Arquivo de base de clientes não encontrado: {db_path}")
        return {}
    
    try:
        print(f"📂 Carregando base de clientes externa: {db_path}")
        xls_ext = pd.ExcelFile(db_path, engine='openpyxl')
        
        # Tentar encontrar a aba correta
        sheet_name = config.get('client_database_sheet', None)
        if not sheet_name or sheet_name not in xls_ext.sheet_names:
            # Tentar primeira aba ou aba com nome relevante
            for sn in xls_ext.sheet_names:
                if any(term in sn.lower() for term in ['cliente', 'base', 'cadastro']):
                    sheet_name = sn
                    break
            if not sheet_name:
                sheet_name = xls_ext.sheet_names[0]
        
        print(f"📄 Usando aba: '{sheet_name}'")
        
        # Usar header_row configurado ou tentar encontrar automaticamente
        h_idx = config.get('client_database_header_row', None)
        
        if h_idx is None:
            # Tentar encontrar header automaticamente
            _, h_idx = find_sheet_and_header(
                xls_ext, 
                ["Instalação", "Nome", "CPF", "CNPJ", "Endereço", "NOME COMPLETO"],
                prefer_name=sheet_name
            )
        else:
            print(f"✓ Usando header configurado: linha {h_idx}")
        
        df_ext = pd.read_excel(xls_ext, sheet_name=sheet_name, header=h_idx)
        print(f"✓ Base externa carregada: {len(df_ext)} linhas")
        print(f"  Colunas disponíveis: {list(df_ext.columns[:15])}")
        
        mapa = criar_mapa_completo_clientes(df_ext)
        print(f"✓ Mapa de clientes externos criado: {len(mapa)} registros")
        
        return mapa
        
    except Exception as e:
        print(f"✗ ERRO ao carregar base de clientes externa: {str(e)}")
        print(f"   Traceback: {traceback.format_exc()}")
        return {}

# COLUMNS_MAP AJUSTADO COM NOMES REAIS DAS COLUNAS DO RELATÓRIO
COLUMNS_MAP = {
    'ref': ["REF (sempre dia 01 de cada mês)", "REF", "Mês de Referência", "Competência", "Data", "Data Ref", "Referencia", "Mês", "Referência", "Data Emissao"],
    'inst': ["Instalação", "Nº Instalação", "UC", "Codigo"],
    # Dados Cadastrais
    'nome': ["NOME COMPLETO OU RAZÃO SOCIAL", "Nome Cliente", "Nome/Razão Social", "Cliente", "NOME", "RAZÃO SOCIAL"],
    'doc': ["CNPJ", "Documento", "CPF/CNPJ", "CPF"],
    'endereco': ["ENDEREÇO COMPLETO", "Endereço", "Logradouro", "Rua"],
    'bairro': ["Bairro"],
    'cidade': ["Cidade", "Município"],
    'num_conta': ["Número da conta", "Conta Contrato", "Conta"],
    
    # ============================================================
    # DADOS FINANCEIROS - TODOS COLETADOS DA PLANILHA
    # ============================================================
    
    # Quantidades (kWh)
    'consumo_qtd': ["CONSUMO_FP", "Energia consumida - Fora ponta - quantidade", "Consumo KWh"],
    'comp_qtd': ["CRÉD. CONSUMIDO_FP", "Creditos consumidos - Fora ponta - quantidade", "Energia Compensada"],
    
    # Tarifas (R$/kWh) - COLETADAS, NÃO CALCULADAS
    'tarifa_consumo': [
        "TARIFA FP",                    # ← Tarifa com impostos (prioridade)
        "TARIFA S/ IMPOSTOS FP",        # ← Tarifa sem impostos (fallback)
        "Energia consumida - Fora ponta - tarifa",
        "Tarifa Cheia"
    ],
    'tarifa_credito': [
        "Tarifa média compensada sobre energia compensada",  # ← Tarifa média real
        "TARIFA_Comp_FP",               # ← Tarifa de compensação
        "Tarifa EGS",
        "Tarifa Acordada"
    ],
    
    # Valores da Distribuidora (R$)
    'fatura_c_gd': ["FATURA C/GD", "FATURA C/GD COM RESTITUIÇÃO", "Saldo Próximo Mês", "Valor Fatura Distribuidora"],
    'outros': [
        "OUTROS",                       # ← Contrib. Ilum. Pública e Outros
        "Contrib Ilum Publica",
        "CIP",
        "Iluminação Pública"
    ],
    
    # Boleto EGS (R$)
    'boleto_ev': [
        "Boleto Hube definido para a ref. Mensal",  # ← PRIORIDADE 1: Valor final
        "Valor enviado para emissão",
        "Boleto Emitido Gera StarkBank",
        "Boleto PAGO StarkBank",
        "valorTotal",
        "Valor Cobrado",
        "Valor Boleto"
    ],
    
    # Custos para Economia (R$) - COLETADOS, NÃO CALCULADOS
    'custo_sem_gd': [
        "CUSTO_S_GD ",                  # ← Com espaço (nome real)
        "CUSTO_S_GD",                   # ← Sem espaço (fallback)
        "Custo Sem GD",
        "CUSTO SEM GD"
    ],
    'custo_com_gd': [
        "CUSTO_C_GD\n(Fatura real+Boleto Gera Final)",
        "CUSTO_C_GD\n(Fatura real+Boleto Gera Padrão)",
        "CUSTO_C_GD",
        "Custo Com GD"
    ],
    
    # Economia (R$) - COLETADA DIRETAMENTE
    'economia': [
        "Ganho energia compensada (R$) Final",  # ← Economia final
        "Ganho Total (R$) Padrão",
        "Ganho total Final",
        "Economia",
        "Ganho"
    ]
}


def limpar_uc(valor):
    if not valor: return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(valor)).upper()

def safe_str(val):
    if pd.isna(val) or val is None: return ""
    return str(val).strip()

def safe_parse_date(val):
    try:
        if pd.isna(val): return None
        if isinstance(val, datetime): return val
        # Tenta múltiplos formatos
        val_str = str(val).strip()[:10] # Pega só a data se tiver hora
        for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d']:
            try:
                return datetime.strptime(val_str, fmt)
            except: continue
        return pd.to_datetime(val, dayfirst=True)
    except:
        return None

def find_sheet_and_header(xls, mandatory_cols, prefer_name=None):
    sheets_to_try = xls.sheet_names
    if prefer_name:
        sheets_to_try = sorted(sheets_to_try, key=lambda x: 0 if prefer_name.lower() in x.lower() else 1)

    for sheet in sheets_to_try:
        try:
            df_preview = pd.read_excel(xls, sheet_name=sheet, header=None, nrows=20)
            for r in range(len(df_preview)):
                row_vals = [str(v).strip().lower() for v in df_preview.iloc[r] if pd.notna(v)]
                if any(m.lower() in row_vals for m in mandatory_cols):
                    return sheet, r
        except: continue
    return None, 0

def pick_col(df, *possibles):
    cols_lower = {str(c).strip().lower(): c for c in df.columns}
    for p in possibles:
        if p.lower() in cols_lower: return cols_lower[p.lower()]
    return None

def _norm(s):
    return re.sub(r'[^a-zA-Z0-9]', '', str(s).lower())

def _diagnosticar_colunas(df: pd.DataFrame) -> str:
    colunas = list(df.columns)
    mostrar = colunas[:10]
    res = f"Colunas encontradas ({len(colunas)}): {', '.join(mostrar)}"
    if len(colunas) > 10: res += "..."
    return res

def _mapear_coluna_uc(df: pd.DataFrame) -> Optional[str]:
    termos = ["INSTALACAO", "INSTALAÇÃO", "Nº INSTALACAO", "UC", "CODIGO"]
    colunas_map = {_norm(col): col for col in df.columns}
    for t in termos:
        if _norm(t) in colunas_map: return colunas_map[_norm(t)]
    for c_norm, c_orig in colunas_map.items():
        if "instal" in c_norm or "cod" in c_norm: return c_orig
    return None

def _mapear_coluna_generic(df: pd.DataFrame, keys_list) -> Optional[str]:
    colunas_map = {_norm(col): col for col in df.columns}
    for k in keys_list:
        if _norm(k) in colunas_map: return colunas_map[_norm(k)]
    return None

def criar_mapa_completo_clientes(df_clientes: pd.DataFrame) -> Dict[str, Dict]:
    col_uc = _mapear_coluna_uc(df_clientes)
    cols_cli = {}
    for field in ['nome', 'doc', 'endereco', 'bairro', 'cidade', 'num_conta']:
        cols_cli[field] = _mapear_coluna_generic(df_clientes, COLUMNS_MAP[field])

    if not col_uc: 
        print("✗ ERRO: Coluna UC não encontrada na aba Infos Clientes")
        return {}
    
    print(f"✓ Coluna UC encontrada: '{col_uc}'")
    print(f"✓ Colunas mapeadas: {cols_cli}")

    mapa = {}
    for idx, row in df_clientes.iterrows():
        raw_uc = str(row.get(col_uc, '')).strip()
        if not raw_uc or raw_uc.lower() == 'nan': continue
        ficha = {}
        for field, col_name in cols_cli.items():
            if col_name: 
                valor = safe_str(row.get(col_name))
                ficha[field] = valor
                if idx < 3:  # Debug primeiras 3 linhas
                    print(f"  UC {raw_uc} - {field}: '{valor}' (coluna: {col_name})")
        mapa[raw_uc] = ficha
        chave_limpa = limpar_uc(raw_uc)
        if chave_limpa: mapa[chave_limpa] = ficha
    
    print(f"✓ Mapa criado com {len(mapa)} registros")
    return mapa

def processar_relatorio_para_fatura(file_content, mes_referencia_str, vencimento_str):
    try:
        xls = pd.ExcelFile(io.BytesIO(file_content), engine='openpyxl')
        
        # 1. Carregar Aba Detalhe
        aba_detalhe, h_idx_det = find_sheet_and_header(xls, ["REF", "Instalação", "Data"], prefer_name="Detalhe")
        if not aba_detalhe: return json.dumps({"error": "Aba 'Detalhe Por UC' não encontrada."})

        df = pd.read_excel(xls, sheet_name=aba_detalhe, header=h_idx_det)
        df.columns = [str(c).strip() for c in df.columns]
        
        cols_map_det = {k: pick_col(df, *v) for k, v in COLUMNS_MAP.items()}
        col_inst_det = _mapear_coluna_uc(df)
        
        # Log de debug para verificar mapeamento do boleto
        print(f"🔍 Coluna mapeada para 'boleto_ev': {cols_map_det.get('boleto_ev')}")
        print(f"🔍 Coluna mapeada para 'fatura_c_gd': {cols_map_det.get('fatura_c_gd')}")
        
        if not col_inst_det:
            return json.dumps({"error": "Coluna Instalação não achada no detalhe.", "details": _diagnosticar_colunas(df)})

        # --- TRAVA DE SEGURANÇA: FILTRO DE DATA OBRIGATÓRIO ---
        if not cols_map_det['ref']:
            # Se não achou coluna de data, aborta para não gerar 850 faturas
            return json.dumps({
                "error": "Não encontrei a coluna de DATA/MÊS na planilha.", 
                "details": f"O sistema precisa saber o mês para gerar apenas as faturas corretas. {_diagnosticar_colunas(df)}"
            })

        # 2. Carregar Aba Clientes (com suporte a base externa)
        mapa_clientes = {}
        
        # 2.1 Tentar carregar base de clientes externa primeiro
        config = carregar_config()
        mapa_clientes_externo = carregar_base_clientes_externa(config)
        
        if mapa_clientes_externo:
            print(f"✓ Base de clientes externa carregada com sucesso: {len(mapa_clientes_externo)} registros")
            mapa_clientes = mapa_clientes_externo
        
        # 2.2 Tentar carregar aba de clientes do relatório (para complementar ou substituir)
        aba_clientes = None
        
        print(f"📋 Procurando aba de clientes no relatório. Abas disponíveis: {xls.sheet_names}")
        
        for sheet in xls.sheet_names:
            if 'info' in sheet.lower() and 'cliente' in sheet.lower(): 
                aba_clientes = sheet
                print(f"✓ Aba de clientes encontrada: '{aba_clientes}'")
                break
        
        if not aba_clientes:
            print("⚠ Aba 'Infos Clientes' não encontrada pelo nome, tentando busca por colunas...")
            aba_clientes, h_idx_cli = find_sheet_and_header(xls, ["Nome/Razão Social", "CPF/CNPJ", "Instalação"], prefer_name="Infos")
            if aba_clientes:
                print(f"✓ Aba encontrada por busca: '{aba_clientes}' (header linha {h_idx_cli})")
        else:
            # Para aba Infos Clientes, procurar por colunas específicas
            _, h_idx_cli = find_sheet_and_header(xls, ["Nome/Razão Social", "CPF/CNPJ", "Instalação"], prefer_name=aba_clientes)
            print(f"✓ Header da aba '{aba_clientes}' na linha {h_idx_cli}")
            
        if aba_clientes:
            try:
                df_cli = pd.read_excel(xls, sheet_name=aba_clientes, header=h_idx_cli)
                print(f"✓ Aba '{aba_clientes}' carregada com {len(df_cli)} linhas")
                print(f"  Colunas: {list(df_cli.columns[:10])}")
                mapa_clientes_interno = criar_mapa_completo_clientes(df_cli)
                print(f"✓ Mapa de clientes interno carregado: {len(mapa_clientes_interno)} registros.")
                
                # Merge: dados internos complementam/sobrescrevem externos
                if mapa_clientes_externo:
                    # Mesclar: prioridade para dados do relatório (mais atualizados)
                    for uc, dados in mapa_clientes_interno.items():
                        if uc in mapa_clientes:
                            # Atualizar apenas campos não vazios do relatório
                            for campo, valor in dados.items():
                                if valor and valor.strip():
                                    mapa_clientes[uc][campo] = valor
                        else:
                            mapa_clientes[uc] = dados
                    print(f"✓ Dados mesclados: {len(mapa_clientes)} registros totais")
                else:
                    mapa_clientes = mapa_clientes_interno
                    
            except Exception as e:
                print(f"✗ ERRO ao carregar aba clientes: {str(e)}")
        else:
            if not mapa_clientes:
                print("✗ AVISO: Nenhuma fonte de dados de clientes disponível!")


        # 3. Filtrar por Mês (AGORA COM LOG E TRATAMENTO DE ERRO)
        df_mes = pd.DataFrame()
        date_input = mes_referencia_str.strip()
        if len(date_input) == 7: date_input += '-01'
        
        try:
            mes_ref_dt = datetime.strptime(date_input, '%Y-%m-%d')
            df['__ref_dt'] = df[cols_map_det['ref']].apply(safe_parse_date)
            
            # Filtra onde Ano e Mês batem
            df_mes = df[(df['__ref_dt'].dt.year == mes_ref_dt.year) & (df['__ref_dt'].dt.month == mes_ref_dt.month)].copy()
            
            print(f"✓ Filtro de Data Aplicado: {len(df_mes)} registros encontrados para {mes_referencia_str}")
        except Exception as e:
            return json.dumps({"error": f"Erro ao filtrar data na coluna '{cols_map_det['ref']}': {str(e)}"})

        if cols_map_det.get('boleto_ev'):
            df_mes = df_mes[df_mes[cols_map_det['boleto_ev']].apply(to_num) >= 5].copy()

        if df_mes.empty: 
            return json.dumps({"error": f"Nenhum registro encontrado para {mes_referencia_str}. Verifique se a data na planilha bate com a data selecionada."})

        # 4. Processamento
        clientes = []
        warnings = []

        for idx, row in df_mes.iterrows():
            try:
                raw_id = str(row.get(col_inst_det, '')).strip()
                id_limpo = limpar_uc(raw_id)
                
                ficha = {}
                status_map = "OK"
                if raw_id in mapa_clientes: ficha = mapa_clientes[raw_id]
                elif id_limpo in mapa_clientes: ficha = mapa_clientes[id_limpo]
                
                if not ficha:
                    status_map = "Nome Não Mapeado"
                    warnings.append({"type": "warning", "title": "Cliente não achado", "message": f"UC {raw_id} sem cadastro."})

                def get_val(field):
                    col_det = cols_map_det.get(field)
                    if col_det and pd.notna(row.get(col_det)) and str(row.get(col_det)).strip() != '':
                        return safe_str(row.get(col_det))
                    if ficha and field in ficha and ficha[field]:
                        return ficha[field]
                    return ""

                metrics = compute_metrics(row, cols_map_det, vencimento_str)
                
                ends = []
                rua = get_val('endereco'); bairro = get_val('bairro'); cidade = get_val('cidade')
                if rua: ends.append(rua)
                if bairro: ends.append(bairro)
                if cidade: ends.append(cidade)
                endereco_completo = " - ".join(ends)

                cliente = {
                    "raw_id": raw_id,
                    "instalacao": raw_id,
                    "nome": get_val('nome') or "Cliente não identificado",
                    "documento": get_val('doc'),
                    "num_conta": get_val('num_conta'),
                    "endereco": endereco_completo,
                    "status_mapeamento": status_map,
                    "economiaTotal": metrics['economiaMes'],
                }
                
                cliente.update(metrics)
                clientes.append(cliente)

            except Exception as ex:
                warnings.append({"type": "error", "title": "Erro linha", "message": str(ex)})

        return json.dumps({"data": clientes, "warnings": warnings})

    except Exception as e:
        return json.dumps({"error": f"Erro crítico: {traceback.format_exc()}"})