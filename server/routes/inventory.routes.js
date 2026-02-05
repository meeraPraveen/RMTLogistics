import express from 'express';
import {
  getAllProducts,
  getProductById,
  getProductBySku,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getLowStockProducts,
  getInventoryStats,
  getProductCatalog
} from '../services/inventory.service.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/inventory
 * @desc    Get all products with pagination and filters
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const { page = 1, limit = 25, shape, size, base_type, search, low_stock, is_active } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      shape,
      size,
      base_type,
      search,
      low_stock: low_stock === 'true',
      is_active: is_active !== undefined ? is_active === 'true' : undefined
    };

    const result = await getAllProducts(options);

    res.json({
      success: true,
      data: result.products,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/inventory/stats
 * @desc    Get inventory statistics
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/stats', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const stats = await getInventoryStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory stats',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/inventory/low-stock
 * @desc    Get low stock products
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/low-stock', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const products = await getLowStockProducts();
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch low stock products',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/inventory/catalog
 * @desc    Lightweight product list for SKU dropdowns
 * @access  Private (Lead Artist, Admin, SuperAdmin, B2B User)
 */
router.get('/catalog', requireRole(['Lead Artist', 'Admin', 'SuperAdmin', 'B2B User']), async (req, res) => {
  try {
    const products = await getProductCatalog();
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching product catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product catalog',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/inventory/sku/:sku
 * @desc    Get product by SKU
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/sku/:sku', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const product = await getProductBySku(req.params.sku);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error fetching product by SKU:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/inventory/:id
 * @desc    Get product by ID
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/:id', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const product = await getProductById(parseInt(req.params.id));
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/inventory
 * @desc    Create a new product
 * @access  Private (SuperAdmin only)
 */
router.post('/', requireRole(['SuperAdmin']), async (req, res) => {
  try {
    const { sku, price, stock_quantity, low_stock_threshold } = req.body;

    if (!sku || price === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'SKU and price are required'
      });
    }

    const product = await createProduct({ sku, price, stock_quantity, low_stock_threshold });

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Error creating product:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Product already exists',
        message: 'A product with this SKU already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create product',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/inventory/:id
 * @desc    Update a product
 * @access  Private (Admin, SuperAdmin)
 */
router.put('/:id', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const product = await updateProduct(parseInt(req.params.id), req.body);
    res.json({
      success: true,
      data: product,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Error updating product:', error);

    if (error.message === 'Product not found') {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update product',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/inventory/:id/adjust-stock
 * @desc    Adjust stock quantity
 * @access  Private (Admin, SuperAdmin)
 */
router.post('/:id/adjust-stock', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const { adjustment } = req.body;

    if (adjustment === undefined || adjustment === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid adjustment',
        message: 'Adjustment value is required and must not be zero'
      });
    }

    // Look up product to get SKU
    const product = await getProductById(parseInt(req.params.id));
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const updated = await adjustStock(product.sku, parseInt(adjustment));
    res.json({
      success: true,
      data: updated,
      message: `Stock adjusted by ${adjustment > 0 ? '+' : ''}${adjustment}`
    });
  } catch (error) {
    console.error('Error adjusting stock:', error);

    if (error.message.includes('Insufficient stock')) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient stock',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to adjust stock',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/inventory/:id
 * @desc    Soft-delete a product
 * @access  Private (SuperAdmin only)
 */
router.delete('/:id', requireRole(['SuperAdmin']), async (req, res) => {
  try {
    const deleted = await deleteProduct(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deactivated successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
      message: error.message
    });
  }
});

export default router;
