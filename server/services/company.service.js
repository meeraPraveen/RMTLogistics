import { query } from '../config/database.js';

/**
 * Company Service - Handles B2B company operations
 */

/**
 * Generate company code
 * Format: B2B-##### (e.g., B2B-00001)
 */
export const generateCompanyCode = async () => {
  try {
    const prefix = 'B2B-';

    // Get the latest company code
    const result = await query(
      `SELECT company_code FROM companies
       WHERE company_code LIKE $1
       ORDER BY company_code DESC
       LIMIT 1`,
      [`${prefix}%`]
    );

    if (result.rows.length === 0) {
      // First company
      return `${prefix}00001`;
    }

    // Extract number and increment
    const lastCode = result.rows[0].company_code;
    const lastNumber = parseInt(lastCode.split('-')[1]);
    const newNumber = (lastNumber + 1).toString().padStart(5, '0');

    return `${prefix}${newNumber}`;
  } catch (error) {
    console.error('Error generating company code:', error);
    throw error;
  }
};

/**
 * Create a new company
 * @param {Object} companyData - Company information
 * @param {number} createdBy - User ID creating the company
 * @returns {Promise<Object>} - Created company
 */
export const createCompany = async (companyData, createdBy) => {
  try {
    const {
      company_name,
      contact_person,
      email,
      phone,
      address,
      tax_id,
      notes
    } = companyData;

    // Generate company code
    const company_code = await generateCompanyCode();

    const result = await query(
      `INSERT INTO companies (
        company_code, company_name, contact_person, email, phone,
        address, tax_id, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        company_code, company_name, contact_person, email, phone,
        address, tax_id, notes, createdBy
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating company:', error);
    throw error;
  }
};

/**
 * Get all companies with pagination
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Companies and pagination info
 */
export const getAllCompanies = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 25,
      is_active,
      search
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (search) {
      conditions.push(`(
        company_code ILIKE $${paramIndex} OR
        company_name ILIKE $${paramIndex} OR
        contact_person ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM companies ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated companies
    params.push(limit, offset);
    const result = await query(
      `SELECT * FROM companies
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      companies: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching companies:', error);
    throw error;
  }
};

/**
 * Get company by ID
 * @param {number} companyId - Company ID
 * @returns {Promise<Object>} - Company details
 */
export const getCompanyById = async (companyId) => {
  try {
    const result = await query(
      'SELECT * FROM companies WHERE id = $1',
      [companyId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching company:', error);
    throw error;
  }
};

/**
 * Update company
 * @param {number} companyId - Company ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated company
 */
export const updateCompany = async (companyId, updates) => {
  try {
    const allowedFields = [
      'company_name', 'contact_person', 'email', 'phone',
      'address', 'tax_id', 'notes', 'is_active'
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

    params.push(companyId);

    const result = await query(
      `UPDATE companies
       SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Company not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error updating company:', error);
    throw error;
  }
};

/**
 * Delete company
 * @param {number} companyId - Company ID
 * @returns {Promise<boolean>} - Success status
 */
export const deleteCompany = async (companyId) => {
  try {
    const result = await query(
      'DELETE FROM companies WHERE id = $1',
      [companyId]
    );

    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting company:', error);
    throw error;
  }
};
