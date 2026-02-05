import express from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrderStats,
  generateInternalOrderId
} from '../services/order.service.js';
import { getCompanyById } from '../services/company.service.js';
import { uploadOrderImage } from '../config/upload.config.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

/**
 * Sanitize a string for use as a folder name
 */
const sanitizeFolderName = (name) => {
  return name ? name.replace(/[^a-zA-Z0-9-_]/g, '_') : '';
};

/**
 * Build the folder path for order images
 * Structure: {order_type}/{company_name (for B2B)}/{platform_order_id or internal_order_id}
 */
const buildOrderFolderPath = async (orderType, companyId, platformOrderId, internalOrderId) => {
  const orderFolder = sanitizeFolderName(platformOrderId) || internalOrderId;

  // Map order types to folder names
  const typeFolder = orderType || 'Direct';

  if (orderType === 'B2B' && companyId) {
    // For B2B orders, include company name in path
    try {
      const company = await getCompanyById(companyId);
      const companyFolder = company ? sanitizeFolderName(company.name) : 'Unknown_Company';
      return `${typeFolder}/${companyFolder}/${orderFolder}`;
    } catch (error) {
      console.error('Error fetching company for folder path:', error);
      return `${typeFolder}/Unknown_Company/${orderFolder}`;
    }
  }

  return `${typeFolder}/${orderFolder}`;
};

/**
 * Middleware to prepare folder for new order uploads
 * Structure: {order_type}/{company_name (B2B only)}/{platform_order_id or internal_order_id}
 */
const prepareNewOrderUpload = async (req, res, next) => {
  try {
    // Generate internal order ID (needed for the order record)
    req.generatedInternalOrderId = await generateInternalOrderId();

    // Build the full folder path based on order type and company
    const orderType = req.body.order_type;
    const companyId = req.body.company_id;
    const platformOrderId = req.body.platform_order_id;

    req.orderFolderPath = await buildOrderFolderPath(
      orderType,
      companyId,
      platformOrderId,
      req.generatedInternalOrderId
    );

    next();
  } catch (error) {
    console.error('Error preparing order upload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to prepare order upload',
      message: error.message
    });
  }
};

/**
 * Middleware to set order folder for updates (before file upload)
 * Uses the existing order's structure for the folder path
 */
const prepareUpdateOrderUpload = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const existingOrder = await getOrderById(orderId);
    if (existingOrder) {
      req.existingOrder = existingOrder;

      // Build folder path from existing order data
      req.orderFolderPath = await buildOrderFolderPath(
        existingOrder.order_type,
        existingOrder.company_id,
        existingOrder.platform_order_id,
        existingOrder.internal_order_id
      );
    }
    next();
  } catch (error) {
    console.error('Error preparing order update:', error);
    next(); // Continue even if we can't get the order ID
  }
};

/**
 * Helper to filter sensitive fields for Artist roles
 * Artists should not see: price, customer info, shipping address
 */
const filterSensitiveFields = (order, userRole) => {
  const artistRoles = ['Artist', 'Lead Artist'];
  if (!artistRoles.includes(userRole)) {
    return order;
  }

  // Remove sensitive fields for artists
  const {
    customer_email,
    shipping_address,
    unit_rate,
    total_amount,
    ...filteredOrder
  } = order;

  return filteredOrder;
};

/**
 * @route   GET /api/orders
 * @desc    Get all orders with pagination and filters
 * @access  Private (Artist, Lead Artist, Admin, SuperAdmin, B2B User)
 */
