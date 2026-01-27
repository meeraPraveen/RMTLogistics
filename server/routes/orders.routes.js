import express from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrderStats
} from '../services/order.service.js';
import { uploadOrderImage } from '../config/upload.config.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/orders
 * @desc    Get all orders with pagination and filters
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      order_type,
      status,
      search,
      assigned_artist_id,
      assigned_qc_id,
      company_id,
      sort = 'date_submitted',
      order = 'DESC'
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      order_type,
      status,
      search,
      assigned_artist_id: assigned_artist_id ? parseInt(assigned_artist_id) : undefined,
      assigned_qc_id: assigned_qc_id ? parseInt(assigned_qc_id) : undefined,
      company_id: company_id ? parseInt(company_id) : undefined,
      sort,
      order
    };

    const result = await getAllOrders(options);

    res.json({
      success: true,
      data: result.orders,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/orders/stats
 * @desc    Get order statistics
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/stats', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const stats = await getOrderStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order statistics',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/:id', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/orders
 * @desc    Create a new order
 * @access  Private (Admin, SuperAdmin)
 */
router.post('/', requireRole(['Admin', 'SuperAdmin']), uploadOrderImage.single('image'), async (req, res) => {
  try {
    const orderData = {
      ...req.body,
      // Parse JSON strings from form data
      shipping_address: typeof req.body.shipping_address === 'string'
        ? JSON.parse(req.body.shipping_address)
        : req.body.shipping_address,
      // Parse boolean values
      has_background: req.body.has_background === 'true' || req.body.has_background === true,
      has_text: req.body.has_text === 'true' || req.body.has_text === true,
      // Parse numeric values
      unit_rate: req.body.unit_rate ? parseFloat(req.body.unit_rate) : null,
      total_amount: req.body.total_amount ? parseFloat(req.body.total_amount) : null,
      company_id: req.body.company_id ? parseInt(req.body.company_id) : null,
      assigned_artist_id: req.body.assigned_artist_id ? parseInt(req.body.assigned_artist_id) : null,
      assigned_qc_id: req.body.assigned_qc_id ? parseInt(req.body.assigned_qc_id) : null,
    };

    // Add image information if uploaded
    if (req.file) {
      orderData.image_name = req.file.filename;
      orderData.image_path = `/uploads/orders/${req.body.internal_order_id || 'temp'}/${req.file.filename}`;
    }

    // Get user ID from auth
    const createdBy = req.user.id; // This should be the database user ID, not auth0_user_id

    const newOrder = await createOrder(orderData, createdBy);

    res.status(201).json({
      success: true,
      data: newOrder,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/orders/:id
 * @desc    Update an order
 * @access  Private (Admin, SuperAdmin)
 */
router.put('/:id', requireRole(['Admin', 'SuperAdmin']), uploadOrderImage.single('image'), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    const updates = {
      ...req.body,
      // Parse JSON strings from form data
      shipping_address: typeof req.body.shipping_address === 'string'
        ? JSON.parse(req.body.shipping_address)
        : req.body.shipping_address,
      // Parse boolean values
      has_background: req.body.has_background === 'true' || req.body.has_background === true,
      has_text: req.body.has_text === 'true' || req.body.has_text === true,
      // Parse numeric values
      unit_rate: req.body.unit_rate ? parseFloat(req.body.unit_rate) : undefined,
      total_amount: req.body.total_amount ? parseFloat(req.body.total_amount) : undefined,
      company_id: req.body.company_id ? parseInt(req.body.company_id) : null,
      assigned_artist_id: req.body.assigned_artist_id ? parseInt(req.body.assigned_artist_id) : null,
      assigned_qc_id: req.body.assigned_qc_id ? parseInt(req.body.assigned_qc_id) : null,
    };

    // Add image information if uploaded
    if (req.file) {
      updates.image_name = req.file.filename;
      updates.image_path = `/uploads/orders/${req.body.internal_order_id || 'temp'}/${req.file.filename}`;
    }

    const updatedOrder = await updateOrder(orderId, updates);

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: updatedOrder,
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/orders/:id
 * @desc    Delete an order
 * @access  Private (SuperAdmin only)
 */
router.delete('/:id', requireRole(['SuperAdmin']), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const deleted = await deleteOrder(orderId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete order',
      message: error.message
    });
  }
});

export default router;
