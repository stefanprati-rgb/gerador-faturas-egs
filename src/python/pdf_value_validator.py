"""
Módulo de Validação de Valores de Faturas PDF

Compara os valores entre as páginas de faturas unificadas:
- Página 1: "Total a Pagar" (fatura EGS)
- Página 2: "Valor do Documento" (boleto bancário)

Separa PDFs em pastas conforme resultado da validação.
"""

import os
import re
import shutil
from pathlib import Path
from typing import Optional, Tuple, List, Dict

try:
    import pdfplumber
except ImportError:
    print("ERRO: pdfplumber não instalado. Execute: pip install pdfplumber")
    raise


def extrair_valor_pagina1(texto: str) -> Optional[float]:
    """
    Extrai o valor "Total a Pagar" da primeira página (fatura EGS).
    
    Padrões buscados:
    - "Total a Pagar R$ 125,70"
    - "R$ 125,70" após "Total a Pagar"
    """
    # Padrão 1: Total a Pagar seguido de valor
    padrao1 = r'Total\s*a\s*Pagar.*?R\$\s*([\d.,]+)'
    match = re.search(padrao1, texto, re.IGNORECASE | re.DOTALL)
    if match:
        return _parse_valor_br(match.group(1))
    
    # Padrão 2: totalPagar ou similar
    padrao2 = r'totalPagar.*?R\$\s*([\d.,]+)'
    match = re.search(padrao2, texto, re.IGNORECASE)
    if match:
        return _parse_valor_br(match.group(1))
    
    # Padrão 3: Valor após "Pagar"
    padrao3 = r'Pagar\s*R\$\s*([\d.,]+)'
    match = re.search(padrao3, texto, re.IGNORECASE)
    if match:
        return _parse_valor_br(match.group(1))
    
    return None


def extrair_valor_pagina2(texto: str) -> Optional[float]:
    """
    Extrai o valor "Valor do Documento" da segunda página (boleto).
    
    Padrões buscados (em ordem de prioridade):
    1. Código de barras formato 1296000001XXXX (valor em centavos) - MAIS CONFIÁVEL
    2. "(=) Valor do Documento" seguido de texto com o valor
    3. "R$ XXX,XX" mais comum no documento
    """
    # PADRÃO 1 (PRIORIDADE): Extrair do código de barras
    # Formato: 1296 + zeros + valor em centavos
    # Exemplo: "12960000011945" -> 11945 centavos = R$ 119,45
    padrao_barras = r'1296[0]+(\d{5,7})'
    match = re.search(padrao_barras, texto)
    if match:
        valor_centavos_str = match.group(1)
        valor = int(valor_centavos_str) / 100
        if 1 < valor < 10000:
            return round(valor, 2)
    
    # Padrão 2: "(=) Valor do Documento" - buscar valor R$ após esse texto
    padrao2 = r'\(=\)\s*Valor\s*(?:do\s*)?Documento'
    match2 = re.search(padrao2, texto, re.IGNORECASE)
    if match2:
        texto_apos = texto[match2.end():]
        valores_apos = re.findall(r'R\$\s*([\d.,]+)', texto_apos)
        for v in valores_apos:
            valor = _parse_valor_br(v)
            if valor and 10 < valor < 10000:
                return valor
    
    # Padrão 3: Buscar "Valor do Documento" seguido de valor
    padrao3 = r'Valor\s*(?:do\s*)?Documento[^\d]*R?\$?\s*([\d.,]+)'
    match = re.search(padrao3, texto, re.IGNORECASE)
    if match:
        valor = _parse_valor_br(match.group(1))
        if valor and 10 < valor < 10000:
            return valor
    
    # Padrão 4: Último recurso - pegar o valor mais comum
    valores = re.findall(r'R\$\s*([\d.,]+)', texto)
    valores_parsed = []
    for v in valores:
        val = _parse_valor_br(v)
        if val and 10 < val < 10000:
            valores_parsed.append(val)
    
    if valores_parsed:
        from collections import Counter
        mais_comum = Counter(valores_parsed).most_common(1)
        if mais_comum:
            return mais_comum[0][0]
    
    return None


