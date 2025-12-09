"""
Script de teste para validar o carregamento da base de clientes externa
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from processor import carregar_config, carregar_base_clientes_externa

def testar_base_clientes():
    print("=" * 60)
    print("TESTE DE CARREGAMENTO DA BASE DE CLIENTES EXTERNA")
    print("=" * 60)
    
    # 1. Carregar configuração
    print("\n1️⃣ Carregando configuração...")
    config = carregar_config()
    print(f"   ✓ Configuração carregada:")
    print(f"     - Caminho: {config.get('client_database_path')}")
    print(f"     - Aba: {config.get('client_database_sheet')}")
    print(f"     - Header: linha {config.get('client_database_header_row')}")
    print(f"     - Habilitado: {config.get('enable_external_client_db')}")
    
    # 2. Carregar base de clientes
    print("\n2️⃣ Carregando base de clientes externa...")
    mapa_clientes = carregar_base_clientes_externa(config)
    
    if not mapa_clientes:
        print("   ✗ ERRO: Nenhum cliente foi carregado!")
        return False
    
    print(f"   ✓ Base carregada com sucesso: {len(mapa_clientes)} registros")
    
    # 3. Verificar alguns registros
    print("\n3️⃣ Verificando registros de exemplo...")
    count = 0
    for uc, dados in mapa_clientes.items():
        if count >= 3:  # Mostrar apenas 3 exemplos
            break
        if dados.get('nome'):  # Só mostrar se tiver nome
            print(f"\n   UC: {uc}")
            print(f"   - Nome: {dados.get('nome', 'N/A')}")
            print(f"   - Documento: {dados.get('doc', 'N/A')}")
            print(f"   - Endereço: {dados.get('endereco', 'N/A')}")
            print(f"   - Bairro: {dados.get('bairro', 'N/A')}")
            print(f"   - Cidade: {dados.get('cidade', 'N/A')}")
            count += 1
    
    # 4. Verificar campos de endereço
    print("\n4️⃣ Verificando campos de endereço...")
    com_endereco = sum(1 for dados in mapa_clientes.values() if dados.get('endereco'))
    com_bairro = sum(1 for dados in mapa_clientes.values() if dados.get('bairro'))
    com_cidade = sum(1 for dados in mapa_clientes.values() if dados.get('cidade'))
    
    print(f"   - Registros com endereço: {com_endereco}/{len(mapa_clientes)}")
    print(f"   - Registros com bairro: {com_bairro}/{len(mapa_clientes)}")
    print(f"   - Registros com cidade: {com_cidade}/{len(mapa_clientes)}")
    
    print("\n" + "=" * 60)
    print("✅ TESTE CONCLUÍDO COM SUCESSO!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    try:
        sucesso = testar_base_clientes()
        sys.exit(0 if sucesso else 1)
    except Exception as e:
        print(f"\n❌ ERRO DURANTE O TESTE: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
