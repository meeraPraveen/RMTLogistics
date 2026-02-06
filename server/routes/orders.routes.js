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
import { uploadOrderImage, uploadOrderFiles } from '../config/upload.config.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Filter out 'Ready to Print' orders for Artists and Lead Artists
    let orders = result.orders;
    if (['Artist', 'Lead Artist'].includes(req.user.role)) {
      orders = orders.filter(order => order.status !== 'Ready to Print');
    }

    // Filter sensitive fields for Artist roles
    const filteredOrders = orders.map(order => filterSensitiveFields(order, req.user.role));

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
router.post('/', requireRole(['Admin', 'SuperAdmin', 'B2B User']), prepareNewOrderUpload, uploadOrderFiles.fields([
  { name: 'images', maxCount: 5 },
  { name: 'models', maxCount: 3 }
]), async (req, res) => {
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
      // Custom engraving text
      custom_engraving: req.body.custom_engraving || null,
      // Parse numeric values
      unit_rate: req.body.unit_rate ? parseFloat(req.body.unit_rate) : null,
      total_amount: req.body.total_amount ? parseFloat(req.body.total_amount) : null,
      company_id: effectiveCompanyId, // UUID string, not integer
      assigned_artist_id: req.body.assigned_artist_id ? parseInt(req.body.assigned_artist_id) : null,
      assigned_qc_id: req.body.assigned_qc_id ? parseInt(req.body.assigned_qc_id) : null,
    };

    // Add image information if uploaded (supports up to 5 images)
    if (req.files && req.files.images && req.files.images.length > 0) {
      const imageNames = req.files.images.map(file => file.filename);
      const imagePaths = req.files.images.map(file => `/uploads/orders/${req.orderFolderPath}/${file.filename}`);
      orderData.image_name = JSON.stringify(imageNames);
      orderData.image_path = JSON.stringify(imagePaths);
    }

    // Add model information if uploaded (supports up to 3 models)
    if (req.files && req.files.models && req.files.models.length > 0) {
      const modelPaths = req.files.models.map(file => `/uploads/orders/${req.orderFolderPath}/models/${file.filename}`);
      orderData.model_path = JSON.stringify(modelPaths);
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
router.put('/:id', requireRole(['Artist', 'Lead Artist', 'Admin', 'SuperAdmin', 'B2B User']), prepareUpdateOrderUpload, uploadOrderFiles.fields([
  { name: 'images', maxCount: 5 },
  { name: 'models', maxCount: 3 }
]), async (req, res) => {
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

    // Artists/Lead Artists/Production Tech can ONLY update images, models, and internal_notes - no other fields
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
      if (req.files && req.files.images && req.files.images.length > 0) {
        const newImageNames = req.files.images.map(file => file.filename);
        const newImagePaths = req.files.images.map(file => `/uploads/orders/${req.orderFolderPath}/${file.filename}`);

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

      // Parse existing models from request body
      let existingModels = [];
      if (req.body.existing_models) {
        try {
          existingModels = JSON.parse(req.body.existing_models);
        } catch (e) {
          existingModels = [];
        }
      }

      // Add newly uploaded models
      if (req.files && req.files.models && req.files.models.length > 0) {
        const newModelPaths = req.files.models.map(file => `/uploads/orders/${req.orderFolderPath}/models/${file.filename}`);
        const allModelPaths = [...existingModels, ...newModelPaths].slice(0, 3);
        updates.model_path = JSON.stringify(allModelPaths);
      } else if (req.body.existing_models !== undefined) {
        updates.model_path = JSON.stringify(existingModels);
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

      updates = { ...req.body };

      // Only parse and set shipping_address if it's provided
      if (req.body.shipping_address !== undefined) {
        updates.shipping_address = typeof req.body.shipping_address === 'string'
          ? JSON.parse(req.body.shipping_address)
          : req.body.shipping_address;
      }

      // Only parse boolean values if they're provided
      if (req.body.has_background !== undefined) {
        updates.has_background = req.body.has_background === 'true' || req.body.has_background === true;
      }

      // Custom engraving text
      if (req.body.custom_engraving !== undefined) {
        updates.custom_engraving = req.body.custom_engraving || null;
      }

      // Only parse numeric values if they're provided
      if (req.body.unit_rate !== undefined) {
        updates.unit_rate = req.body.unit_rate ? parseFloat(req.body.unit_rate) : undefined;
      }
      if (req.body.total_amount !== undefined) {
        updates.total_amount = req.body.total_amount ? parseFloat(req.body.total_amount) : undefined;
      }

      // Only set company_id if provided (or if B2B User)
      if (req.body.company_id !== undefined || req.user.role === 'B2B User') {
        updates.company_id = effectiveCompanyId; // UUID string, not integer
      }

      // Only set assigned IDs if provided
      if (req.body.assigned_artist_id !== undefined) {
        updates.assigned_artist_id = req.body.assigned_artist_id ? parseInt(req.body.assigned_artist_id) : null;
      }
      if (req.body.assigned_qc_id !== undefined) {
        updates.assigned_qc_id = req.body.assigned_qc_id ? parseInt(req.body.assigned_qc_id) : null;
      }

      // Handle image updates (supports up to 5 images)
      let existingImages = [];
      if (req.body.existing_images) {
        try {
          existingImages = JSON.parse(req.body.existing_images);
        } catch (e) {
          existingImages = [];
        }
      }

      if (req.files && req.files.images && req.files.images.length > 0) {
        const newImageNames = req.files.images.map(file => file.filename);
        const newImagePaths = req.files.images.map(file => `/uploads/orders/${req.orderFolderPath}/${file.filename}`);

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

      // Handle model updates (supports up to 3 models)
      let existingModels = [];
      if (req.body.existing_models) {
        try {
          existingModels = JSON.parse(req.body.existing_models);
        } catch (e) {
          existingModels = [];
        }
      }

      if (req.files && req.files.models && req.files.models.length > 0) {
        const newModelPaths = req.files.models.map(file => `/uploads/orders/${req.orderFolderPath}/models/${file.filename}`);
        const allModelPaths = [...existingModels, ...newModelPaths].slice(0, 3);
        updates.model_path = JSON.stringify(allModelPaths);
      } else if (req.body.existing_models !== undefined) {
        updates.model_path = JSON.stringify(existingModels);
      }
    }

    // ===== AUTOMATIC WORKFLOW STATUS TRANSITIONS =====
    // 1. Pending → Processing: When artist is assigned
    if (updates.assigned_artist_id && !existingOrder.assigned_artist_id && existingOrder.status === 'Pending') {
      updates.status = 'Processing';
      console.log(`🔄 Auto-updating status: Pending → Processing (artist assigned)`);
    }

    // 2. Processing → Ready For QC: When 3D model is uploaded
    const hasExistingModels = existingOrder.model_path && existingOrder.model_path !== 'null';
    const hasNewModels = updates.model_path && updates.model_path !== 'null' && updates.model_path !== '[]';
    if (!hasExistingModels && hasNewModels && existingOrder.status === 'Processing') {
      updates.status = 'Ready For QC';
      console.log(`🔄 Auto-updating status: Processing → Ready For QC (3D model uploaded)`);
    }

    // 3. Track when order reaches 'Ready to Print' stage
    if (updates.status === 'Ready to Print' && existingOrder.status !== 'Ready to Print') {
      updates.ready_for_print_reached = true;
      console.log(`🔄 Marking order as reached Ready to Print stage`);
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
 * @route   POST /api/orders/:id/approve-qc
 * @desc    Approve QC for an order (handles both first and second QC approval)
 * @access  Private (All roles except B2B User) - QC personnel
 */
router.post('/:id/approve-qc', async (req, res) => {
  // Block B2B Users from QC approval
  if (req.user.role === 'B2B User') {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: 'B2B Users cannot approve QC'
    });
  }
  try {
    const orderId = parseInt(req.params.id);
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // QC Approval only works when status is 'Ready For QC'
    if (order.status !== 'Ready For QC') {
      return res.status(400).json({
        success: false,
        error: 'Invalid status for QC approval',
        message: `Order must be in 'Ready For QC' status. Current status: ${order.status}`
      });
    }

    // Determine next status based on workflow stage
    let newStatus;
    let updateData = {};

    if (!order.ready_for_print_reached) {
      // First QC approval: Ready For QC → Ready to Print
      newStatus = 'Ready to Print';
      updateData = {
        status: newStatus,
        ready_for_print_reached: true,
        assigned_qc_id: req.user.id // Track who approved
      };
      console.log(`✅ First QC Approval: Ready For QC → Ready to Print`);
    } else {
      // Second QC approval (after printing): Ready For QC → Completed
      newStatus = 'Completed';
      updateData = {
        status: newStatus,
        assigned_qc_id: req.user.id // Track who approved
      };
      console.log(`✅ Second QC Approval: Ready For QC → Completed`);
    }

    const updatedOrder = await updateOrder(orderId, updateData);

    res.json({
      success: true,
      data: updatedOrder,
      message: `QC approved. Status updated to: ${newStatus}`
    });
  } catch (error) {
    console.error('Error approving QC:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve QC',
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

/**
 * @route   POST /api/orders/extract-metadata
 * @desc    Extract metadata from an order image using AI
 * @access  Private (Artist, Lead Artist, Admin, SuperAdmin, B2B User)
 */
router.post('/extract-metadata', requireRole(['Artist', 'Lead Artist', 'Admin', 'SuperAdmin', 'B2B User']), async (req, res) => {
  try {
    console.log('📸 Extract metadata endpoint called');
    console.log('Request body:', req.body);

    const { imageUrl } = req.body;

    if (!imageUrl) {
      console.log('❌ No imageUrl provided');
      return res.status(400).json({
        success: false,
        error: 'Image URL is required'
      });
    }

    console.log('🔍 Processing image:', imageUrl);

    // Read the image file from the server
    const relativePath = imageUrl.replace(/^\/uploads\//, '');
    const imagePath = path.join(__dirname, '../../uploads', relativePath);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: 'Image file not found on server'
      });
    }

    // Read and encode image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Determine media type from file extension
    const ext = path.extname(imagePath).toLowerCase();
    const mediaTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    const mediaType = mediaTypeMap[ext] || 'image/jpeg';

    const prompt = `Analyze this image and extract the following metadata for creating a custom 3D figurine. Provide a concise, structured response:

1. Subject Type: Identify if the subject(s) are human, animal, bird, or other
2. Number of Subjects: Count how many subjects are in the image
3. Body Coverage: Determine if it shows full body, 3/4 body, half body, or just face/head
4. Unclear Areas: Note any parts of the body or details that are unclear, obscured, or cut off from view

Format your response as a brief description suitable for an order description field. Be specific and concise.`;

    let metadata;
    const aiProvider = process.env.AI_PROVIDER || 'gemini';

    if (aiProvider === 'gemini') {
      // Use Google Gemini
      console.log('🤖 Using Gemini AI provider');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: mediaType
        }
      };

      console.log('📤 Calling Gemini API...');
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      metadata = response.text();
      console.log('✅ Received metadata from Gemini');
    } else if (aiProvider === 'anthropic') {
      // Use Anthropic Claude
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
      });

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      metadata = message.content[0].text;
    } else {
      throw new Error(`Unsupported AI provider: ${aiProvider}. Use 'gemini' or 'anthropic'.`);
    }

    res.json({
      success: true,
      data: {
        metadata,
        imageUrl,
        provider: aiProvider
      }
    });
  } catch (error) {
    console.error('Error extracting metadata:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract metadata',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/orders/remove-background
 * @desc    Remove background from an order image using Remove.bg API
 * @access  Private (Artist, Lead Artist, Admin, SuperAdmin, B2B User)
 */
router.post('/remove-background', requireRole(['Artist', 'Lead Artist', 'Admin', 'SuperAdmin', 'B2B User']), async (req, res) => {
  try {
    console.log('🎨 Remove background endpoint called');
    console.log('Request body:', req.body);

    const { imageUrl } = req.body;

    if (!imageUrl) {
      console.log('❌ No imageUrl provided');
      return res.status(400).json({
        success: false,
        error: 'Image URL is required'
      });
    }

    console.log('🔍 Processing image:', imageUrl);

    // Read the image file from the server
    const relativePath = imageUrl.replace(/^\/uploads\//, '');
    const imagePath = path.join(__dirname, '../../uploads', relativePath);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: 'Image file not found on server'
      });
    }

    // Generate new filename with _nobg suffix
    const ext = path.extname(imagePath);
    const baseNameWithoutExt = path.basename(imagePath, ext);
    const newFileName = `${baseNameWithoutExt}_nobg${ext}`;
    const newImagePath = path.join(path.dirname(imagePath), newFileName);

    // Get Python command from environment or use default
    const pythonCmd = process.env.PYTHON_CMD || 'python';
    const scriptPath = path.join(__dirname, '../../scripts/remove_bg.py');

    console.log('🐍 Calling Python background removal script...');

    // Call Python script to remove background
    const { stdout, stderr } = await execAsync(
      `"${pythonCmd}" "${scriptPath}" "${imagePath}" "${newImagePath}"`
    );

    if (stderr && !stdout.includes('SUCCESS')) {
      throw new Error(`Python script error: ${stderr}`);
    }

    console.log('✅ Background removed successfully');

    // Generate the new URL path
    const newRelativePath = path.dirname(relativePath) + '/' + newFileName;
    const newImageUrl = `/uploads/${newRelativePath.replace(/\\/g, '/')}`;

    console.log('💾 Saved new image:', newImageUrl);

    res.json({
      success: true,
      data: {
        originalUrl: imageUrl,
        processedUrl: newImageUrl,
        message: 'Background removed successfully'
      }
    });
  } catch (error) {
    console.error('Error removing background:', error);

    // Check if it's a Python/rembg related error
    let errorMessage = error.message;

    if (error.message.includes('Python script error')) {
      errorMessage = 'Background removal failed. Make sure Python and rembg are installed.';
    } else if (error.code === 'ENOENT') {
      errorMessage = 'Python not found. Please install Python 3 and rembg library.';
    }

    res.status(500).json({
      success: false,
      error: 'Failed to remove background',
      message: errorMessage
    });
  }
});

export default router;
