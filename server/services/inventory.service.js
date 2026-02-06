import { query, getClient } from '../config/database.js';

/**
 * Inventory Service - Handles product catalog and stock management
 */

// SKU parsing maps
const SHAPE_MAP = { HRT: 'Heart', REC: 'Rectangle', SQR: 'Square', ICB: 'Iceberg', DMD: 'Diamond' };
const SIZE_MAP = { XS: 'XSmall', SM: 'Small', MD: 'Medium', LG: 'Large', XL: 'XLarge' };
const BASE_MAP = { N: 'Standard', P: 'Premium' };
const ORIENT_MAP = { P: 'Portrait', L: 'Landscape' };

function parseSku(sku) {
  const parts = sku.split('-');

  if (parts.length === 2) {
    return {
      product_line: parts[0],
      shape: SHAPE_MAP[parts[1]] || parts[1],
      size: null,
      base_type: null,
      orientation: null,
      is_parent: true,
      parent_sku: null,
      display_name: `Crystal ${SHAPE_MAP[parts[1]] || parts[1]}`
    };
  }

  if (parts.length === 5) {
    const shape = SHAPE_MAP[parts[1]] || parts[1];
    const size = SIZE_MAP[parts[2]] || parts[2];
    const base = BASE_MAP[parts[3]] || parts[3];
    const orient = ORIENT_MAP[parts[4]] || parts[4];
    return {
      product_line: parts[0],
      shape,
      size,
      base_type: base,
      orientation: orient,
      is_parent: false,
      parent_sku: `${parts[0]}-${parts[1]}`,
      display_name: `Crystal ${shape} - ${size} - ${base} - ${orient}`
    };
  }

  return {
    product_line: parts[0],
    shape: parts[1] ? (SHAPE_MAP[parts[1]] || parts[1]) : null,
    size: null,
    base_type: null,
    orientation: null,
    is_parent: false,
    parent_sku: null,
    display_name: sku
  };
}

/**
 * Get all products with pagination and filters
 */
