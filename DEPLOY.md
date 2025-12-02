# Guia de Deploy - Firebase Hosting + GitHub Actions

Este guia explica como configurar o deploy automático do projeto no Firebase Hosting usando GitHub Actions.

## 📋 Pré-requisitos

- Conta no [Firebase](https://firebase.google.com/)
- Conta no [GitHub](https://github.com/)
- Firebase CLI instalado globalmente: `npm install -g firebase-tools`
- Git instalado e configurado

## 🔧 Configuração do Firebase

### 1. Criar Projeto no Firebase

1. Acesse o [Console do Firebase](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Nome do projeto: `gerador-faturas-egs` (ou outro nome de sua preferência)
4. Siga os passos de criação do projeto

### 2. Fazer Login no Firebase CLI

```bash
firebase login
```

Isso abrirá seu navegador para autenticação.

### 3. Inicializar Firebase no Projeto

```bash
cd "c:\Projetos\Gerador de faturas EGS"
firebase init hosting
```

**Respostas sugeridas:**
- Use an existing project: **Sim**
- Select a project: **gerador-faturas-egs** (ou o nome que você escolheu)
- Public directory: **dist**
- Configure as SPA: **Sim**
- Set up automatic builds with GitHub: **Não** (faremos manualmente)
- Overwrite index.html: **Não**

### 4. Gerar Service Account Key

1. Acesse [Console do Firebase](https://console.firebase.google.com/)
2. Vá em **Configurações do Projeto** (ícone de engrenagem)
3. Aba **Contas de serviço**
4. Clique em **Gerar nova chave privada**
5. Salve o arquivo JSON gerado

## 🔐 Configuração do GitHub

### 1. Criar Repositório no GitHub

Se ainda não tiver um repositório:

```bash
git init
git add .
git commit -m "feat: implementação inicial do projeto unificado"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/gerador-faturas-egs.git
git push -u origin main
```

### 2. Adicionar Secret no GitHub

1. Acesse seu repositório no GitHub
2. Vá em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **New repository secret**
4. Nome: `FIREBASE_SERVICE_ACCOUNT`
5. Valor: Cole todo o conteúdo do arquivo JSON da service account
6. Clique em **Add secret**

## 🚀 Deploy

### Deploy Manual (Primeira Vez)

```bash
# Build do projeto
npm run build

# Deploy no Firebase
firebase deploy --only hosting
```

### Deploy Automático (GitHub Actions)

Após configurar os secrets, o deploy será automático:

1. Faça commit das suas alterações:
```bash
git add .
git commit -m "feat: adiciona nova funcionalidade"
git push origin main
```

2. O GitHub Actions será acionado automaticamente
3. Acompanhe o progresso em **Actions** no GitHub
4. Após conclusão, seu site estará atualizado no Firebase

## 🌐 Acessar o Site

Após o primeiro deploy, você receberá uma URL como:

```
https://gerador-faturas-egs.web.app
```

ou

```
https://gerador-faturas-egs.firebaseapp.com
```

## 📝 Comandos Úteis

```bash
# Ver logs do Firebase
firebase hosting:channel:list

# Deploy em canal de preview
firebase hosting:channel:deploy preview

# Ver informações do projeto
firebase projects:list

# Logout do Firebase
firebase logout
```

## 🔄 Fluxo de Trabalho

1. **Desenvolvimento Local**
   ```bash
   npm run dev
   ```

2. **Testar Build**
   ```bash
   npm run build
   npm run preview
   ```

3. **Commit e Push**
   ```bash
   git add .
   git commit -m "tipo: descrição da mudança"
   git push origin main
   ```

4. **Deploy Automático**
   - GitHub Actions detecta o push
   - Executa build
   - Faz deploy no Firebase
   - Site atualizado automaticamente

## ⚠️ Troubleshooting

### Erro: "Project not found"
- Verifique se o `projectId` em `firebase.json` está correto
- Confirme que você tem permissões no projeto Firebase

### Erro: "Service account invalid"
- Verifique se o secret `FIREBASE_SERVICE_ACCOUNT` foi configurado corretamente
- Certifique-se de que copiou todo o conteúdo do JSON

### Build falha no GitHub Actions
- Verifique os logs em **Actions** no GitHub
- Certifique-se de que todas as dependências estão no `package.json`
- Teste o build localmente: `npm run build`

## 🎯 Boas Práticas

1. **Sempre teste localmente antes de fazer push**
2. **Use commits semânticos** (feat, fix, docs, etc)
3. **Revise os logs do GitHub Actions** após cada deploy
4. **Mantenha os secrets seguros** - nunca commite credenciais

## 📚 Recursos

- [Documentação Firebase Hosting](https://firebase.google.com/docs/hosting)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)

---

**Criado em**: 02/12/2025
