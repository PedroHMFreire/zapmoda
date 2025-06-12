const mongoose = require('mongoose');

/**
 * Schema da mensagem
 * Cada mensagem pertence a uma conversa entre a loja e um contato
 */
const messageSchema = new mongoose.Schema({
  // Identificação da conversa
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  
  // Dados básicos da mensagem
  content: {
    text: String,
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'interactive'],
      default: 'text'
    },
    mediaUrl: String,
    mediaCaption: String,
    mimeType: String,
    fileName: String,
    fileSize: Number,
    duration: Number, // Para áudios e vídeos
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  },
  
  // Direção da mensagem
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  
  // Remetente e destinatário
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  
  // Status da mensagem
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  
  // Timestamps do WhatsApp
  whatsappTimestamp: Date,
  deliveredAt: Date,
  readAt: Date,
  
  // Processamento por IA
  ai: {
    processed: {
      type: Boolean,
      default: false
    },
    intent: String,
    entities: [{
      type: String,
      value: String,
      confidence: Number
    }],
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      confidence: Number
    },
    autoReply: {
      type: Boolean,
      default: false
    },
    responseGenerated: {
      type: Boolean,
      default: false
    }
  },
  
  // Contexto da conversa
  context: {
    isFirstMessage: {
      type: Boolean,
      default: false
    },
    previousMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    threadId: String,
    tags: [String]
  },
  
  // Interações especiais
  interactive: {
    type: {
      type: String,
      enum: ['button', 'list', 'product', 'catalog']
    },
    buttons: [{
      id: String,
      title: String,
      payload: String
    }],
    listItems: [{
      id: String,
      title: String,
      description: String,
      payload: String
    }],
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }
  },
  
  // Agendamento (para mensagens programadas)
  scheduled: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    scheduledFor: Date,
    campaignId: String,
    campaignName: String
  },
  
  // Métricas
  metrics: {
    responseTime: Number, // Tempo para responder (em segundos)
    processingTime: Number, // Tempo de processamento da IA
    clicked: {
      type: Boolean,
      default: false
    },
    clickedAt: Date
  },
  
  // Referências
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Dados de erro (se houver)
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
messageSchema.index({ storeId: 1, conversationId: 1, createdAt: -1 });
messageSchema.index({ contactId: 1, createdAt: -1 });
messageSchema.index({ direction: 1, status: 1 });
messageSchema.index({ 'scheduled.isScheduled': 1, 'scheduled.scheduledFor': 1 });
messageSchema.index({ 'ai.processed': 1 });

// Virtual para verificar se é uma mensagem de entrada
messageSchema.virtual('isInbound').get(function() {
  return this.direction === 'inbound';
});

// Virtual para verificar se é uma mensagem de saída
messageSchema.virtual('isOutbound').get(function() {
  return this.direction === 'outbound';
});

// Virtual para verificar se tem mídia
messageSchema.virtual('hasMedia').get(function() {
  return this.content.type !== 'text' && this.content.mediaUrl;
});

// Virtual para verificar se foi lida
messageSchema.virtual('isRead').get(function() {
  return this.status === 'read';
});

// Virtual para tempo de resposta formatado
messageSchema.virtual('responseTimeFormatted').get(function() {
  if (!this.metrics.responseTime) return null;
  
  const seconds = this.metrics.responseTime;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
});

// Método para marcar como lida
messageSchema.methods.markAsRead = async function() {
  if (this.status !== 'read') {
    this.status = 'read';
    this.readAt = new Date();
    await this.save();
  }
};

// Método para marcar como entregue
messageSchema.methods.markAsDelivered = async function() {
  if (this.status === 'sent') {
    this.status = 'delivered';
    this.deliveredAt = new Date();
    await this.save();
  }
};

// Método para marcar como falhada
messageSchema.methods.markAsFailed = async function(error) {
  this.status = 'failed';
  if (error) {
    this.error = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Erro desconhecido',
      details: error.details || null
    };
  }
  await this.save();
};

// Método para processar com IA
messageSchema.methods.processWithAI = async function(aiService) {
  if (this.ai.processed) return;
  
  try {
    const startTime = Date.now();
    
    // Processar mensagem com IA
    const result = await aiService.processMessage(this.content.text);
    
    this.ai = {
      processed: true,
      intent: result.intent,
      entities: result.entities,
      sentiment: result.sentiment,
      autoReply: false,
      responseGenerated: false
    };
    
    this.metrics.processingTime = Date.now() - startTime;
    
    await this.save();
    
    return result;
  } catch (error) {
    console.error('❌ Erro ao processar mensagem com IA:', error);
    this.ai.processed = true; // Marcar como processada mesmo com erro
    await this.save();
    throw error;
  }
};

// Método para gerar resposta automática
messageSchema.methods.generateAutoReply = async function(aiService, storeConfig) {
  if (this.direction !== 'inbound' || this.ai.responseGenerated) return null;
  
  try {
    const response = await aiService.generateResponse(
      this.content.text,
      this.ai.intent,
      storeConfig
    );
    
    this.ai.responseGenerated = true;
    this.ai.autoReply = true;
    await this.save();
    
    return response;
  } catch (error) {
    console.error('❌ Erro ao gerar resposta automática:', error);
    throw error;
  }
};

// Método estático para buscar conversa
messageSchema.statics.getConversation = function(storeId, contactId, limit = 50, page = 1) {
  const skip = (page - 1) * limit;
  
  return this.find({
    storeId,
    contactId
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip)
  .populate('contactId', 'name phone')
  .populate('interactive.productId', 'name price images');
};

// Método estático para estatísticas de mensagens
messageSchema.statics.getStats = function(storeId, startDate, endDate) {
  const matchStage = {
    storeId: new mongoose.Types.ObjectId(storeId)
  };
  
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        inboundMessages: {
          $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] }
        },
        outboundMessages: {
          $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] }
        },
        autoReplies: {
          $sum: { $cond: ['$ai.autoReply', 1, 0] }
        },
        averageResponseTime: {
          $avg: '$metrics.responseTime'
        },
        mediaMessages: {
          $sum: { $cond: [{ $ne: ['$content.type', 'text'] }, 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Message', messageSchema);