def _parse_valor_br(valor_str: str) -> Optional[float]:
    """Converte string de valor BR (1.234,56) para float."""
    if not valor_str:
        return None
    try:
        # Remove espaços
        valor_str = valor_str.strip()
        # Formato BR: 1.234,56 -> 1234.56
        if ',' in valor_str:
            valor_str = valor_str.replace('.', '').replace(',', '.')
        return round(float(valor_str), 2)
    except (ValueError, AttributeError):
        return None


def validar_pdf(caminho_pdf: str) -> Dict:
    """
    Valida um PDF comparando valores das páginas 1 e 2.
    
    Returns:
        Dict com: {
            'arquivo': nome do arquivo,
            'valor_pagina1': valor extraído da página 1,
            'valor_pagina2': valor extraído da página 2,
            'divergente': True se valores diferentes,
            'diferenca': diferença absoluta entre valores,
            'erro': mensagem de erro se houver
        }
    """
    resultado = {
        'arquivo': os.path.basename(caminho_pdf),
        'caminho': caminho_pdf,
        'valor_pagina1': None,
        'valor_pagina2': None,
        'divergente': None,
        'diferenca': None,
        'erro': None
    }
    
    try:
        with pdfplumber.open(caminho_pdf) as pdf:
            if len(pdf.pages) < 2:
                resultado['erro'] = f"PDF tem apenas {len(pdf.pages)} página(s)"
                return resultado
            
            # Extrair texto das páginas
            texto_p1 = pdf.pages[0].extract_text() or ''
            texto_p2 = pdf.pages[1].extract_text() or ''
            
            # Extrair valores
            resultado['valor_pagina1'] = extrair_valor_pagina1(texto_p1)
            resultado['valor_pagina2'] = extrair_valor_pagina2(texto_p2)
            
            # Verificar se conseguiu extrair
            if resultado['valor_pagina1'] is None:
                resultado['erro'] = "Não foi possível extrair valor da página 1"
            elif resultado['valor_pagina2'] is None:
                resultado['erro'] = "Não foi possível extrair valor da página 2"
            else:
                # Comparar valores (tolerância de R$ 0,01 para arredondamentos)
                diff = abs(resultado['valor_pagina1'] - resultado['valor_pagina2'])
                resultado['diferenca'] = round(diff, 2)
                resultado['divergente'] = diff > 0.01
                
    except Exception as e:
        resultado['erro'] = str(e)
    
    return resultado


def processar_pasta(
    pasta_origem: str,
    pasta_ok: str = None,
    pasta_divergentes: str = None,
    mover_arquivos: bool = True
) -> List[Dict]:
    """
    Processa todos os PDFs de uma pasta e separa em subpastas.
    
    Args:
        pasta_origem: Caminho da pasta com os PDFs
        pasta_ok: Pasta para PDFs com valores iguais (default: pasta_origem/validados_ok)
        pasta_divergentes: Pasta para PDFs divergentes (default: pasta_origem/validados_divergentes)
        mover_arquivos: Se True, move os arquivos; se False, apenas copia
        
    Returns:
        Lista de resultados de validação
    """
    pasta_origem = Path(pasta_origem)
    
    if not pasta_origem.exists():
        raise ValueError(f"Pasta não encontrada: {pasta_origem}")
    
    # Definir pastas de destino
    pasta_ok = Path(pasta_ok) if pasta_ok else pasta_origem / "validados_ok"
    pasta_divergentes = Path(pasta_divergentes) if pasta_divergentes else pasta_origem / "validados_divergentes"
    
    # Criar pastas se não existirem
    pasta_ok.mkdir(exist_ok=True)
    pasta_divergentes.mkdir(exist_ok=True)
    
    # Listar PDFs
    pdfs = list(pasta_origem.glob("*.pdf"))
    
    if not pdfs:
        print(f"⚠ Nenhum PDF encontrado em: {pasta_origem}")
        return []
    
    print(f"📂 Processando {len(pdfs)} PDF(s) em: {pasta_origem}")
    print(f"   ✓ OK: {pasta_ok}")
    print(f"   ✗ Divergentes: {pasta_divergentes}")
    print("-" * 60)
    
    resultados = []
    ok_count = 0
    divergente_count = 0
    erro_count = 0
    
    for pdf_path in pdfs:
        resultado = validar_pdf(str(pdf_path))
        resultados.append(resultado)
        
        # Determinar destino
        if resultado['erro']:
            # Arquivos com erro vão para divergentes
            destino = pasta_divergentes / pdf_path.name
            erro_count += 1
            status = f"❌ ERRO: {resultado['erro']}"
        elif resultado['divergente']:
            destino = pasta_divergentes / pdf_path.name
            divergente_count += 1
            diff = resultado['diferenca']
            v1 = resultado['valor_pagina1']
            v2 = resultado['valor_pagina2']
            status = f"⚠ DIVERGENTE: Pág1=R${v1:.2f} | Pág2=R${v2:.2f} | Diff=R${diff:.2f}"
        else:
            destino = pasta_ok / pdf_path.name
            ok_count += 1
            v = resultado['valor_pagina1']
            status = f"✓ OK: R$ {v:.2f}"
        
        print(f"{pdf_path.name}: {status}")
        
        # Mover ou copiar arquivo
        try:
            if mover_arquivos:
                shutil.move(str(pdf_path), str(destino))
            else:
                shutil.copy2(str(pdf_path), str(destino))
        except Exception as e:
            print(f"   Erro ao mover/copiar: {e}")
    
    # Resumo
    print("-" * 60)
    print(f"📊 RESUMO:")
    print(f"   ✓ OK: {ok_count}")
    print(f"   ⚠ Divergentes: {divergente_count}")
    print(f"   ❌ Erros: {erro_count}")
    print(f"   Total: {len(pdfs)}")
    
    return resultados


