const mongoose = require('mongoose');

/**
 * Schema do contato/cliente
 * Cada contato pertence a uma loja
 */
const contactSchema = new mongoose.Schema({
  // Dados básicos do contato
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  phone: {
    type: String,
    required: [true, 'Telefone é obrigatório'],
    trim: true,
    unique: false // Único apenas dentro da loja
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  
  // Dados pessoais
  birthday: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'not_informed'],
    default: 'not_informed'
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
  
  // Segmentação e tags
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag deve ter no máximo 50 caracteres']
  }],
  segment: {
    type: String,
    enum: ['vip', 'regular', 'new', 'inactive'],
    default: 'new'
  },
  
  // Preferências
  preferences: {
    categories: [String],
    priceRange: {
      min: Number,
      max: Number
    },
    sizes: [String],
    colors: [String],
    brands: [String]
  },
  
  // Lista de desejos
  wishlist: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    notifyOnSale: {
      type: Boolean,
      default: true
    },
    notifyOnRestock: {
      type: Boolean,
      default: true
    }
  }],
  
  // Carrinho abandonado
  abandonedCart: {
    items: [{
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      variantId: String,
      quantity: Number,
      price: Number,
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    lastUpdated: Date,
    notificationSent: {
      type: Boolean,
      default: false
    }
  },
  
  // Histórico de compras
  purchases: [{
    orderId: String,
    date: Date,
    total: Number,
    items: [{
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      name: String,
      quantity: Number,
      price: Number
    }],
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    }
  }],
  
  // Estatísticas do cliente
  stats: {
    totalOrders: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    },
    lastPurchase: Date,
    firstPurchase: Date,
    totalMessages: {
      type: Number,
      default: 0
    },
    lastMessage: Date,
    responseRate: {
      type: Number,
      default: 0
    }
  },
  
  // Configurações de comunicação
  communication: {
    whatsappOptIn: {
      type: Boolean,
      default: true
    },
    emailOptIn: {
      type: Boolean,
      default: false
    },
    smsOptIn: {
      type: Boolean,
      default: false
    },
    marketingOptIn: {
      type: Boolean,
      default: true
    },
    preferredTime: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '18:00'
      }
    },
    timezone: {
      type: String,
      default: 'America/Sao_Paulo'
    }
  },
  
  // Dados do WhatsApp
  whatsapp: {
    isBlocked: {
      type: Boolean,
      default: false
    },
    lastSeen: Date,
    profilePicture: String,
    status: String
  },
  
  // Notas e observações
  notes: [{
    content: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isPrivate: {
      type: Boolean,
      default: false
    }
  }],
  
  // Status do contato
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Referência à loja
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
contactSchema.index({ storeId: 1, phone: 1 }, { unique: true });
contactSchema.index({ storeId: 1, email: 1 });
contactSchema.index({ storeId: 1, segment: 1 });
contactSchema.index({ storeId: 1, tags: 1 });
contactSchema.index({ storeId: 1, isActive: 1 });
contactSchema.index({ birthday: 1 });

// Virtual para idade
contactSchema.virtual('age').get(function() {
  if (!this.birthday) return null;
  
  const today = new Date();
  const birthDate = new Date(this.birthday);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Virtual para verificar se é aniversário hoje
contactSchema.virtual('isBirthdayToday').get(function() {
  if (!this.birthday) return false;
  
  const today = new Date();
  const birthday = new Date(this.birthday);
  
  return today.getMonth() === birthday.getMonth() && 
         today.getDate() === birthday.getDate();
});

// Virtual para verificar se tem carrinho abandonado
contactSchema.virtual('hasAbandonedCart').get(function() {
  return this.abandonedCart.items && this.abandonedCart.items.length > 0;
});

// Virtual para valor total do carrinho abandonado
contactSchema.virtual('abandonedCartValue').get(function() {
  if (!this.hasAbandonedCart) return 0;
  
  return this.abandonedCart.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
});

// Virtual para classificação do cliente (baseado no valor gasto)
contactSchema.virtual('customerTier').get(function() {
  const totalSpent = this.stats.totalSpent;
  
  if (totalSpent >= 5000) return 'vip';
  if (totalSpent >= 2000) return 'gold';
  if (totalSpent >= 500) return 'silver';
  return 'bronze';
});

// Método para atualizar estatísticas
contactSchema.methods.updateStats = async function(type, value) {
  const updates = {};
  
  switch (type) {
    case 'purchase':
      updates['stats.totalOrders'] = this.stats.totalOrders + 1;
      updates['stats.totalSpent'] = this.stats.totalSpent + value;
      updates['stats.averageOrderValue'] = updates['stats.totalSpent'] / updates['stats.totalOrders'];
      updates['stats.lastPurchase'] = new Date();
      
      if (!this.stats.firstPurchase) {
        updates['stats.firstPurchase'] = new Date();
      }
      break;
      
    case 'message':
      updates['stats.totalMessages'] = this.stats.totalMessages + 1;
      updates['stats.lastMessage'] = new Date();
      break;
  }
  
  if (Object.keys(updates).length > 0) {
    await this.updateOne(updates);
  }
};

// Método para adicionar produto à lista de desejos
contactSchema.methods.addToWishlist = async function(productId, options = {}) {
  const existingItem = this.wishlist.find(item => 
    item.productId.toString() === productId.toString()
  );
  
  if (existingItem) {
    existingItem.notifyOnSale = options.notifyOnSale !== undefined ? options.notifyOnSale : existingItem.notifyOnSale;
    existingItem.notifyOnRestock = options.notifyOnRestock !== undefined ? options.notifyOnRestock : existingItem.notifyOnRestock;
  } else {
    this.wishlist.push({
      productId,
      notifyOnSale: options.notifyOnSale !== undefined ? options.notifyOnSale : true,
      notifyOnRestock: options.notifyOnRestock !== undefined ? options.notifyOnRestock : true
    });
  }
  
  await this.save();
};

// Método para remover produto da lista de desejos
contactSchema.methods.removeFromWishlist = async function(productId) {
  this.wishlist = this.wishlist.filter(item => 
    item.productId.toString() !== productId.toString()
  );
  
  await this.save();
};

// Método para adicionar item ao carrinho abandonado
contactSchema.methods.addToAbandonedCart = async function(productId, variantId, quantity, price) {
  const existingItemIndex = this.abandonedCart.items.findIndex(item => 
    item.productId.toString() === productId.toString() && 
    item.variantId === variantId
  );
  
  if (existingItemIndex >= 0) {
    this.abandonedCart.items[existingItemIndex].quantity = quantity;
    this.abandonedCart.items[existingItemIndex].price = price;
    this.abandonedCart.items[existingItemIndex].addedAt = new Date();
  } else {
    this.abandonedCart.items.push({
      productId,
      variantId,
      quantity,
      price
    });
  }
  
  this.abandonedCart.lastUpdated = new Date();
  this.abandonedCart.notificationSent = false;
  
  await this.save();
};

// Método para limpar carrinho abandonado
contactSchema.methods.clearAbandonedCart = async function() {
  this.abandonedCart.items = [];
  this.abandonedCart.lastUpdated = new Date();
  this.abandonedCart.notificationSent = false;
  
  await this.save();
};

// Método para adicionar nota
contactSchema.methods.addNote = async function(content, createdBy, isPrivate = false) {
  this.notes.push({
    content,
    createdBy,
    isPrivate
  });
  
  await this.save();
};

module.exports = mongoose.model('Contact', contactSchema);

