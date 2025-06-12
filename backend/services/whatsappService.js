const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const AIService = require('./aiService');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Product = require('../models/Product');
const Store = require('../models/Store');

class WhatsAppService {
  constructor() {
    this.clients = new Map(); // Armazena clientes por storeId
    this.qrCodes = new Map(); // Armazena QR codes temporários
  }

  /**
   * Inicializa cliente WhatsApp para uma loja
   */
  async initializeClient(storeId) {
    try {
      // Se já existe um cliente, desconecta primeiro
      if (this.clients.has(storeId)) {
        await this.disconnectClient(storeId);
      }

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: `store_${storeId}`
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });

      // Event listeners
      client.on('qr', async (qr) => {
        console.log(`QR Code gerado para loja ${storeId}`);
        const qrCodeDataURL = await qrcode.toDataURL(qr);
        this.qrCodes.set(storeId, qrCodeDataURL);
      });

      client.on('ready', async () => {
        console.log(`Cliente WhatsApp pronto para loja ${storeId}`);
        this.qrCodes.delete(storeId);
        
        // Atualizar status da loja
        await Store.findByIdAndUpdate(storeId, {
          'whatsappConfig.connected': true,
          'whatsappConfig.connectedAt': new Date()
        });
      });

      client.on('disconnected', async (reason) => {
        console.log(`Cliente desconectado para loja ${storeId}:`, reason);
        this.clients.delete(storeId);
        
        // Atualizar status da loja
        await Store.findByIdAndUpdate(storeId, {
          'whatsappConfig.connected': false,
          'whatsappConfig.disconnectedAt': new Date()
        });
      });

      client.on('message', async (message) => {
        await this.handleIncomingMessage(storeId, message);
      });

      // Armazenar cliente
      this.clients.set(storeId, client);

      // Inicializar cliente
      await client.initialize();

      // Aguardar QR code ser gerado
      await new Promise((resolve) => {
        const checkQR = setInterval(() => {
          if (this.qrCodes.has(storeId)) {
            clearInterval(checkQR);
            resolve();
          }
        }, 1000);
        
        // Timeout após 30 segundos
        setTimeout(() => {
          clearInterval(checkQR);
          resolve();
        }, 30000);
      });