def gerar_relatorio(resultados: List[Dict], caminho_saida: str = None) -> str:
    """
    Gera relatório em texto com os resultados da validação.
    """
    linhas = ["=" * 60]
    linhas.append("RELATÓRIO DE VALIDAÇÃO DE VALORES - FATURAS PDF")
    linhas.append("=" * 60)
    linhas.append("")
    
    divergentes = [r for r in resultados if r.get('divergente')]
    erros = [r for r in resultados if r.get('erro')]
    ok = [r for r in resultados if not r.get('divergente') and not r.get('erro')]
    
    if divergentes:
        linhas.append("⚠ DIVERGÊNCIAS ENCONTRADAS:")
        linhas.append("-" * 40)
        for r in divergentes:
            linhas.append(f"  Arquivo: {r['arquivo']}")
            linhas.append(f"    Página 1 (Fatura): R$ {r['valor_pagina1']:.2f}")
            linhas.append(f"    Página 2 (Boleto): R$ {r['valor_pagina2']:.2f}")
            linhas.append(f"    Diferença: R$ {r['diferenca']:.2f}")
            linhas.append("")
    
    if erros:
        linhas.append("❌ ERROS DE PROCESSAMENTO:")
        linhas.append("-" * 40)
        for r in erros:
            linhas.append(f"  {r['arquivo']}: {r['erro']}")
        linhas.append("")
    
    linhas.append("📊 RESUMO:")
    linhas.append(f"   ✓ OK: {len(ok)}")
    linhas.append(f"   ⚠ Divergentes: {len(divergentes)}")
    linhas.append(f"   ❌ Erros: {len(erros)}")
    linhas.append(f"   Total: {len(resultados)}")
    
    texto = "\n".join(linhas)
    
    if caminho_saida:
        with open(caminho_saida, 'w', encoding='utf-8') as f:
            f.write(texto)
        print(f"\n📄 Relatório salvo em: {caminho_saida}")
    
    return texto


# === INTERFACE DE LINHA DE COMANDO ===
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Uso: python pdf_value_validator.py <pasta_com_pdfs>")
        print("")
        print("Exemplo:")
        print("  python pdf_value_validator.py C:\\Faturas\\Novembro")
        print("")
        print("Os PDFs serão separados em:")
        print("  - <pasta>/validados_ok (valores iguais)")
        print("  - <pasta>/validados_divergentes (valores diferentes)")
        sys.exit(1)
    
    pasta = sys.argv[1]
    
    try:
        resultados = processar_pasta(pasta)
        if resultados:
            relatorio = gerar_relatorio(resultados)
            print("\n" + relatorio)
    except Exception as e:
        print(f"❌ Erro: {e}")
        sys.exit(1)
