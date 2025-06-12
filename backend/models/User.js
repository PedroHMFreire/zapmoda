const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Schema do usuário/lojista
 * Cada usuário representa um lojista que possui uma loja
 */
const userSchema = new mongoose.Schema({
  // Dados pessoais
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter no mínimo 6 caracteres']
  },
  phone: {
    type: String,
    required: [true, 'Telefone é obrigatório'],
    trim: true
  },
  
  // Dados da conta
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Referência à loja
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store'
  },
  
  // Configurações de notificação
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    whatsapp: {
      type: Boolean,
      default: true
    },
    newMessage: {
      type: Boolean,
      default: true
    },
    lowStock: {
      type: Boolean,
      default: true
    }
  },
  
  // Dados de acesso
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  
  // Plano de assinatura
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled'],
      default: 'active'
    },
    startDate: Date,
    endDate: Date,
    autoRenew: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
userSchema.index({ email: 1 });
userSchema.index({ storeId: 1 });
userSchema.index({ 'subscription.plan': 1 });

// Virtual para verificar se a conta está bloqueada
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Middleware para hash da senha antes de salvar
userSchema.pre('save', async function(next) {
  // Só fazer hash se a senha foi modificada
  if (!this.isModified('password')) return next();
  
  try {
    // Gerar salt e hash da senha
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar senhas
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Método para incrementar tentativas de login
userSchema.methods.incLoginAttempts = function() {
  // Se já temos um lock anterior e ele expirou, reiniciar
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        loginAttempts: 1,
        lockUntil: 1
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Se atingiu o máximo de tentativas e não está bloqueado, bloquear
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 horas
    };
  }
  
  return this.updateOne(updates);
};

// Método para resetar tentativas de login
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

// Método para gerar token de verificação de email
userSchema.methods.generateEmailVerificationToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = token;
  return token;
};

// Método para gerar token de reset de senha
userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = token;
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutos
  return token;
};

// Método para verificar se o plano permite determinada funcionalidade
userSchema.methods.canUseFeature = function(feature) {
  const planLimits = {
    free: {
      maxContacts: 100,
      maxProducts: 50,
      maxMessagesPerMonth: 1000,
      aiResponses: false,
      scheduledMessages: false,
      analytics: false
    },
    basic: {
      maxContacts: 500,
      maxProducts: 200,
      maxMessagesPerMonth: 5000,
      aiResponses: true,
      scheduledMessages: true,
      analytics: false
    },
    premium: {
      maxContacts: -1, // ilimitado
      maxProducts: -1, // ilimitado
      maxMessagesPerMonth: -1, // ilimitado
      aiResponses: true,
      scheduledMessages: true,
      analytics: true
    }
  };
  
  const currentPlan = planLimits[this.subscription.plan];
  return currentPlan[feature] === true || currentPlan[feature] === -1;
};

module.exports = mongoose.model('User', userSchema);

