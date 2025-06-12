const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Store = require('../models/Store');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Registrar novo usuário/lojista
 * @access Public
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, storeName, storePhone } = req.body;

    // Validar dados obrigatórios
    if (!name || !email || !password || !phone || !storeName || !storePhone) {
      return res.status(400).json({
        error: {
          message: 'Todos os campos são obrigatórios',
          code: 'MISSING_FIELDS'
        }
      });
    }

    // Verificar se o email já está em uso
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        error: {
          message: 'Este email já está em uso',
          code: 'EMAIL_EXISTS'
        }
      });
    }

    // Verificar se o telefone da loja já está em uso
    const existingStore = await Store.findOne({ 'whatsapp.number': storePhone });
    if (existingStore) {
      return res.status(400).json({
        error: {
          message: 'Este número de WhatsApp já está em uso por outra loja',
          code: 'PHONE_EXISTS'
        }
      });
    }

    // Criar a loja primeiro
    const store = new Store({
      name: storeName,
      phone: storePhone,
      whatsapp: {
        number: storePhone
      },
      ownerId: null // Será preenchido após criar o usuário
    });

    // Criar o usuário
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      phone
    });

    // Gerar token de verificação de email
    const emailVerificationToken = user.generateEmailVerificationToken();

    // Salvar usuário
    await user.save();

    // Atualizar a loja com o ID do proprietário
    store.ownerId = user._id;
    await store.save();

    // Atualizar o usuário com o ID da loja
    user.storeId = store._id;
    await user.save();

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Usuário registrado com sucesso',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          emailVerified: user.emailVerified,
          subscription: user.subscription
        },
        store: {
          id: store._id,
          name: store.name,
          phone: store.phone,
          whatsapp: {
            number: store.whatsapp.number,
            isConnected: store.whatsapp.isConnected
          }
        },
        token,
        emailVerificationToken
      }
    });

  } catch (error) {
    console.error('❌ Erro no registro:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: {
          message: 'Dados inválidos',
          details: errors,
          code: 'VALIDATION_ERROR'
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Fazer login do usuário
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar dados obrigatórios
    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email e senha são obrigatórios',
          code: 'MISSING_CREDENTIALS'
        }
      });
    }

    // Buscar usuário pelo email
    const user = await User.findOne({ email: email.toLowerCase() }).populate('storeId');
    
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Credenciais inválidas',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Verificar se a conta está bloqueada
    if (user.isLocked) {
      return res.status(423).json({
        error: {
          message: 'Conta temporariamente bloqueada devido a muitas tentativas de login. Tente novamente mais tarde.',
          code: 'ACCOUNT_LOCKED'
        }
      });
    }

    // Verificar senha
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Incrementar tentativas de login
      await user.incLoginAttempts();
      
      return res.status(401).json({
        error: {
          message: 'Credenciais inválidas',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // Verificar se a conta está ativa
    if (!user.isActive) {
      return res.status(401).json({
        error: {
          message: 'Conta desativada',
          code: 'ACCOUNT_DISABLED'
        }
      });
    }

    // Reset tentativas de login em caso de sucesso
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Atualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login realizado com sucesso',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          emailVerified: user.emailVerified,
          subscription: user.subscription,
          lastLogin: user.lastLogin
        },
        store: user.storeId ? {
          id: user.storeId._id,
          name: user.storeId.name,
          phone: user.storeId.phone,
          whatsapp: {
            number: user.storeId.whatsapp.number,
            isConnected: user.storeId.whatsapp.isConnected
          }
        } : null,
        token
      }
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({
      error: {
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Obter dados do usuário logado
 * @access Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('storeId').select('-password');
    
    res.json({
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          emailVerified: user.emailVerified,
          subscription: user.subscription,
          notifications: user.notifications,
          lastLogin: user.lastLogin
        },
        store: user.storeId ? {
          id: user.storeId._id,
          name: user.storeId.name,
          description: user.storeId.description,
          phone: user.storeId.phone,
          email: user.storeId.email,
          website: user.storeId.website,
          address: user.storeId.address,
          whatsapp: user.storeId.whatsapp,
          ai: user.storeId.ai,
          businessHours: user.storeId.businessHours,
          marketing: user.storeId.marketing,
          stats: user.storeId.stats,
          isActive: user.storeId.isActive
        } : null
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar dados do usuário:', error);
    res.status(500).json({
      error: {
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

/**
 * @route POST /api/auth/forgot-password
 * @desc Solicitar reset de senha
 * @access Public
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: {
          message: 'Email é obrigatório',
          code: 'MISSING_EMAIL'
        }
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Por segurança, sempre retornar sucesso mesmo se o email não existir
      return res.json({
        message: 'Se o email existir em nossa base, você receberá as instruções para redefinir sua senha'
      });
    }

    // Gerar token de reset
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Aqui você enviaria o email com o token
    // Por enquanto, vamos apenas retornar o token para fins de desenvolvimento
    res.json({
      message: 'Se o email existir em nossa base, você receberá as instruções para redefinir sua senha',
      // Em produção, remover esta linha:
      resetToken: resetToken
    });

  } catch (error) {
    console.error('❌ Erro no forgot password:', error);
    res.status(500).json({
      error: {
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

/**
 * @route POST /api/auth/reset-password
 * @desc Redefinir senha com token
 * @access Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: {
          message: 'Token e nova senha são obrigatórios',
          code: 'MISSING_FIELDS'
        }
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: {
          message: 'Nova senha deve ter no mínimo 6 caracteres',
          code: 'PASSWORD_TOO_SHORT'
        }
      });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        error: {
          message: 'Token inválido ou expirado',
          code: 'INVALID_TOKEN'
        }
      });
    }

    // Atualizar senha
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Reset tentativas de login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    
    await user.save();

    res.json({
      message: 'Senha redefinida com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro no reset password:', error);
    res.status(500).json({
      error: {
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

/**
 * @route POST /api/auth/verify-email
 * @desc Verificar email com token
 * @access Public
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: {
          message: 'Token é obrigatório',
          code: 'MISSING_TOKEN'
        }
      });
    }

    const user = await User.findOne({ emailVerificationToken: token });

    if (!user) {
      return res.status(400).json({
        error: {
          message: 'Token inválido',
          code: 'INVALID_TOKEN'
        }
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    res.json({
      message: 'Email verificado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na verificação de email:', error);
    res.status(500).json({
      error: {
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }
    });
  }
});

module.exports = router;

