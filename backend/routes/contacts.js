const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Contact = require('../models/Contact');
const Store = require('../models/Store');

// Listar contatos da loja
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, segment } = req.query;
    const store = await Store.findOne({ owner: req.user.id });
    
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const query = { store: store._id };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (segment) query.segment = segment;

    const contacts = await Contact.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ lastInteraction: -1 });

    const total = await Contact.countDocuments(query);

    res.json({
      success: true,
      contacts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erro ao listar contatos:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Criar novo contato
router.post('/', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const {
      name,
      phone,
      email,
      birthday,
      preferences,
      notes,
      segment
    } = req.body;

    // Verificar se o contato já existe
    const existingContact = await Contact.findOne({
      store: store._id,
      phone
    });

    if (existingContact) {
      return res.status(400).json({ message: 'Contato já existe com este telefone' });
    }

    const contact = new Contact({
      store: store._id,
      name,
      phone,
      email,
      birthday: birthday ? new Date(birthday) : null,
      preferences: preferences || {},
      notes,
      segment: segment || 'novo',
      lastInteraction: new Date()
    });

    await contact.save();

    res.status(201).json({
      success: true,
      contact,
      message: 'Contato criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar contato:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Obter contato específico
router.get('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const contact = await Contact.findOne({ 
      _id: req.params.id, 
      store: store._id 
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contato não encontrado' });
    }

    res.json({
      success: true,
      contact
    });
  } catch (error) {
    console.error('Erro ao obter contato:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualizar contato
router.put('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const contact = await Contact.findOne({ 
      _id: req.params.id, 
      store: store._id 
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contato não encontrado' });
    }

    const {
      name,
      phone,
      email,
      birthday,
      preferences,
      notes,
      segment,
      wishlist
    } = req.body;

    // Atualizar campos
    if (name) contact.name = name;
    if (phone) contact.phone = phone;
    if (email) contact.email = email;
    if (birthday) contact.birthday = new Date(birthday);
    if (preferences) contact.preferences = { ...contact.preferences, ...preferences };
    if (notes) contact.notes = notes;
    if (segment) contact.segment = segment;
    if (wishlist) contact.wishlist = wishlist;

    contact.updatedAt = new Date();
    await contact.save();

    res.json({
      success: true,
      contact,
      message: 'Contato atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar contato:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Deletar contato
router.delete('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const contact = await Contact.findOneAndDelete({ 
      _id: req.params.id, 
      store: store._id 
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contato não encontrado' });
    }

    res.json({
      success: true,
      message: 'Contato deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar contato:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Adicionar produto à lista de desejos
router.post('/:id/wishlist', auth, async (req, res) => {
  try {
    const { productId } = req.body;
    const store = await Store.findOne({ owner: req.user.id });
    
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const contact = await Contact.findOne({ 
      _id: req.params.id, 
      store: store._id 
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contato não encontrado' });
    }

    if (!contact.wishlist.includes(productId)) {
      contact.wishlist.push(productId);
      await contact.save();
    }

    res.json({
      success: true,
      message: 'Produto adicionado à lista de desejos'
    });
  } catch (error) {
    console.error('Erro ao adicionar à wishlist:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Remover produto da lista de desejos
router.delete('/:id/wishlist/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    const store = await Store.findOne({ owner: req.user.id });
    
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const contact = await Contact.findOne({ 
      _id: req.params.id, 
      store: store._id 
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contato não encontrado' });
    }

    contact.wishlist = contact.wishlist.filter(id => id.toString() !== productId);
    await contact.save();

    res.json({
      success: true,
      message: 'Produto removido da lista de desejos'
    });
  } catch (error) {
    console.error('Erro ao remover da wishlist:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Obter estatísticas de contatos
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const totalContacts = await Contact.countDocuments({ store: store._id });
    
    const segmentStats = await Contact.aggregate([
      { $match: { store: store._id } },
      { $group: { _id: '$segment', count: { $sum: 1 } } }
    ]);

    const recentContacts = await Contact.countDocuments({
      store: store._id,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      stats: {
        total: totalContacts,
        recent: recentContacts,
        segments: segmentStats
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

module.exports = router;

