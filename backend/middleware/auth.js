const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware de autenticação JWT
 * Verifica se o token JWT é válido e adiciona os dados do usuário à requisição
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Extrair token do header Authorization
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        error: {
          message: 'Token de acesso não fornecido',
          code: 'NO_TOKEN'
        }
      });
    }

    // Verificar se o token está no formato correto (Bearer token)
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Formato de token inválido',
          code: 'INVALID_TOKEN_FORMAT'
        }
      });
    }

    // Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar o usuário no banco de dados
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    // Verificar se o usuário está ativo
    if (!user.isActive) {
      return res.status(401).json({
        error: {
          message: 'Conta desativada',
          code: 'ACCOUNT_DISABLED'
        }
      });
    }

    // Adicionar dados do usuário à requisição
    req.user = user;
    req.userId = user._id;
    req.storeId = user.storeId;
    
    next();
  } catch (error) {
    console.error('❌ Erro no middleware de autenticação:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: {
          message: 'Token inválido',
          code: 'INVALID_TOKEN'
        }
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Token expirado',
          code: 'TOKEN_EXPIRED'
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
};

/**
 * Middleware para verificar se o usuário é administrador
 */
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: {
        message: 'Acesso negado. Apenas administradores podem acessar este recurso.',
        code: 'ADMIN_REQUIRED'
      }
    });
  }
  next();
};

/**
 * Middleware para verificar se o usuário é proprietário da loja ou administrador
 */
const storeOwnerMiddleware = (req, res, next) => {
  const { storeId } = req.params;
  
  if (req.user.role !== 'admin' && req.user.storeId.toString() !== storeId) {
    return res.status(403).json({
      error: {
        message: 'Acesso negado. Você só pode acessar dados da sua própria loja.',
        code: 'STORE_ACCESS_DENIED'
      }
    });
  }
  next();
};

module.exports = authMiddleware;

