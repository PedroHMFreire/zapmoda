const mongoose = require('mongoose');

/**
 * Schema da loja
 * Cada loja pertence a um usuário/lojista
 */
const storeSchema = new mongoose.Schema({
  // Dados básicos da loja
  name: {
    type: String,
    required: [true, 'Nome da loja é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Descrição deve ter no máximo 500 caracteres']
  },
  logo: {
    type: String, // URL da imagem
    default: null
  },
  
  // Dados de contato
  phone: {
    type: String,
    required: [true, 'Telefone é obrigatório'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  website: {
    type: String,
    trim: true
  },
  
  // Endereço
  address: {
    street: String,
    number: String,
    complement: String,
    neighborhood: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'Brasil'
    }
  },
  
  // Configurações do WhatsApp
  whatsapp: {
    number: {
      type: String,
      required: [true, 'Número do WhatsApp é obrigatório']
    },
    isConnected: {
      type: Boolean,
      default: false
    },
    sessionId: String,
    qrCode: String,
    lastConnection: Date,
    autoReply: {
      enabled: {
        type: Boolean,
        default: true
      },
      message: {
        type: String,
        default: 'Olá! 👋 Obrigado por entrar em contato. Em breve nossa equipe irá te atender!'
      }
    }
  },
  
  // Configurações da IA
  ai: {
    enabled: {
      type: Boolean,
      default: true
    },
    personality: {
      type: String,
      default: 'Sou um assistente virtual simpático e prestativo. Adoro ajudar nossos clientes a encontrar os produtos perfeitos! 😊'
    },
    tone: {
      type: String,
      enum: ['formal', 'informal', 'amigavel'],
      default: 'amigavel'
    },
    useEmojis: {
      type: Boolean,
      default: true
    },
    responseDelay: {
      type: Number,
      default: 2000, // 2 segundos
      min: 1000,
      max: 10000
    },
    trainingData: {
      mission: String,
      values: String,
      productTypes: [String],
      faq: [{
        question: String,
        answer: String
      }],
      customInstructions: String
    }
  },
  
  // Configurações de horário de funcionamento
  businessHours: {
    enabled: {
      type: Boolean,
      default: false
    },
    timezone: {
      type: String,
      default: 'America/Sao_Paulo'
    },
    schedule: {
      monday: { open: String, close: String, isOpen: Boolean },
      tuesday: { open: String, close: String, isOpen: Boolean },
      wednesday: { open: String, close: String, isOpen: Boolean },
      thursday: { open: String, close: String, isOpen: Boolean },
      friday: { open: String, close: String, isOpen: Boolean },
      saturday: { open: String, close: String, isOpen: Boolean },
      sunday: { open: String, close: String, isOpen: Boolean }
    },
    outsideHoursMessage: {
      type: String,
      default: 'Olá! No momento estamos fora do horário de atendimento. Nosso horário é de segunda a sexta, das 9h às 18h. Deixe sua mensagem que retornaremos assim que possível! 😊'
    }
  },
  
  // Configurações de marketing
  marketing: {
    welcomeMessage: {
      enabled: {
        type: Boolean,
        default: true
      },
      message: {
        type: String,
        default: 'Bem-vindo(a) à nossa loja! 🛍️ Como posso te ajudar hoje?'
      }
    },
    birthdayMessages: {
      enabled: {
        type: Boolean,
        default: false
      },
      message: {
        type: String,
        default: 'Parabéns pelo seu aniversário! 🎉 Que tal comemorar com um desconto especial? Use o cupom ANIVERSARIO10 e ganhe 10% de desconto!'
      }
    },
    abandonedCart: {
      enabled: {
        type: Boolean,
        default: false
      },
      delayHours: {
        type: Number,
        default: 24
      },
      message: {
        type: String,
        default: 'Oi! Vi que você estava interessado(a) em alguns produtos. Que tal finalizar sua compra? Ainda temos tudo separadinho para você! 😊'
      }
    }
  },
  
  // Estatísticas
  stats: {
    totalContacts: {
      type: Number,
      default: 0
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    totalSales: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    }
  },
  
  // Status da loja
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Referência ao proprietário
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
storeSchema.index({ ownerId: 1 });
storeSchema.index({ 'whatsapp.number': 1 });
storeSchema.index({ isActive: 1 });

// Virtual para produtos da loja
storeSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'storeId'
});

// Virtual para contatos da loja
storeSchema.virtual('contacts', {
  ref: 'Contact',
  localField: '_id',
  foreignField: 'storeId'
});

// Método para verificar se a loja está em horário de funcionamento
storeSchema.methods.isOpenNow = function() {
  if (!this.businessHours.enabled) return true;
  
  const now = new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const schedule = this.businessHours.schedule[dayOfWeek];
  
  if (!schedule || !schedule.isOpen) return false;
  
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMinute] = schedule.open.split(':').map(Number);
  const [closeHour, closeMinute] = schedule.close.split(':').map(Number);
  
  const openTime = openHour * 60 + openMinute;
  const closeTime = closeHour * 60 + closeMinute;
  
  return currentTime >= openTime && currentTime <= closeTime;
};

// Método para atualizar estatísticas
storeSchema.methods.updateStats = async function(type, value = 1) {
  const updates = {};
  
  switch (type) {
    case 'contact':
      updates['stats.totalContacts'] = this.stats.totalContacts + value;
      break;
    case 'message':
      updates['stats.totalMessages'] = this.stats.totalMessages + value;
      break;
    case 'sale':
      updates['stats.totalSales'] = this.stats.totalSales + value;
      break;
    case 'responseTime':
      // Calcular média móvel do tempo de resposta
      const currentAvg = this.stats.averageResponseTime || 0;
      const totalMessages = this.stats.totalMessages || 1;
      updates['stats.averageResponseTime'] = ((currentAvg * (totalMessages - 1)) + value) / totalMessages;
      break;
  }
  
  if (Object.keys(updates).length > 0) {
    await this.updateOne(updates);
  }
};

module.exports = mongoose.model('Store', storeSchema);