      return this.qrCodes.get(storeId);
    } catch (error) {
      console.error('Erro ao inicializar cliente WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Processa mensagem recebida
   */
  async handleIncomingMessage(storeId, message) {
    try {
      const store = await Store.findById(storeId);
      if (!store) return;

      const phoneNumber = message.from.replace('@c.us', '');
      const messageText = message.body;
      const isGroup = message.from.includes('@g.us');
      
      // Ignorar mensagens de grupo se não configurado
      if (isGroup && !store.whatsappConfig.respondToGroups) {
        return;
      }

      // Buscar ou criar contato
      let contact = await Contact.findOne({ 
        store: storeId, 
        phone: phoneNumber 
      });

      if (!contact) {
        const contactInfo = await message.getContact();
        contact = new Contact({
          store: storeId,
          name: contactInfo.pushname || contactInfo.name || phoneNumber,
          phone: phoneNumber,
          lastInteraction: new Date()
        });
        await contact.save();
      } else {
        contact.lastInteraction = new Date();
        await contact.save();
      }

      // Salvar mensagem
      const messageRecord = new Message({
        store: storeId,
        contact: contact._id,
        phoneNumber,
        content: messageText,
        type: message.type,
        direction: 'incoming',
        whatsappId: message.id.id,
        timestamp: new Date(message.timestamp * 1000)
      });

      // Processar áudio se for mensagem de voz
      if (message.type === 'ptt' || message.type === 'audio') {
        try {
          const audioText = await this.processAudioMessage(message);
          messageRecord.audioTranscription = audioText;
          messageRecord.content = audioText; // Usar transcrição como conteúdo
        } catch (error) {
          console.error('Erro ao processar áudio:', error);
        }
      }

      await messageRecord.save();

      // Verificar se está no horário de funcionamento
      const isBusinessHours = this.isBusinessHours(store.whatsappConfig.businessHours);
      
      if (!isBusinessHours && store.whatsappConfig.awayMessage) {
        await this.sendMessage(storeId, phoneNumber, store.whatsappConfig.awayMessage);
        return;
      }

      // Gerar resposta com IA
      const response = await AIService.generateResponse({
        storeId,
        contactId: contact._id,
        message: messageRecord.content,
        messageHistory: await this.getRecentMessages(storeId, contact._id),
        storeConfig: store.aiConfig
      });

      if (response.text) {
        await this.sendMessage(storeId, phoneNumber, response.text);
      }

      // Enviar produtos se recomendados
      if (response.recommendedProducts && response.recommendedProducts.length > 0) {
        await this.sendProductCatalog(storeId, phoneNumber, response.recommendedProducts);
      }

      // Executar ações especiais
      if (response.actions) {
        await this.executeActions(storeId, contact._id, response.actions);
      }

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  }

  /**
   * Envia mensagem
   */
  async sendMessage(storeId, phoneNumber, text, mediaUrl = null) {
    try {
      const client = this.clients.get(storeId);
      if (!client) {
        throw new Error('Cliente WhatsApp não encontrado');
      }

      const chatId = `${phoneNumber}@c.us`;
      let sentMessage;

      if (mediaUrl) {
        const media = await MessageMedia.fromUrl(mediaUrl);
        sentMessage = await client.sendMessage(chatId, media, { caption: text });
      } else {
        sentMessage = await client.sendMessage(chatId, text);
      }

      // Salvar mensagem enviada
      const contact = await Contact.findOne({ 
        store: storeId, 
        phone: phoneNumber 
      });

      if (contact) {
        const messageRecord = new Message({
          store: storeId,
          contact: contact._id,
          phoneNumber,
          content: text,
          type: mediaUrl ? 'media' : 'text',
          direction: 'outgoing',
          whatsappId: sentMessage.id.id,
          mediaUrl,
          timestamp: new Date()
        });
        await messageRecord.save();
      }

      return sentMessage;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  /**
   * Envia catálogo de produtos
   */
  async sendProductCatalog(storeId, phoneNumber, productIds) {
    try {
      const products = await Product.find({
        _id: { $in: productIds },
        store: storeId,
        status: 'active'
      }).limit(5);

      if (products.length === 0) return;

      let catalogText = '🛍️ *Produtos que podem te interessar:*\n\n';

      for (const product of products) {
        catalogText += `📦 *${product.name}*\n`;
        catalogText += `💰 R$ ${product.price.toFixed(2)}\n`;
        if (product.description) {
          catalogText += `📝 ${product.description.substring(0, 100)}...\n`;
        }
        catalogText += `🔗 Ver mais: ${process.env.FRONTEND_URL}/produto/${product._id}\n\n`;
      }

      catalogText += '💬 Digite *"quero"* seguido do nome do produto para mais informações!';

      await this.sendMessage(storeId, phoneNumber, catalogText);

      // Enviar imagens dos produtos se disponíveis
      for (const product of products) {
        if (product.images && product.images.length > 0) {
          const imageUrl = `${process.env.API_URL}${product.images[0].url}`;
          await this.sendMessage(storeId, phoneNumber, `*${product.name}*`, imageUrl);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar catálogo:', error);
    }
  }

  /**
   * Processa mensagem de áudio
   */
  async processAudioMessage(message) {
    try {
      // Aqui você integraria com um serviço de speech-to-text
      // Por exemplo: Google Speech-to-Text, Azure Speech, etc.
      
      // Simulação de transcrição
      return "Transcrição do áudio não implementada ainda";
    } catch (error) {
      console.error('Erro ao processar áudio:', error);
      return null;
    }
  }

  /**
   * Verifica se está no horário de funcionamento
   */
  isBusinessHours(businessHours) {
    if (!businessHours || !businessHours.enabled) return true;

    const now = new Date();
    const currentDay = now.getDay(); // 0 = domingo, 1 = segunda, etc.
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const daySchedule = businessHours.schedule[currentDay];
    if (!daySchedule || !daySchedule.open) return false;

    const openTime = this.timeToMinutes(daySchedule.start);
    const closeTime = this.timeToMinutes(daySchedule.end);

    return currentTime >= openTime && currentTime <= closeTime;
  }

  /**
   * Converte horário para minutos
   */
  timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Obtém mensagens recentes para contexto
   */
  async getRecentMessages(storeId, contactId, limit = 10) {
    try {
      const messages = await Message.find({
        store: storeId,
        contact: contactId
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('content direction timestamp');

      return messages.reverse(); // Ordem cronológica
    } catch (error) {
      console.error('Erro ao obter mensagens recentes:', error);
      return [];
    }
  }

  /**
   * Executa ações especiais
   */
  async executeActions(storeId, contactId, actions) {
    try {
      for (const action of actions) {
        switch (action.type) {
          case 'add_to_wishlist':
            await this.addToWishlist(contactId, action.productId);
            break;
          case 'send_coupon':
            await this.sendCoupon(storeId, contactId, action.couponCode);
            break;
          case 'schedule_followup':
            await this.scheduleFollowup(storeId, contactId, action.delay, action.message);
            break;
        }
      }
    } catch (error) {
      console.error('Erro ao executar ações:', error);
    }
  }

  /**
   * Adiciona produto à lista de desejos
   */
  async addToWishlist(contactId, productId) {
    try {
      await Contact.findByIdAndUpdate(contactId, {
        $addToSet: { wishlist: productId }
      });
    } catch (error) {
      console.error('Erro ao adicionar à wishlist:', error);
    }
  }

  /**
   * Envia cupom de desconto
   */
  async sendCoupon(storeId, contactId, couponCode) {
    try {
      const contact = await Contact.findById(contactId);
      if (!contact) return;

      const couponMessage = `🎉 *Parabéns!* Você ganhou um cupom de desconto!\n\n` +
                           `🏷️ Código: *${couponCode}*\n` +
                           `💰 Use na sua próxima compra e economize!\n\n` +
                           `⏰ Válido por tempo limitado. Não perca!`;

      await this.sendMessage(storeId, contact.phone, couponMessage);
    } catch (error) {
      console.error('Erro ao enviar cupom:', error);
    }
  }

  /**
   * Agenda follow-up
   */
  async scheduleFollowup(storeId, contactId, delay, message) {
    try {
      // Implementar sistema de agendamento
      // Por exemplo, usando node-cron ou agenda.js
      console.log(`Follow-up agendado para ${delay}ms: ${message}`);
    } catch (error) {
      console.error('Erro ao agendar follow-up:', error);
    }
  }

  /**
   * Desconecta cliente
   */
  async disconnectClient(storeId) {
    try {
      const client = this.clients.get(storeId);
      if (client) {
        await client.destroy();
        this.clients.delete(storeId);
      }
      this.qrCodes.delete(storeId);
    } catch (error) {
      console.error('Erro ao desconectar cliente:', error);
    }
  }

  /**
   * Obtém status da conexão
   */
  async getConnectionStatus(storeId) {
    try {
      const client = this.clients.get(storeId);
      if (!client) return 'disconnected';

      const state = await client.getState();
      return state;
    } catch (error) {
      console.error('Erro ao obter status:', error);
      return 'error';
    }
  }

  /**
   * Processa mensagem de webhook (para APIs externas)
   */
  async processIncomingMessage(storeId, messageData) {
    try {
      // Implementar processamento de webhook
      // Para APIs como Z-API, Twilio, etc.
      console.log('Processando webhook:', messageData);
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
    }
  }
}

module.exports = new WhatsAppService();