export const getAllProducts = async (options = {}) => {
  try {
    const { page = 1, limit = 25, shape, size, base_type, search, low_stock, is_active, is_parent = false } = options;
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Exclude parent SKUs by default
    if (is_parent === false) {
      conditions.push('is_parent = false');
    } else if (is_parent === true) {
      conditions.push('is_parent = true');
    }

    if (shape) {
      conditions.push(`shape = $${paramIndex++}`);
      params.push(shape);
    }

    if (size) {
      conditions.push(`size = $${paramIndex++}`);
      params.push(size);
    }

    if (base_type) {
      conditions.push(`base_type = $${paramIndex++}`);
      params.push(base_type);
    }

    if (search) {
      conditions.push(`(sku ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (low_stock) {
      conditions.push('stock_quantity < low_stock_threshold');
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM products ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated products
    params.push(limit, offset);
    const result = await query(
      `SELECT * FROM products ${whereClause}
       ORDER BY shape, size, base_type, orientation
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      products: result.rows.map(p => ({
        ...p,
        price: parseFloat(p.price),
        weight: p.weight ? parseFloat(p.weight) : null
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

/**
 * Get product by ID
 */
export const getProductById = async (productId) => {
  try {
    const result = await query('SELECT * FROM products WHERE id = $1', [productId]);
    if (result.rows.length === 0) return null;
    return {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price),
      weight: result.rows[0].weight ? parseFloat(result.rows[0].weight) : null
    };
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    throw error;
  }
};

/**
 * Get product by SKU
 */
export const getProductBySku = async (sku) => {
  try {
    const result = await query('SELECT * FROM products WHERE sku = $1', [sku]);
    if (result.rows.length === 0) return null;
    return {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price),
      weight: result.rows[0].weight ? parseFloat(result.rows[0].weight) : null
    };
  } catch (error) {
    console.error('Error fetching product by SKU:', error);
    throw error;
  }
};

/**
 * Create a new product
 */
export const createProduct = async (productData) => {
  try {
    const { sku, price, weight = null, stock_quantity = 0, low_stock_threshold = 50 } = productData;

    if (!sku || !price) {
      throw new Error('SKU and price are required');
    }

    const parsed = parseSku(sku);

    const result = await query(
      `INSERT INTO products (
        sku, product_line, shape, size, base_type, orientation,
        display_name, is_parent, parent_sku, price, weight, stock_quantity,
        low_stock_threshold, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
      RETURNING *`,
      [
        sku, parsed.product_line, parsed.shape, parsed.size,
        parsed.base_type, parsed.orientation, parsed.display_name,
        parsed.is_parent, parsed.parent_sku, price, weight,
        stock_quantity, low_stock_threshold
      ]
    );

    return {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price),
      weight: result.rows[0].weight ? parseFloat(result.rows[0].weight) : null
    };
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

/**
 * Update a product (whitelist approach)
 */
export const updateProduct = async (productId, updates) => {
  try {
    const allowedFields = ['price', 'weight', 'stock_quantity', 'low_stock_threshold', 'is_active'];
    const setters = [];
    const params = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setters.push(`${field} = $${paramIndex++}`);
        params.push(updates[field]);
      }
    }

    if (setters.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(productId);
    const result = await query(
      `UPDATE products SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Product not found');
    }

    return {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price),
      weight: result.rows[0].weight ? parseFloat(result.rows[0].weight) : null
    };
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

/**
 * Soft-delete a product
 */
export const deleteProduct = async (productId) => {
  try {
    const result = await query(
      `UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [productId]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

/**
 * Adjust stock quantity with row-level locking
 */
export const adjustStock = async (sku, adjustment) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT * FROM products WHERE sku = $1 FOR UPDATE',
      [sku]
    );

    if (result.rows.length === 0) {
      throw new Error(`Product with SKU ${sku} not found`);
    }

    const product = result.rows[0];
    const newQuantity = product.stock_quantity + adjustment;

    if (newQuantity < 0) {
      throw new Error(`Insufficient stock for SKU ${sku}. Current: ${product.stock_quantity}, Requested deduction: ${Math.abs(adjustment)}`);
    }

    const updateResult = await client.query(
      'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE sku = $2 RETURNING *',
      [newQuantity, sku]
    );

    await client.query('COMMIT');
    return {
      ...updateResult.rows[0],
      price: parseFloat(updateResult.rows[0].price),
      weight: updateResult.rows[0].weight ? parseFloat(updateResult.rows[0].weight) : null
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get low stock products
 */
export const getLowStockProducts = async () => {
  try {
    const result = await query(
      `SELECT * FROM products
       WHERE stock_quantity < low_stock_threshold
       AND is_active = true AND is_parent = false
       ORDER BY stock_quantity ASC`
    );
    return result.rows.map(p => ({
      ...p,
      price: parseFloat(p.price),
      weight: p.weight ? parseFloat(p.weight) : null
    }));
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    throw error;
  }
};

/**
 * Get inventory statistics
 */
export const getInventoryStats = async () => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE is_parent = false) as total_products,
        COUNT(*) FILTER (WHERE is_active = true AND is_parent = false) as active_products,
        COUNT(*) FILTER (WHERE is_active = false AND is_parent = false) as inactive_products,
        COUNT(*) FILTER (WHERE stock_quantity < low_stock_threshold AND is_active = true AND is_parent = false) as low_stock_count,
        COUNT(*) FILTER (WHERE stock_quantity = 0 AND is_active = true AND is_parent = false) as out_of_stock_count,
        COALESCE(SUM(stock_quantity) FILTER (WHERE is_parent = false), 0) as total_stock,
        COALESCE(SUM(price * stock_quantity) FILTER (WHERE is_parent = false), 0) as total_inventory_value
      FROM products
    `);

    const stats = result.rows[0];
    return {
      total_products: parseInt(stats.total_products),
      active_products: parseInt(stats.active_products),
      inactive_products: parseInt(stats.inactive_products),
      low_stock_count: parseInt(stats.low_stock_count),
      out_of_stock_count: parseInt(stats.out_of_stock_count),
      total_stock: parseInt(stats.total_stock),
      total_inventory_value: parseFloat(stats.total_inventory_value)
    };
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    throw error;
  }
};

/**
 * Get product catalog for SKU dropdowns (lightweight)
 */
export const getProductCatalog = async () => {
  try {
    const result = await query(
      `SELECT id, sku, display_name, price, weight, stock_quantity, shape, size, base_type, orientation
       FROM products
       WHERE is_active = true AND is_parent = false
       ORDER BY shape, size, base_type, orientation`
    );
    return result.rows.map(p => ({
      ...p,
      price: parseFloat(p.price),
      weight: p.weight ? parseFloat(p.weight) : null
    }));
  } catch (error) {
    console.error('Error fetching product catalog:', error);
    throw error;
  }
};

export default {
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
};