router.get('/', requireRole(['Artist', 'Lead Artist', 'Admin', 'SuperAdmin', 'B2B User']), async (req, res) => {
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
      date_from,
      date_to,
      sort = 'date_submitted',
      order = 'DESC'
    } = req.query;

    // B2B users can ONLY see orders from their own company
    // Other roles (Admin, SuperAdmin, Lead Artist) can see all orders or filter by company
    let effectiveCompanyId = company_id || undefined;
    if (req.user.role === 'B2B User') {
      if (!req.user.company_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'B2B user must be associated with a company to view orders'
        });
      }
      effectiveCompanyId = req.user.company_id;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      order_type,
      status,
      search,
      assigned_artist_id: assigned_artist_id ? parseInt(assigned_artist_id) : undefined,
      assigned_qc_id: assigned_qc_id ? parseInt(assigned_qc_id) : undefined,
      company_id: effectiveCompanyId, // UUID string, not integer
      date_from,
      date_to,
      sort,
      order
    };

    const result = await getAllOrders(options);

    // Filter sensitive fields for Artist roles
    const filteredOrders = result.orders.map(order => filterSensitiveFields(order, req.user.role));

    res.json({
      success: true,
      data: filteredOrders,
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
 * @access  Private (Artist, Lead Artist, Admin, SuperAdmin, B2B User)
 */
router.get('/stats', requireRole(['Artist', 'Lead Artist', 'Admin', 'SuperAdmin', 'B2B User']), async (req, res) => {
  try {
    // B2B users only see stats for their company's orders
    const options = {};
    if (req.user.role === 'B2B User') {
      if (!req.user.company_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'B2B user must be associated with a company to view order stats'
        });
      }
      options.company_id = req.user.company_id;
    }

    const stats = await getOrderStats(options);

    // Filter revenue for Artist roles
    const artistRoles = ['Artist', 'Lead Artist'];
    if (artistRoles.includes(req.user.role)) {
      delete stats.total_revenue;
    }

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
 * @access  Private (Artist, Lead Artist, Admin, SuperAdmin, B2B User)
 */
router.get('/:id', requireRole(['Artist', 'Lead Artist', 'Admin', 'SuperAdmin', 'B2B User']), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // B2B users can only view orders from their own company
    if (req.user.role === 'B2B User' && order.company_id !== req.user.company_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You can only view orders from your company'
      });
    }

    // Filter sensitive fields for Artist roles
    const filteredOrder = filterSensitiveFields(order, req.user.role);

    res.json({
      success: true,
      data: filteredOrder
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
 * @access  Private (Admin, SuperAdmin, B2B User) - Artists cannot create orders
 */
router.post('/', requireRole(['Admin', 'SuperAdmin', 'B2B User']), prepareNewOrderUpload, uploadOrderImage.array('images', 5), async (req, res) => {
  try {
    // B2B users can only create orders for their own company
    let effectiveCompanyId = req.body.company_id || null;
    if (req.user.role === 'B2B User') {
      if (!req.user.company_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'B2B user must be associated with a company to create orders'
        });
      }
      effectiveCompanyId = req.user.company_id;
    }

    const orderData = {
      ...req.body,
      // Use the pre-generated internal order ID
      internal_order_id: req.generatedInternalOrderId,
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
      company_id: effectiveCompanyId, // UUID string, not integer
      assigned_artist_id: req.body.assigned_artist_id ? parseInt(req.body.assigned_artist_id) : null,
      assigned_qc_id: req.body.assigned_qc_id ? parseInt(req.body.assigned_qc_id) : null,
    };

    // Add image information if uploaded (supports up to 5 images)
    if (req.files && req.files.length > 0) {
      const imageNames = req.files.map(file => file.filename);
      const imagePaths = req.files.map(file => `/uploads/orders/${req.orderFolderPath}/${file.filename}`);
      orderData.image_name = JSON.stringify(imageNames);
      orderData.image_path = JSON.stringify(imagePaths);
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
 * @access  Private (Artist, Lead Artist, Admin, SuperAdmin, B2B User)
 * Note: Artists can only upload images, not modify other order data
 */
router.put('/:id', requireRole(['Artist', 'Lead Artist', 'Admin', 'SuperAdmin', 'B2B User']), prepareUpdateOrderUpload, uploadOrderImage.array('images', 5), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const artistRoles = ['Artist', 'Lead Artist'];
    const limitedRoles = ['Artist', 'Lead Artist', 'Production Tech'];
    const isArtist = artistRoles.includes(req.user.role);
    const isLimitedRole = limitedRoles.includes(req.user.role);

    // Use existing order from middleware if available, otherwise fetch it
    const existingOrder = req.existingOrder || await getOrderById(orderId);

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // B2B users can only update orders from their own company
    if (req.user.role === 'B2B User') {
      if (existingOrder.company_id !== req.user.company_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only update orders from your company'
        });
      }
    }

    let updates = {};

    // Artists/Lead Artists/Production Tech can ONLY update images and internal_notes - no other fields
    if (isLimitedRole) {
      // Parse existing images from request body
      let existingImages = [];
      if (req.body.existing_images) {
        try {
          existingImages = JSON.parse(req.body.existing_images);
        } catch (e) {
          existingImages = [];
        }
      }

      // Add newly uploaded images
      if (req.files && req.files.length > 0) {
        const newImageNames = req.files.map(file => file.filename);
        const newImagePaths = req.files.map(file => `/uploads/orders/${req.orderFolderPath}/${file.filename}`);

        const allImagePaths = [...existingImages, ...newImagePaths].slice(0, 5);
        const allImageNames = [
          ...existingImages.map(p => p.split('/').pop()),
          ...newImageNames
        ].slice(0, 5);

        updates.image_name = JSON.stringify(allImageNames);
        updates.image_path = JSON.stringify(allImagePaths);
      } else if (req.body.existing_images !== undefined) {
        updates.image_name = JSON.stringify(existingImages.map(p => p.split('/').pop()));
        updates.image_path = JSON.stringify(existingImages);
      }

      // Allow Artists to update internal_notes
      if (req.body.internal_notes !== undefined) {
        updates.internal_notes = req.body.internal_notes || null;
      }

      // Allow Lead Artists to update assigned_artist_id (assign to Artists)
      if (req.user.role === 'Lead Artist' && req.body.assigned_artist_id !== undefined) {
        updates.assigned_artist_id = req.body.assigned_artist_id ? parseInt(req.body.assigned_artist_id) : null;
      }

      // If no updates, nothing for limited roles to do
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No changes',
          message: req.user.role === 'Lead Artist'
            ? 'You can only upload images, add internal notes, or assign to artists'
            : 'You can only upload images or add internal notes'
        });
      }
    } else {
      // Non-artist roles can update all fields
      // B2B users cannot change the company_id of an order
      let effectiveCompanyId = req.body.company_id || null;
      if (req.user.role === 'B2B User') {
        effectiveCompanyId = req.user.company_id;
      }

      updates = {
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
        company_id: effectiveCompanyId, // UUID string, not integer
        assigned_artist_id: req.body.assigned_artist_id ? parseInt(req.body.assigned_artist_id) : null,
        assigned_qc_id: req.body.assigned_qc_id ? parseInt(req.body.assigned_qc_id) : null,
      };

      // Handle image updates (supports up to 5 images)
      let existingImages = [];
      if (req.body.existing_images) {
        try {
          existingImages = JSON.parse(req.body.existing_images);
        } catch (e) {
          existingImages = [];
        }
      }

      if (req.files && req.files.length > 0) {
        const newImageNames = req.files.map(file => file.filename);
        const newImagePaths = req.files.map(file => `/uploads/orders/${req.orderFolderPath}/${file.filename}`);

        const allImagePaths = [...existingImages, ...newImagePaths].slice(0, 5);
        const allImageNames = [
          ...existingImages.map(p => p.split('/').pop()),
          ...newImageNames
        ].slice(0, 5);

        updates.image_name = JSON.stringify(allImageNames);
        updates.image_path = JSON.stringify(allImagePaths);
      } else if (req.body.existing_images !== undefined) {
        updates.image_name = JSON.stringify(existingImages.map(p => p.split('/').pop()));
        updates.image_path = JSON.stringify(existingImages);
      }
    }

    const updatedOrder = await updateOrder(orderId, updates);

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Filter sensitive fields for artist response
    const responseOrder = filterSensitiveFields(updatedOrder, req.user.role);

    res.json({
      success: true,
      data: responseOrder,
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
 * @access  Private (Admin, SuperAdmin, B2B User)
 */
router.delete('/:id', requireRole(['Admin', 'SuperAdmin', 'B2B User']), async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    // B2B users can only delete orders from their own company
    if (req.user.role === 'B2B User') {
      const existingOrder = await getOrderById(orderId);
      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }
      if (existingOrder.company_id !== req.user.company_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You can only delete orders from your company'
        });
      }
    }

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
