const axios = require('axios');
const Product = require('../models/Product');
const Contact = require('../models/Contact');
const Store = require('../models/Store');

class AIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || 'sua-chave-aqui';
    this.baseURL = 'https://api.openai.com/v1';
  }

  /**
   * Gera resposta personalizada baseada no contexto
   */
  async generateResponse(context) {
    try {
      const {
        storeId,
        contactId,
        message,
        messageHistory,
        storeConfig
      } = context;

      // Buscar informações da loja e contato
      const store = await Store.findById(storeId);
      const contact = await Contact.findById(contactId);

      if (!store || !contact) {
        throw new Error('Loja ou contato não encontrado');
      }

      // Construir prompt personalizado
      const prompt = await this.buildPrompt({
        store,
        contact,
        message,
        messageHistory,
        storeConfig
      });

      // Chamar API de IA (simulação - substitua pela API real)
      const response = await this.callAIAPI(prompt);

      // Processar resposta
      const processedResponse = await this.processAIResponse(response, storeId, contactId);

      return processedResponse;
    } catch (error) {
      console.error('Erro ao gerar resposta:', error);
      return this.getFallbackResponse(context.storeConfig);
    }
  }

  /**
   * Constrói prompt personalizado para a IA
   */
  async buildPrompt({ store, contact, message, messageHistory, storeConfig }) {
    const storeInfo = `
Você é um assistente virtual da loja "${store.name}".

INFORMAÇÕES DA LOJA:
- Nome: ${store.name}
- Descrição: ${store.description || 'Loja de moda'}
- Estilo de comunicação: ${storeConfig.communicationStyle || 'amigável e informal'}
- Tom de voz: ${storeConfig.toneOfVoice || 'simpático e acolhedor'}
- Emojis permitidos: ${storeConfig.useEmojis ? 'sim' : 'não'}

INFORMAÇÕES DO CLIENTE:
- Nome: ${contact.name}
- Segmento: ${contact.segment}
- Última interação: ${contact.lastInteraction}
- Preferências: ${JSON.stringify(contact.preferences)}

HISTÓRICO DE CONVERSA:
${messageHistory.map(msg => `${msg.direction === 'incoming' ? 'Cliente' : 'Assistente'}: ${msg.content}`).join('\n')}

MENSAGEM ATUAL DO CLIENTE:
${message}

INSTRUÇÕES:
1. Responda de forma ${storeConfig.communicationStyle || 'amigável'}
2. Use o tom ${storeConfig.toneOfVoice || 'simpático'}
3. ${storeConfig.useEmojis ? 'Use emojis apropriados' : 'Não use emojis'}
4. Seja útil e tente vender produtos quando apropriado
5. Se o cliente perguntar sobre produtos, ofereça opções
6. Mantenha respostas concisas (máximo 200 caracteres)
7. Se não souber algo, seja honesto e ofereça ajuda humana

PRODUTOS DISPONÍVEIS:
`;

    // Adicionar produtos relevantes ao prompt
    const relevantProducts = await this.findRelevantProducts(store._id, message);
    const productsInfo = relevantProducts.map(p => 
      `- ${p.name}: R$ ${p.price} (${p.category})`
    ).join('\n');

    return prompt + productsInfo + '\n\nResposta:';
  }

  /**
   * Encontra produtos relevantes baseado na mensagem
   */
  async findRelevantProducts(storeId, message, limit = 5) {
    try {
      const keywords = this.extractKeywords(message);
      
      const query = {
        store: storeId,
        status: 'active',
        stock: { $gt: 0 }
      };

      if (keywords.length > 0) {
        query.$or = [
          { name: { $regex: keywords.join('|'), $options: 'i' } },
          { description: { $regex: keywords.join('|'), $options: 'i' } },
          { category: { $regex: keywords.join('|'), $options: 'i' } },
          { tags: { $in: keywords.map(k => new RegExp(k, 'i')) } }
        ];
      }

      const products = await Product.find(query)
        .select('name price category description images')
        .limit(limit)
        .sort({ createdAt: -1 });

      return products;
    } catch (error) {
      console.error('Erro ao buscar produtos relevantes:', error);
      return [];
    }
  }

  /**
   * Extrai palavras-chave da mensagem
   */
  extractKeywords(message) {
    const stopWords = ['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'para', 'com', 'em', 'por', 'que', 'não', 'é', 'eu', 'você', 'ele', 'ela'];
    
    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
  }

  /**
   * Chama API de IA (simulação)
   */
  async callAIAPI(prompt) {
    try {
      // Simulação de resposta da IA
      // Em produção, substitua pela chamada real para OpenAI, Claude, etc.
      
      const responses = [
        {
          text: "Oi! 😊 Como posso te ajudar hoje? Temos várias novidades incríveis!",
          intent: "greeting",
          confidence: 0.9
        },
        {
          text: "Que legal! Temos várias opções que podem te interessar. Quer ver algumas sugestões?",
          intent: "product_interest",
          confidence: 0.8,
          recommendProducts: true
        },
        {
          text: "Claro! Vou te mostrar nossos produtos mais vendidos. Qual seu estilo preferido?",
          intent: "catalog_request",
          confidence: 0.85,
          recommendProducts: true
        }
      ];

      // Simular análise de intenção baseada na mensagem
      const message = prompt.split('MENSAGEM ATUAL DO CLIENTE:')[1]?.split('INSTRUÇÕES:')[0]?.trim().toLowerCase();
      
      if (message?.includes('oi') || message?.includes('olá') || message?.includes('bom dia')) {
        return responses[0];
      } else if (message?.includes('produto') || message?.includes('roupa') || message?.includes('vestido')) {
        return responses[1];
      } else {
        return responses[2];
      }
    } catch (error) {
      console.error('Erro na API de IA:', error);
      throw error;
    }
  }

  /**
   * Processa resposta da IA
   */
  async processAIResponse(aiResponse, storeId, contactId) {
    try {
      const response = {
        text: aiResponse.text,
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        actions: []
      };

      // Se deve recomendar produtos
      if (aiResponse.recommendProducts) {
        const contact = await Contact.findById(contactId);
        const products = await this.getRecommendedProducts(storeId, contact);
        response.recommendedProducts = products.map(p => p._id);
      }

      // Analisar intenções e adicionar ações
      if (aiResponse.intent === 'product_interest') {
        response.actions.push({
          type: 'track_interest',
          category: 'product_inquiry'
        });
      }

      // Verificar se deve enviar cupom
      if (this.shouldSendCoupon(aiResponse, contactId)) {
        const couponCode = this.generateCouponCode();
        response.actions.push({
          type: 'send_coupon',
          couponCode
        });
      }

      return response;
    } catch (error) {
      console.error('Erro ao processar resposta da IA:', error);
      return { text: aiResponse.text };
    }
  }

  /**
   * Obtém produtos recomendados para o contato
   */
  async getRecommendedProducts(storeId, contact) {
    try {
      const query = {
        store: storeId,
        status: 'active',
        stock: { $gt: 0 }
      };

      // Filtrar por preferências do contato
      if (contact.preferences.categories) {
        query.category = { $in: contact.preferences.categories };
      }

      if (contact.preferences.priceRange) {
        query.price = {
          $gte: contact.preferences.priceRange.min || 0,
          $lte: contact.preferences.priceRange.max || 999999
        };
      }

      const products = await Product.find(query)
        .limit(3)
        .sort({ createdAt: -1 });

      return products;
    } catch (error) {
      console.error('Erro ao obter produtos recomendados:', error);
      return [];
    }
  }

  /**
   * Verifica se deve enviar cupom
   */
  shouldSendCoupon(aiResponse, contactId) {
    // Lógica para determinar quando enviar cupom
    // Por exemplo: primeira compra, aniversário, etc.
    return Math.random() < 0.1; // 10% de chance (exemplo)
  }

  /**
   * Gera código de cupom
   */
  generateCouponCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Resposta de fallback em caso de erro
   */
  getFallbackResponse(storeConfig) {
    const fallbacks = [
      "Desculpe, não entendi bem. Pode repetir?",
      "Estou aqui para te ajudar! Como posso te auxiliar?",
      "Oi! Em que posso te ajudar hoje?",
      "Olá! Estou à disposição para te atender."
    ];

    return {
      text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
      intent: 'fallback',
      confidence: 0.5
    };
  }

  /**
   * Treina IA com dados da loja
   */
  async trainWithStoreData(storeId, trainingData) {
    try {
      // Implementar treinamento personalizado
      // Salvar dados de treinamento no banco
      const store = await Store.findById(storeId);
      if (!store) throw new Error('Loja não encontrada');

      store.aiConfig.trainingData = {
        ...store.aiConfig.trainingData,
        ...trainingData,
        lastTrained: new Date()
      };

      await store.save();

      return {
        success: true,
        message: 'IA treinada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao treinar IA:', error);
      throw error;
    }
  }

  /**
   * Analisa sentimento da mensagem
   */
  async analyzeSentiment(message) {
    try {
      // Implementar análise de sentimento
      // Pode usar APIs como Google Cloud Natural Language, Azure Text Analytics, etc.
      
      // Simulação simples
      const positiveWords = ['bom', 'ótimo', 'excelente', 'adorei', 'perfeito', 'maravilhoso'];
      const negativeWords = ['ruim', 'péssimo', 'horrível', 'odeio', 'terrível', 'decepcionado'];
      
      const lowerMessage = message.toLowerCase();
      
      const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;
      const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;
      
      if (positiveCount > negativeCount) {
        return { sentiment: 'positive', score: 0.7 };
      } else if (negativeCount > positiveCount) {
        return { sentiment: 'negative', score: 0.7 };
      } else {
        return { sentiment: 'neutral', score: 0.5 };
      }
    } catch (error) {
      console.error('Erro na análise de sentimento:', error);
      return { sentiment: 'neutral', score: 0.5 };
    }
  }

  /**
   * Detecta intenção da mensagem
   */
  async detectIntent(message) {
    try {
      const intents = {
        greeting: ['oi', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'hey'],
        product_inquiry: ['produto', 'roupa', 'vestido', 'blusa', 'calça', 'saia'],
        price_inquiry: ['preço', 'valor', 'custa', 'quanto'],
        availability: ['tem', 'disponível', 'estoque', 'tamanho'],
        complaint: ['problema', 'reclamação', 'defeito', 'ruim'],
        compliment: ['ótimo', 'excelente', 'adorei', 'perfeito'],
        goodbye: ['tchau', 'até logo', 'obrigado', 'valeu']
      };

      const lowerMessage = message.toLowerCase();
      
      for (const [intent, keywords] of Object.entries(intents)) {
        for (const keyword of keywords) {
          if (lowerMessage.includes(keyword)) {
            return { intent, confidence: 0.8 };
          }
        }
      }

      return { intent: 'unknown', confidence: 0.3 };
    } catch (error) {
      console.error('Erro na detecção de intenção:', error);
      return { intent: 'unknown', confidence: 0.1 };
    }
  }
}

module.exports = new AIService();

