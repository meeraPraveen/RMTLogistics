import { query, getClient } from '../config/database.js';

/**
 * Order Service - Handles order database operations
 */

/**
 * Generate internal order ID
 * Format: ORD-YYYY-##### (e.g., ORD-2026-00001)
 */
export const generateInternalOrderId = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const prefix = `ORD-${currentYear}-`;

    // Get the latest order ID for current year
    const result = await query(
      `SELECT internal_order_id FROM orders
       WHERE internal_order_id LIKE $1
       ORDER BY internal_order_id DESC
       LIMIT 1`,
      [`${prefix}%`]
    );

    if (result.rows.length === 0) {
      // First order of the year
      return `${prefix}00001`;
    }

    // Extract number and increment
    const lastId = result.rows[0].internal_order_id;
    const lastNumber = parseInt(lastId.split('-')[2]);
    const newNumber = (lastNumber + 1).toString().padStart(5, '0');

    return `${prefix}${newNumber}`;
  } catch (error) {
    console.error('Error generating internal order ID:', error);
    throw error;
  }
};

/**
 * Create a new order
 * @param {Object} orderData - Order information
 * @param {number} createdBy - User ID creating the order
 * @returns {Promise<Object>} - Created order
 */
export const createOrder = async (orderData, createdBy) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      internal_order_id: providedOrderId,
      order_type,
      platform_order_id,
      order_item_id,
      company_id,
      customer_email,
      shipping_address,
      description,
      num_figures,
      sku,
      product_id,
      shape,
      size,
      orientation,
      base_type,
      dimensions,
      has_background,
      has_text,
      unit_rate,
      total_amount,
      image_name,
      image_path,
      comments
    } = orderData;

    // If SKU provided, look up product price as fallback for unit_rate
    let finalUnitRate = unit_rate;
    if (sku && !unit_rate) {
      const productResult = await client.query(
        'SELECT price FROM products WHERE sku = $1 AND is_active = true',
        [sku]
      );
      if (productResult.rows.length > 0) {
        finalUnitRate = productResult.rows[0].price;
      }
    }

    // Use provided order ID or generate a new one
    const internal_order_id = providedOrderId || await generateInternalOrderId();

    const result = await client.query(
      `INSERT INTO orders (
        internal_order_id, order_type, platform_order_id, order_item_id,
        company_id, customer_email, shipping_address, description, num_figures,
        sku, product_id, shape, size, orientation, base_type, dimensions,
        has_background, has_text, unit_rate, total_amount,
        image_name, image_path, comments, date_submitted, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, CURRENT_TIMESTAMP, $24
      ) RETURNING *`,
      [
        internal_order_id, order_type, platform_order_id, order_item_id,
        company_id, customer_email, shipping_address, description, num_figures,
        sku, product_id, shape, size, orientation, base_type, dimensions,
        has_background, has_text, finalUnitRate, total_amount,
        image_name, image_path, comments, createdBy
      ]
    );

    // Deduct 1 from product stock if SKU provided
    if (sku) {
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - 1, updated_at = CURRENT_TIMESTAMP
         WHERE sku = $1 AND stock_quantity > 0`,
        [sku]
      );
    }

    await client.query('COMMIT');

    // Convert numeric string fields to numbers
    const order = result.rows[0];
    return {
      ...order,
      unit_rate: order.unit_rate ? parseFloat(order.unit_rate) : null,
      total_amount: order.total_amount ? parseFloat(order.total_amount) : null,
      num_figures: order.num_figures ? parseInt(order.num_figures) : null
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get all orders with pagination and filters
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Orders and pagination info
 */
export const getAllOrders = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 25,
      status,
      order_type,
      assigned_artist_id,
      company_id,
      search,
      date_from,
      date_to,
      sort = 'date_submitted',
      order = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (status) {
      conditions.push(`o.status = $${paramIndex++}`);
      params.push(status);
    }

    if (order_type) {
      conditions.push(`o.order_type = $${paramIndex++}`);
      params.push(order_type);
    }

    if (assigned_artist_id) {
      conditions.push(`o.assigned_artist_id = $${paramIndex++}`);
      params.push(assigned_artist_id);
    }

    if (company_id) {
      conditions.push(`o.company_id = $${paramIndex++}`);
      params.push(company_id);
    }

    if (search) {
      conditions.push(`(
        o.internal_order_id ILIKE $${paramIndex} OR
        o.platform_order_id ILIKE $${paramIndex} OR
        o.customer_email ILIKE $${paramIndex} OR
        o.description ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Date range filters
    if (date_from) {
      conditions.push(`o.date_submitted >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`o.date_submitted <= $${paramIndex++}`);
      params.push(date_to + ' 23:59:59');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count (with table alias to avoid ambiguous column references)
    const countResult = await query(
      `SELECT COUNT(*) FROM orders o ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Determine sort order
    // If explicit sort is provided, use it; otherwise use defaults
    let orderByClause;
    const validSortFields = ['date_submitted', 'total_amount', 'status', 'internal_order_id'];
    const sortDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    if (sort && validSortFields.includes(sort)) {
      // User requested specific sorting
      orderByClause = `ORDER BY o.${sort} ${sortDirection} NULLS LAST`;
    } else if (!company_id) {
      // Default for non-B2B users: sort by shipping address (state/city from JSON), then date ascending
      orderByClause = `ORDER BY o.shipping_address->>'state' ASC NULLS LAST, o.shipping_address->>'city' ASC NULLS LAST, o.date_submitted ASC`;
    } else {
      // Default for B2B users: sort by date ascending
      orderByClause = `ORDER BY o.date_submitted ASC`;
    }

    // Get paginated orders
    params.push(limit, offset);
    const result = await query(
      `SELECT
        o.*,
        c.name as company_name,
        u1.name as artist_name,
        u2.name as qc_name
       FROM orders o
       LEFT JOIN companies c ON o.company_id = c.id
       LEFT JOIN users u1 ON o.assigned_artist_id = u1.id
       LEFT JOIN users u2 ON o.assigned_qc_id = u2.id
       ${whereClause}
       ${orderByClause}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    // Convert numeric string fields to numbers
    const orders = result.rows.map(order => ({
      ...order,
      unit_rate: order.unit_rate ? parseFloat(order.unit_rate) : null,
      total_amount: order.total_amount ? parseFloat(order.total_amount) : null,
      num_figures: order.num_figures ? parseInt(order.num_figures) : null
    }));

    return {
      orders: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

/**
 * Get order by ID
 * @param {number} orderId - Order ID
 * @returns {Promise<Object>} - Order details
 */
export const getOrderById = async (orderId) => {
  try {
    const result = await query(
      `SELECT
        o.*,
        c.name as company_name,
        u1.name as artist_name, u1.email as artist_email,
        u2.name as qc_name, u2.email as qc_email
       FROM orders o
       LEFT JOIN companies c ON o.company_id = c.id
       LEFT JOIN users u1 ON o.assigned_artist_id = u1.id
       LEFT JOIN users u2 ON o.assigned_qc_id = u2.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (!result.rows[0]) {
      return null;
    }

    // Convert numeric string fields to numbers
    const order = result.rows[0];
    return {
      ...order,
      unit_rate: order.unit_rate ? parseFloat(order.unit_rate) : null,
      total_amount: order.total_amount ? parseFloat(order.total_amount) : null,
      num_figures: order.num_figures ? parseInt(order.num_figures) : null
    };
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
};

/**
 * Update order
 * @param {number} orderId - Order ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated order
 */
export const updateOrder = async (orderId, updates) => {
  try {
    const allowedFields = [
      'platform_order_id', 'order_item_id', 'customer_email', 'shipping_address',
      'description', 'num_figures', 'sku', 'product_id', 'shape', 'size',
      'orientation', 'base_type', 'dimensions', 'has_background', 'has_text',
      'unit_rate', 'total_amount', 'status', 'assigned_artist_id', 'assigned_qc_id',
      'comments', 'internal_notes', 'feedback', 'date_completed', 'date_shipped',
      'image_name', 'image_path'
    ];

    const setters = [];
    const params = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setters.push(`${key} = $${paramIndex++}`);
        params.push(updates[key]);
      }
    });

    if (setters.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(orderId);

    const result = await query(
      `UPDATE orders
       SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Order not found');
    }

    // Convert numeric string fields to numbers
    const order = result.rows[0];
    return {
      ...order,
      unit_rate: order.unit_rate ? parseFloat(order.unit_rate) : null,
      total_amount: order.total_amount ? parseFloat(order.total_amount) : null,
      num_figures: order.num_figures ? parseInt(order.num_figures) : null
    };
  } catch (error) {
    console.error('Error updating order:', error);
    throw error;
  }
};

/**
 * Delete order
 * @param {number} orderId - Order ID
 * @returns {Promise<boolean>} - Success status
 */
export const deleteOrder = async (orderId) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Fetch the order's SKU before deleting
    const orderResult = await client.query(
      'SELECT sku FROM orders WHERE id = $1',
      [orderId]
    );

    const result = await client.query(
      'DELETE FROM orders WHERE id = $1',
      [orderId]
    );

    // Restore 1 unit to product stock if order had a SKU
    if (result.rowCount > 0 && orderResult.rows[0]?.sku) {
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity + 1, updated_at = CURRENT_TIMESTAMP
         WHERE sku = $1`,
        [orderResult.rows[0].sku]
      );
    }

    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting order:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get order statistics
 * @param {Object} options - Query options (optional company_id for B2B filtering)
 * @returns {Promise<Object>} - Statistics
 */
export const getOrderStats = async (options = {}) => {
  try {
    const { company_id } = options;

    let whereClause = '';
    const params = [];

    if (company_id) {
      whereClause = 'WHERE company_id = $1';
      params.push(company_id);
    }

    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'Processing' THEN 1 END) as processing,
        COUNT(CASE WHEN status = 'Ready to Print' THEN 1 END) as ready_to_print,
        COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'Shipped' THEN 1 END) as shipped,
        COALESCE(SUM(total_amount), 0) as total_revenue
      FROM orders
      ${whereClause}
    `, params);

    const stats = result.rows[0];

    // Convert string counts to integers
    return {
      total: parseInt(stats.total),
      pending: parseInt(stats.pending),
      processing: parseInt(stats.processing),
      ready_to_print: parseInt(stats.ready_to_print),
      in_progress: parseInt(stats.in_progress),
      completed: parseInt(stats.completed),
      shipped: parseInt(stats.shipped),
      total_revenue: parseFloat(stats.total_revenue)
    };
  } catch (error) {
    console.error('Error fetching order stats:', error);
    throw error;
  }
};

