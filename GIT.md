# Guia de Inicialização - Git e GitHub

Este guia explica como inicializar o repositório Git e fazer o primeiro push para o GitHub.

## 📋 Pré-requisitos

- Git instalado: [Download Git](https://git-scm.com/downloads)
- Conta no GitHub: [Criar conta](https://github.com/signup)

## 🚀 Passo a Passo

### 1. Configurar Git (se ainda não configurou)

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@exemplo.com"
```

### 2. Inicializar Repositório Local

```bash
cd "c:\Projetos\Gerador de faturas EGS"
git init
```

### 3. Adicionar Arquivos ao Stage

```bash
git add .
```

### 4. Fazer o Primeiro Commit

```bash
git commit -m "feat: implementação inicial do sistema unificado de faturas EGS

- Estrutura base do projeto com Vite e Tailwind CSS
- Módulo Gerador de Faturas (processamento Excel + geração PDF)
- Módulo Processador de Planilhas (estatísticas + exportação)
- Módulo Corretor de Faturas (edição + recálculo)
- Configuração Firebase Hosting e GitHub Actions
- Documentação completa"
```

### 5. Criar Repositório no GitHub

1. Acesse [GitHub](https://github.com)
2. Clique no **+** no canto superior direito
3. Selecione **New repository**
4. Configure:
   - **Repository name**: `gerador-faturas-egs`
   - **Description**: Sistema unificado de geração, processamento e correção de faturas EGS Energia
   - **Visibility**: Private (recomendado) ou Public
   - **NÃO** marque "Initialize with README" (já temos)
5. Clique em **Create repository**

### 6. Conectar Repositório Local ao GitHub

Copie os comandos mostrados no GitHub ou use:

```bash
git remote add origin https://github.com/SEU_USUARIO/gerador-faturas-egs.git
git branch -M main
git push -u origin main
```

**Substitua** `SEU_USUARIO` pelo seu nome de usuário do GitHub.

### 7. Verificar Push

Atualize a página do repositório no GitHub para ver seus arquivos.

## 📝 Convenções de Commit (PT-BR)

Use commits semânticos em português:

### Tipos de Commit

- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação (sem mudança de lógica)
- `refactor`: Refatoração de código
- `test`: Adição de testes
- `chore`: Tarefas de build, dependências, etc

### Exemplos

```bash
# Nova funcionalidade
git commit -m "feat: adiciona filtro de busca no processador"

# Correção de bug
git commit -m "fix: corrige cálculo de economia no gerador"

# Documentação
git commit -m "docs: atualiza README com instruções de deploy"

# Refatoração
git commit -m "refactor: modulariza componente de upload"

# Configuração
git commit -m "chore: atualiza dependências do projeto"
```

## 🔄 Fluxo de Trabalho Diário

### 1. Verificar Status

```bash
git status
```

### 2. Adicionar Mudanças

```bash
# Adicionar todos os arquivos
git add .

# Ou adicionar arquivos específicos
git add src/modules/gerador/index.js
```

### 3. Fazer Commit

```bash
git commit -m "tipo: descrição clara da mudança"
```

### 4. Enviar para GitHub

```bash
git push origin main
```

## 🌿 Trabalhando com Branches

### Criar Nova Branch

```bash
git checkout -b feature/nova-funcionalidade
```

### Listar Branches

```bash
git branch
```

### Trocar de Branch

```bash
git checkout main
```

### Fazer Merge

```bash
# Voltar para main
git checkout main

# Fazer merge da branch
git merge feature/nova-funcionalidade
```

### Deletar Branch

```bash
git branch -d feature/nova-funcionalidade
```

## 📥 Sincronizar com GitHub

### Baixar Mudanças

```bash
git pull origin main
```

### Ver Histórico

```bash
git log --oneline
```

### Ver Diferenças

```bash
# Ver mudanças não commitadas
git diff

# Ver mudanças de um arquivo específico
git diff src/main.js
```

## ⚠️ Comandos Úteis

### Desfazer Mudanças

```bash
# Desfazer mudanças em um arquivo (antes do add)
git checkout -- arquivo.js

# Remover arquivo do stage (depois do add, antes do commit)
git reset HEAD arquivo.js

# Desfazer último commit (mantém as mudanças)
git reset --soft HEAD~1

# Desfazer último commit (descarta as mudanças) - CUIDADO!
git reset --hard HEAD~1
```

### Ver Remotes

```bash
git remote -v
```

### Atualizar URL do Remote

```bash
git remote set-url origin https://github.com/NOVO_USUARIO/gerador-faturas-egs.git
```

## 🔐 Autenticação

### HTTPS (Recomendado)

Use um **Personal Access Token** em vez de senha:

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Marque: `repo`, `workflow`
4. Copie o token
5. Use o token como senha ao fazer push

### SSH (Alternativa)

```bash
# Gerar chave SSH
ssh-keygen -t ed25519 -C "seu.email@exemplo.com"

# Copiar chave pública
cat ~/.ssh/id_ed25519.pub

# Adicionar no GitHub: Settings → SSH and GPG keys → New SSH key
```

Depois altere o remote para SSH:

```bash
git remote set-url origin git@github.com:SEU_USUARIO/gerador-faturas-egs.git
```

## 📚 Recursos

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Criado em**: 02/12/2025
