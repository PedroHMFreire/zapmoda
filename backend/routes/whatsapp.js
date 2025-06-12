const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const WhatsAppService = require('../services/whatsappService');
const Store = require('../models/Store');

// Inicializar WhatsApp para uma loja
router.post('/initialize', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const qrCode = await WhatsAppService.initializeClient(store._id);
    
    res.json({
      success: true,
      qrCode,
      message: 'Escaneie o QR Code com seu WhatsApp'
    });
  } catch (error) {
    console.error('Erro ao inicializar WhatsApp:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Verificar status da conexão WhatsApp
router.get('/status', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const status = await WhatsAppService.getConnectionStatus(store._id);
    
    res.json({
      success: true,
      status,
      connected: status === 'connected'
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Desconectar WhatsApp
router.post('/disconnect', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    await WhatsAppService.disconnectClient(store._id);
    
    res.json({
      success: true,
      message: 'WhatsApp desconectado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao desconectar WhatsApp:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Enviar mensagem manual
router.post('/send-message', auth, async (req, res) => {
  try {
    const { phoneNumber, message, mediaUrl } = req.body;
    const store = await Store.findOne({ owner: req.user.id });
    
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const result = await WhatsAppService.sendMessage(store._id, phoneNumber, message, mediaUrl);
    
    res.json({
      success: true,
      messageId: result.id,
      message: 'Mensagem enviada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ message: 'Erro ao enviar mensagem' });
  }
});

// Webhook para receber mensagens
router.post('/webhook/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const messageData = req.body;

    // Processar mensagem recebida
    await WhatsAppService.processIncomingMessage(storeId, messageData);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Configurar mensagens automáticas
router.post('/auto-messages', auth, async (req, res) => {
  try {
    const { welcomeMessage, awayMessage, businessHours } = req.body;
    const store = await Store.findOne({ owner: req.user.id });
    
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    store.whatsappConfig.welcomeMessage = welcomeMessage;
    store.whatsappConfig.awayMessage = awayMessage;
    store.whatsappConfig.businessHours = businessHours;
    
    await store.save();
    
    res.json({
      success: true,
      message: 'Configurações salvas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Obter configurações atuais
router.get('/config', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    res.json({
      success: true,
      config: store.whatsappConfig
    });
  } catch (error) {
    console.error('Erro ao obter configurações:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

module.exports = router;

