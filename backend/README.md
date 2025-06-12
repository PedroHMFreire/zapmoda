# WhatsApp AI System - Backend

Sistema backend para agente de inteligência artificial humanizado para atendimento via WhatsApp, voltado para pequenos comércios de moda.

## 🚀 Funcionalidades

### 🤖 Inteligência Artificial
- Atendimento humanizado com linguagem personalizada
- Processamento de mensagens de voz (áudio → texto)
- Análise de sentimento e intenções
- Respostas automáticas contextualizadas
- Treinamento personalizado por loja

### 📱 WhatsApp Integration
- Conexão via WhatsApp Web
- Envio e recebimento de mensagens
- Suporte a mídias (imagens, áudios, vídeos)
- Status de entrega e leitura
- QR Code para conexão

### 🛍️ E-commerce Features
- Catálogo de produtos interativo
- Filtros inteligentes (tamanho, cor, preço)
- Lista de desejos com alertas
- Carrinho abandonado
- Cupons de desconto automáticos
- Notificações de estoque

### 📊 Analytics & Reports
- Histórico completo de conversas
- Métricas de atendimento
- Taxa de conversão
- Tempo de resposta
- Relatórios de vendas

### 🔐 Segurança
- Autenticação JWT
- Hash de senhas com bcrypt
- Middleware de segurança
- Validação de dados
- Rate limiting

## 🛠️ Tecnologias

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **MongoDB** - Banco de dados NoSQL
- **Mongoose** - ODM para MongoDB
- **Socket.IO** - Comunicação em tempo real
- **WhatsApp Web.js** - Integração com WhatsApp
- **JWT** - Autenticação
- **Bcrypt** - Hash de senhas
- **Multer** - Upload de arquivos
- **Axios** - Cliente HTTP
- **Node-cron** - Agendamento de tarefas

## 📁 Estrutura do Projeto

```
backend/
├── controllers/          # Controladores da aplicação
├── middleware/           # Middlewares customizados
├── models/              # Modelos do MongoDB
├── routes/              # Rotas da API
├── services/            # Serviços (WhatsApp, IA)
├── utils/               # Utilitários
├── uploads/             # Arquivos enviados
├── sessions/            # Sessões do WhatsApp
├── .env                 # Variáveis de ambiente
├── server.js            # Arquivo principal
└── package.json         # Dependências
```

## 🚀 Instalação

1. **Clone o repositório**
```bash
git clone <repository-url>
cd whatsapp-ai-system/backend
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. **Inicie o MongoDB**
```bash
# Local
mongod

# Ou use MongoDB Atlas (cloud)
```

5. **Execute o servidor**
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## ⚙️ Configuração

### Variáveis de Ambiente

```env
# Servidor
PORT=3001
NODE_ENV=development

# Banco de dados
MONGODB_URI=mongodb://localhost:27017/whatsapp-ai-system

# JWT
JWT_SECRET=sua_chave_secreta_super_segura
JWT_EXPIRES_IN=7d

# WhatsApp
WHATSAPP_SESSION_NAME=whatsapp-ai-session

# OpenAI (opcional)
OPENAI_API_KEY=sua_chave_da_openai

# Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app
```

## 📚 API Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar usuário
- `POST /api/auth/login` - Fazer login
- `GET /api/auth/me` - Dados do usuário logado
- `POST /api/auth/forgot-password` - Recuperar senha
- `POST /api/auth/reset-password` - Redefinir senha

### Loja
- `GET /api/store` - Dados da loja
- `PUT /api/store` - Atualizar loja
- `PUT /api/store/whatsapp` - Configurar WhatsApp
- `PUT /api/store/ai` - Configurar IA

### Produtos
- `GET /api/products` - Listar produtos
- `POST /api/products` - Criar produto
- `GET /api/products/:id` - Obter produto
- `PUT /api/products/:id` - Atualizar produto
- `DELETE /api/products/:id` - Excluir produto

### Contatos
- `GET /api/contacts` - Listar contatos
- `POST /api/contacts` - Criar contato
- `GET /api/contacts/:id` - Obter contato
- `PUT /api/contacts/:id` - Atualizar contato

### Mensagens
- `GET /api/messages` - Listar mensagens
- `POST /api/messages` - Enviar mensagem
- `GET /api/messages/conversation/:contactId` - Conversa

### WhatsApp
- `POST /api/whatsapp/connect` - Conectar WhatsApp
- `POST /api/whatsapp/disconnect` - Desconectar
- `GET /api/whatsapp/status` - Status da conexão
- `GET /api/whatsapp/qr` - Obter QR Code

### Relatórios
- `GET /api/reports/dashboard` - Dashboard
- `GET /api/reports/messages` - Relatório de mensagens
- `GET /api/reports/sales` - Relatório de vendas

## 🔄 Socket.IO Events

### Cliente → Servidor
- `join-store` - Entrar na sala da loja

### Servidor → Cliente
- `whatsapp-qr` - QR Code gerado
- `whatsapp-connected` - WhatsApp conectado
- `whatsapp-disconnected` - WhatsApp desconectado
- `new-message` - Nova mensagem recebida
- `message-sent` - Mensagem enviada
- `message-status-update` - Status da mensagem atualizado

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar testes em modo watch
npm run test:watch

# Cobertura de testes
npm run test:coverage
```

## 📦 Deploy

### Render.com

1. **Conecte seu repositório GitHub**
2. **Configure as variáveis de ambiente**
3. **Deploy automático a cada push**

### Configurações de Deploy
```yaml
# render.yaml
services:
  - type: web
    name: whatsapp-ai-backend
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        fromDatabase:
          name: whatsapp-ai-db
          property: connectionString
```

## 🔧 Desenvolvimento

### Scripts Disponíveis
```bash
npm run dev      # Servidor em modo desenvolvimento
npm run start    # Servidor em modo produção
npm run lint     # Verificar código
npm run seed     # Popular banco com dados de teste
```

### Estrutura de Commits
```
feat: nova funcionalidade
fix: correção de bug
docs: documentação
style: formatação
refactor: refatoração
test: testes
chore: tarefas de manutenção
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte, envie um email para suporte@whatsappai.com ou abra uma issue no GitHub.

---

Desenvolvido com ❤️ para pequenos comércios de moda

