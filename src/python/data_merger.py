import pandas as pd
import numpy as np
import re

def mapear_coluna_uc(df, aliases_uc, nome_tabela):
    """
    Localiza a coluna de Unidade Consumidora (UC) no DataFrame.
    Normaliza os nomes das colunas para buscar variações comuns (ex: Instalação, instalacap).
    """
    
    # Normaliza as colunas do DataFrame (minúsculas, sem acentos ou caracteres especiais)
    colunas_normalizadas = {}
    for col in df.columns:
        # Conceito-chave: Normalizar colunas facilita encontrar nomes que variam
        # em maiúsculas/minúsculas ou têm erros de digitação (ex: instalacap vs instalacao).
        norm_col = re.sub(r'[^a-z0-9]', '', col.lower().replace('ã', 'a').replace('ç', 'c'))
        colunas_normalizadas[col] = norm_col
    
    # Mapeamento reverso para obter o nome da coluna original
    mapa_inverso = {v: k for k, v in colunas_normalizadas.items()}
    
    # Normaliza os aliases de busca
    aliases_normalizados = [
        re.sub(r'[^a-z0-9]', '', alias.lower().replace('ã', 'a').replace('ç', 'c'))
        for alias in aliases_uc
    ]
    
    # Busca a coluna original usando os aliases normalizados
    coluna_uc_original = None
    for alias_norm in aliases_normalizados:
        if alias_norm in mapa_inverso:
            coluna_uc_original = mapa_inverso[alias_norm]
            break
            
    if coluna_uc_original is None:
        raise ValueError(f"🚨 ERRO: Coluna de UC não encontrada na tabela '{nome_tabela}'. Buscados aliases como: {aliases_uc}")
        
    return coluna_uc_original

def resolver_mapeamento_e_juntar(df_consumo, df_clientes):
    """
    Realiza o mapeamento flexível da coluna UC, executa um LEFT JOIN e resolve 
    os nomes de clientes ausentes.
    """
    
    INSTALACAO_ALIASES = ['INSTALACAO', 'Instalação', 'instalacap', 'instalção', 'UC']
    NOME_CLIENTE_COL = 'Nome/Razão Social'
    
    # 1. Mapeamento da Coluna UC
    coluna_uc_consumo = mapear_coluna_uc(df_consumo, INSTALACAO_ALIASES, "Detalhe Por UC")
    coluna_uc_clientes = mapear_coluna_uc(df_clientes, INSTALACAO_ALIASES, "Infos Clientes")
    
    # Prepara a tabela de clientes para o JOIN
    df_clientes_proc = df_clientes.copy()
    
    # Renomeia as colunas chave no DF de clientes para um nome único para o merge
    df_clientes_proc = df_clientes_proc.rename(columns={
        coluna_uc_clientes: 'UC_CHAVE_JOIN',
        NOME_CLIENTE_COL: 'Nome_Cliente_Fonte' 
    })
    
    # Seleciona apenas as colunas de junção do DF de clientes, removendo duplicatas
    df_clientes_join = df_clientes_proc[['UC_CHAVE_JOIN', 'Nome_Cliente_Fonte']].drop_duplicates(subset=['UC_CHAVE_JOIN'])
    
    # 2. LEFT JOIN
    # O LEFT JOIN preserva todas as linhas da tabela de consumo.
    df_final = pd.merge(
        left=df_consumo,
        right=df_clientes_join,
        left_on=coluna_uc_consumo,
        right_on='UC_CHAVE_JOIN',
        how='left'
    ).drop(columns=['UC_CHAVE_JOIN']) 
    
    # 3. Imputação (Preenchimento) do Nome/Razão Social
    
    # Preenche os valores NaN/ausentes na coluna original 'Nome/Razão Social'
    # da planilha de consumo com os valores obtidos do 'Infos Clientes'
    df_final[NOME_CLIENTE_COL] = df_final[NOME_CLIENTE_COL].fillna(
        df_final['Nome_Cliente_Fonte']
    )
    
    # Remove a coluna auxiliar do nome do cliente
    df_final = df_final.drop(columns=['Nome_Cliente_Fonte'])
    
    # 4. Validação e Flagging (Marcação)
    
    # Se o nome ainda estiver nulo após o preenchimento, significa que estava ausente
    # em ambas as fontes, e o registro deve ser marcado.
    nome_ausente = df_final[NOME_CLIENTE_COL].isnull()
    
    df_final['Nome Ausente - Bloquear Emissão'] = np.where(nome_ausente, 'SIM', 'NÃO')
    
    return df_final

# ----------------------------------------------------------------------
# Exemplo de uso
# ----------------------------------------------------------------------
if __name__ == '__main__':
    
    # --- SIMULAÇÃO DE DADOS (Substitua pela leitura real dos seus CSVs) ---
    
    # Planilha Detalhe Por UC (Consumo - Coluna UC: 'instalacap', Nome ausente)
    data_consumo = {
        'Data Ref': ['2025-11', '2025-11', '2025-11', '2025-11', '2025-11'],
        'instalacap': ['10/908851-4', '10/908866-7', '10/2344751-9', '10/1111111-1', '10/2222222-2'],
        'Consumo kWh': [500, 250, 800, 100, 50],
        'Nome/Razão Social': [np.nan, 'IGREJA (Parcial)', np.nan, np.nan, np.nan], # Nome ausente ou parcial
        'Outra Coluna Detalhe': [1, 2, 3, 4, 5]
    }
    df_detalhe_uc = pd.DataFrame(data_consumo)
    
    # Planilha Infos Clientes (Clientes - Coluna UC: 'Instalação', Nome principal)
    data_clientes = {
        'Linha': [1, 2, 3, 4],
        'Instalação': ['10/908851-4', '10/908866-7', '10/3333333-3', '10/1111111-1'],
        'Nome/Razão Social': ['EMPRESA X LTDA', 'IGREJA DO EVANGELHO QUADRANGULAR', np.nan, ''], # UC '10/1111111-1' tem nome nulo em clientes
        'CPF/CNPJ': ['11.111.111/0001-11', '22.222.222/0001-22', '33.333.333/0001-33', '44.444.444/0001-44'],
    }
    df_infos_clientes = pd.DataFrame(data_clientes)

    print("--- Dados Iniciais Detalhe Por UC ---")
    print(df_detalhe_uc[['instalacap', 'Nome/Razão Social', 'Consumo kWh']].to_markdown(index=False))
    
    # --- EXECUÇÃO DA LÓGICA ---
    df_processado = resolver_mapeamento_e_juntar(df_detalhe_uc, df_infos_clientes)
    
    # --- RESULTADO ---
    print("\n--- Resultado Processado (Nomes Ausentes Resolvidos e Marcados) ---")
    print(df_processado[['instalacap', 'Nome/Razão Social', 'Consumo kWh', 'Nome Ausente - Bloquear Emissão']].to_markdown(index=False))

# Fim do arquivo.