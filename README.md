# Gerador de Faturas EGS

Sistema unificado de geração, processamento e correção de faturas para EGS Energia.

## 🚀 Funcionalidades

- **Gerador de Faturas**: Gere faturas em PDF a partir de planilhas Excel
- **Processador**: Processe e valide dados de planilhas
- **Corretor**: Edite e recalcule faturas já processadas

## 📋 Pré-requisitos

- Node.js 18+ instalado
- npm ou yarn

## 🛠️ Instalação

```bash
# Instalar dependências
npm install
```

## 💻 Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
npm run dev
```

O servidor estará disponível em `http://localhost:3000`

## 🏗️ Build

```bash
# Gerar build de produção
npm run build
```

Os arquivos serão gerados na pasta `dist/`

## 📦 Deploy

O projeto está configurado para deploy automático no Firebase via GitHub Actions.

### Configuração do Firebase

1. Instale o Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Faça login no Firebase:
```bash
firebase login
```

3. Inicialize o projeto:
```bash
firebase init hosting
```

4. Configure o GitHub Actions com os secrets:
   - `FIREBASE_SERVICE_ACCOUNT`: Conta de serviço do Firebase

### Deploy Manual

```bash
# Build e deploy
npm run build
firebase deploy
```

## 📦 Deploy

O projeto está configurado para deploy automático no Firebase via GitHub Actions.

### Deploy Automático

Cada push na branch `main` aciona automaticamente:
1. Build do projeto
2. Deploy no Firebase Hosting

### Deploy Manual

```bash
# Build
npm run build

# Deploy
firebase deploy --only hosting
```

**Guia completo**: Veja [DEPLOY.md](./DEPLOY.md) para instruções detalhadas de configuração.

## 📁 Estrutura do Projeto

```
gerador-faturas-egs/
├── src/
│   ├── components/      # Componentes reutilizáveis
│   ├── modules/         # Módulos de funcionalidade
│   ├── core/            # Lógica de negócio
│   ├── utils/           # Utilitários
│   ├── styles/          # Estilos CSS
│   ├── router.js        # Sistema de rotas
│   └── main.js          # Ponto de entrada
├── public/              # Arquivos estáticos
├── index.html           # HTML principal
└── vite.config.js       # Configuração do Vite
```

## 🎨 Tecnologias

- **Vite**: Build tool
- **Tailwind CSS**: Framework CSS
- **Pyodide**: Python no navegador
- **html2pdf.js**: Geração de PDFs
- **JSZip**: Compactação de arquivos

## 📝 Convenções de Commit

Use commits em português brasileiro seguindo o padrão:

```
feat: adiciona nova funcionalidade
fix: corrige bug
docs: atualiza documentação
style: formata código
refactor: refatora código
test: adiciona testes
chore: atualiza dependências
```

## 📞 Contato

- **Email**: atendimento@egsenergia.com.br
- **WhatsApp**: (11) 99670-3826

## 📄 Licença

ISC © 2025 EGS Energia
