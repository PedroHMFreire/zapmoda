const mongoose = require('mongoose');

/**
 * Schema do produto
 * Cada produto pertence a uma loja
 */
const productSchema = new mongoose.Schema({
  // Dados básicos do produto
  name: {
    type: String,
    required: [true, 'Nome do produto é obrigatório'],
    trim: true,
    maxlength: [200, 'Nome deve ter no máximo 200 caracteres']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Descrição deve ter no máximo 1000 caracteres']
  },
  sku: {
    type: String,
    trim: true,
    uppercase: true
  },
  
  // Preços
  price: {
    type: Number,
    required: [true, 'Preço é obrigatório'],
    min: [0, 'Preço deve ser maior que zero']
  },
  comparePrice: {
    type: Number,
    min: [0, 'Preço de comparação deve ser maior que zero']
  },
  cost: {
    type: Number,
    min: [0, 'Custo deve ser maior que zero']
  },
  
  // Estoque
  inventory: {
    trackQuantity: {
      type: Boolean,
      default: true
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantidade não pode ser negativa']
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, 'Limite de estoque baixo deve ser maior ou igual a zero']
    },
    allowBackorder: {
      type: Boolean,
      default: false
    }
  },
  
  // Categorização
  category: {
    type: String,
    trim: true,
    maxlength: [100, 'Categoria deve ter no máximo 100 caracteres']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag deve ter no máximo 50 caracteres']
  }],
  
  // Variações (tamanho, cor, etc.)
  variants: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    },
    price: Number,
    sku: String,
    inventory: {
      quantity: {
        type: Number,
        default: 0
      },
      lowStockThreshold: {
        type: Number,
        default: 5
      }
    }
  }],
  
  // Imagens
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // SEO e metadados
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },
  
  // Configurações de venda
  isActive: {
    type: Boolean,
    default: true
  },
  isDigital: {
    type: Boolean,
    default: false
  },
  requiresShipping: {
    type: Boolean,
    default: true
  },
  weight: {
    type: Number,
    min: [0, 'Peso deve ser maior ou igual a zero']
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  
  // Configurações de desconto
  discounts: [{
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: [0, 'Valor do desconto deve ser maior que zero']
    },
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Estatísticas
  stats: {
    views: {
      type: Number,
      default: 0
    },
    likes: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    sales: {
      type: Number,
      default: 0
    },
    revenue: {
      type: Number,
      default: 0
    }
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
productSchema.index({ storeId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ 'inventory.quantity': 1 });
productSchema.index({ price: 1 });

// Virtual para preço com desconto
productSchema.virtual('finalPrice').get(function() {
  let finalPrice = this.price;
  
  // Aplicar desconto ativo
  const activeDiscount = this.discounts.find(discount => {
    if (!discount.isActive) return false;
    
    const now = new Date();
    if (discount.startDate && now < discount.startDate) return false;
    if (discount.endDate && now > discount.endDate) return false;
    
    return true;
  });
  
  if (activeDiscount) {
    if (activeDiscount.type === 'percentage') {
      finalPrice = this.price * (1 - activeDiscount.value / 100);
    } else {
      finalPrice = this.price - activeDiscount.value;
    }
  }
  
  return Math.max(0, finalPrice);
});

// Virtual para verificar se está em promoção
productSchema.virtual('isOnSale').get(function() {
  return this.finalPrice < this.price;
});

// Virtual para verificar se está com estoque baixo
productSchema.virtual('isLowStock').get(function() {
  if (!this.inventory.trackQuantity) return false;
  return this.inventory.quantity <= this.inventory.lowStockThreshold;
});

// Virtual para verificar se está fora de estoque
productSchema.virtual('isOutOfStock').get(function() {
  if (!this.inventory.trackQuantity) return false;
  return this.inventory.quantity <= 0;
});

// Virtual para imagem principal
productSchema.virtual('primaryImage').get(function() {
  const primary = this.images.find(img => img.isPrimary);
  return primary || this.images[0] || null;
});

// Método para atualizar estatísticas
productSchema.methods.updateStats = async function(type, value = 1) {
  const updates = {};
  
  switch (type) {
    case 'view':
      updates['stats.views'] = this.stats.views + value;
      break;
    case 'like':
      updates['stats.likes'] = this.stats.likes + value;
      break;
    case 'share':
      updates['stats.shares'] = this.stats.shares + value;
      break;
    case 'sale':
      updates['stats.sales'] = this.stats.sales + value;
      break;
    case 'revenue':
      updates['stats.revenue'] = this.stats.revenue + value;
      break;
  }
  
  if (Object.keys(updates).length > 0) {
    await this.updateOne(updates);
  }
};

// Método para reduzir estoque
productSchema.methods.reduceStock = async function(quantity, variantId = null) {
  if (!this.inventory.trackQuantity) return true;
  
  if (variantId) {
    const variant = this.variants.id(variantId);
    if (!variant) throw new Error('Variação não encontrada');
    
    if (variant.inventory.quantity < quantity && !this.inventory.allowBackorder) {
      throw new Error('Estoque insuficiente para esta variação');
    }
    
    variant.inventory.quantity -= quantity;
  } else {
    if (this.inventory.quantity < quantity && !this.inventory.allowBackorder) {
      throw new Error('Estoque insuficiente');
    }
    
    this.inventory.quantity -= quantity;
  }
  
  await this.save();
  return true;
};

// Método para aumentar estoque
productSchema.methods.increaseStock = async function(quantity, variantId = null) {
  if (!this.inventory.trackQuantity) return true;
  
  if (variantId) {
    const variant = this.variants.id(variantId);
    if (!variant) throw new Error('Variação não encontrada');
    
    variant.inventory.quantity += quantity;
  } else {
    this.inventory.quantity += quantity;
  }
  
  await this.save();
  return true;
};

module.exports = mongoose.model('Product', productSchema);

