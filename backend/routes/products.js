const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const Store = require('../models/Store');
const multer = require('multer');
const path = require('path');

// Configuração do multer para upload de imagens
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/products/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

// Listar produtos da loja
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search, status } = req.query;
    const store = await Store.findOne({ owner: req.user.id });
    
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const query = { store: store._id };
    
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;

    const products = await Product.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Criar novo produto
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const {
      name,
      description,
      price,
      category,
      sizes,
      colors,
      stock,
      sku,
      tags
    } = req.body;

    // Processar imagens enviadas
    const images = req.files ? req.files.map(file => ({
      url: `/uploads/products/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname
    })) : [];

    const product = new Product({
      store: store._id,
      name,
      description,
      price: parseFloat(price),
      category,
      sizes: sizes ? JSON.parse(sizes) : [],
      colors: colors ? JSON.parse(colors) : [],
      stock: parseInt(stock) || 0,
      sku,
      tags: tags ? JSON.parse(tags) : [],
      images,
      status: 'active'
    });

    await product.save();

    res.status(201).json({
      success: true,
      product,
      message: 'Produto criado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Obter produto específico
router.get('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const product = await Product.findOne({ 
      _id: req.params.id, 
      store: store._id 
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Erro ao obter produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualizar produto
router.put('/:id', auth, upload.array('images', 5), async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const product = await Product.findOne({ 
      _id: req.params.id, 
      store: store._id 
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    const {
      name,
      description,
      price,
      category,
      sizes,
      colors,
      stock,
      sku,
      tags,
      status
    } = req.body;

    // Atualizar campos
    if (name) product.name = name;
    if (description) product.description = description;
    if (price) product.price = parseFloat(price);
    if (category) product.category = category;
    if (sizes) product.sizes = JSON.parse(sizes);
    if (colors) product.colors = JSON.parse(colors);
    if (stock !== undefined) product.stock = parseInt(stock);
    if (sku) product.sku = sku;
    if (tags) product.tags = JSON.parse(tags);
    if (status) product.status = status;

    // Adicionar novas imagens se enviadas
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        url: `/uploads/products/${file.filename}`,
        filename: file.filename,
        originalName: file.originalname
      }));
      product.images = [...product.images, ...newImages];
    }

    product.updatedAt = new Date();
    await product.save();

    res.json({
      success: true,
      product,
      message: 'Produto atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Deletar produto
router.delete('/:id', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const product = await Product.findOneAndDelete({ 
      _id: req.params.id, 
      store: store._id 
    });

    if (!product) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    res.json({
      success: true,
      message: 'Produto deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Buscar produtos para catálogo (público)
router.get('/catalog/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { category, search, minPrice, maxPrice, limit = 20 } = req.query;

    const query = { 
      store: storeId, 
      status: 'active',
      stock: { $gt: 0 }
    };
    
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const products = await Product.find(query)
      .select('name description price category images sizes colors stock')
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      products
    });
  } catch (error) {
    console.error('Erro ao buscar catálogo:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Obter categorias da loja
router.get('/categories/list', auth, async (req, res) => {
  try {
    const store = await Store.findOne({ owner: req.user.id });
    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada' });
    }

    const categories = await Product.distinct('category', { 
      store: store._id,
      status: 'active'
    });

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Erro ao obter categorias:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

module.exports = router;

