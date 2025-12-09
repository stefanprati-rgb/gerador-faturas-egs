# Estrutura da Base de Clientes Externa

## Arquivo: BASE DE CLIENTES - EGS.xlsx

### Aba: base.csv

**Linha do Cabeçalho:** Linha 2 (índice pandas: `header=1`)

### Mapeamento de Colunas

| Tipo de Dado | Nome Exato da Coluna | Status no Sistema |
|--------------|---------------------|-------------------|
| **Identificação** | NOME COMPLETO OU RAZÃO SOCIAL | ✅ Mapeado |
| **Documento** | CNPJ | ✅ Mapeado |
| **Endereço** | ENDEREÇO COMPLETO | ✅ Mapeado |
| **CEP** | CEP | ⚪ Disponível (não usado) |
| **Estado/UF** | UF | ⚪ Disponível (não usado) |
| **Região** | REGIÃO | ⚪ Disponível (não usado) |
| **Contato (Tel)** | TELEFONE | ⚪ Disponível (não usado) |
| **Contato (Email)** | E-MAIL | ⚪ Disponível (não usado) |

### Campos Mapeados no Sistema

O sistema atualmente extrai e utiliza:

1. **NOME COMPLETO OU RAZÃO SOCIAL** → `cliente.nome`
2. **CNPJ** → `cliente.documento`
3. **ENDEREÇO COMPLETO** → `cliente.endereco`

### Campos Disponíveis para Expansão Futura

Caso seja necessário adicionar mais informações nas faturas:

- **CEP** - Pode ser adicionado ao endereço
- **UF** - Pode complementar cidade/estado
- **REGIÃO** - Para análises regionais
- **TELEFONE** - Para contato
- **E-MAIL** - Para envio de faturas

### Como Adicionar Novos Campos

Para mapear campos adicionais, edite o `COLUMNS_MAP` em [processor.py](file:///c:/Projetos/Gerador%20de%20faturas%20EGS/src/python/processor.py#L197):

```python
COLUMNS_MAP = {
    # ... campos existentes ...
    'cep': ["CEP", "Código Postal"],
    'uf': ["UF", "Estado"],
    'telefone': ["TELEFONE", "Tel", "Fone"],
    'email': ["E-MAIL", "Email", "Correio Eletrônico"],
}
```

E adicione na função `criar_mapa_completo_clientes` (L343):

```python
for field in ['nome', 'doc', 'endereco', 'bairro', 'cidade', 'num_conta', 'cep', 'uf', 'telefone', 'email']:
    cols_cli[field] = _mapear_coluna_generic(df_clientes, COLUMNS_MAP[field])
```

## Observações Importantes

- ✅ O sistema prioriza dados do relatório mensal sobre a base externa
- ✅ A base externa serve como fallback quando dados não estão no relatório
- ✅ O campo `ENDEREÇO COMPLETO` já contém o endereço formatado
- ⚠️ Certifique-se de que a coluna `Instalação` ou `UC` existe para fazer o match
