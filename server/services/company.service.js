import { query } from '../config/database.js';
import {
  createAuth0Organization,
  updateAuth0Organization,
  deleteAuth0Organization
} from './auth0.service.js';

/**
 * Company Service - Handles company CRUD operations with Auth0 Organization sync
 */

/**
 * Get all companies with pagination
 */
export const getAllCompanies = async (options = {}) => {
  try {
    const { page = 1, limit = 25, search, is_active } = options;
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR org_id ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM companies ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await query(
      `SELECT id, org_id, name, enabled_modules, is_active, created_at, updated_at
       FROM companies ${whereClause} ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      companies: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  } catch (error) {
    console.error('Error fetching companies:', error);
    throw error;
  }
};

/**
 * Get company by ID
 */
export const getCompanyById = async (companyId) => {
  try {
    const result = await query(
      'SELECT id, org_id, name, enabled_modules, is_active, created_at, updated_at FROM companies WHERE id = $1',
      [companyId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching company:', error);
    throw error;
  }
};

/**
 * Create a new company
 * Creates in PostgreSQL first (source of truth), then syncs to Auth0 Organizations
 */
export const createCompany = async (companyData) => {
  try {
    const { name, enabled_modules = ['order_management'] } = companyData;
    console.log(`📤 Creating company: ${name}`);

    // Step 1: Create company in PostgreSQL (source of truth)
    const result = await query(
      'INSERT INTO companies (name, enabled_modules, is_active) VALUES ($1, $2, true) RETURNING *',
      [name, JSON.stringify(enabled_modules)]
    );

    const dbCompany = result.rows[0];
    console.log(`✅ Company created in DB: ${dbCompany.id}`);

    // Step 2: Create Auth0 Organization
    try {
      const auth0Org = await createAuth0Organization({
        name: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        display_name: name,
        metadata: {
          company_db_id: dbCompany.id,
          enabled_modules: JSON.stringify(enabled_modules)
        }
      });

      // Step 3: Update PostgreSQL with Auth0 org_id
      const updateResult = await query(
        'UPDATE companies SET org_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [auth0Org.org_id, dbCompany.id]
      );

      console.log(`✅ Company ${name} synced to Auth0 Organization: ${auth0Org.org_id}`);
      return updateResult.rows[0];
    } catch (auth0Error) {
      console.error(`⚠️  Company created in DB but Auth0 sync failed: ${auth0Error.message}`);
      return dbCompany;
    }
  } catch (error) {
    console.error('Error creating company:', error);
    throw error;
  }
};

/**
 * Update a company
 */
export const updateCompany = async (companyId, updateData) => {
  try {
    const { name, enabled_modules, is_active } = updateData;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (enabled_modules !== undefined) {
      updates.push(`enabled_modules = $${paramIndex++}`);
      params.push(JSON.stringify(enabled_modules));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(companyId);

    const result = await query(
      `UPDATE companies SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Company not found');
    }

    let dbCompany = result.rows[0];

    // Sync to Auth0
    try {
      if (dbCompany.org_id) {
        // Update existing Auth0 Organization
        await updateAuth0Organization(dbCompany.org_id, {
          display_name: dbCompany.name,
          metadata: {
            company_db_id: dbCompany.id,
            enabled_modules: JSON.stringify(dbCompany.enabled_modules)
          }
        });
        console.log(`✅ Company ${dbCompany.name} synced to Auth0`);
      } else {
        // Create Auth0 Organization if it doesn't exist
        const auth0Org = await createAuth0Organization({
          name: dbCompany.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          display_name: dbCompany.name,
          metadata: {
            company_db_id: dbCompany.id,
            enabled_modules: JSON.stringify(dbCompany.enabled_modules)
          }
        });

        // Update PostgreSQL with Auth0 org_id
        const updateResult = await query(
          'UPDATE companies SET org_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
          [auth0Org.org_id, dbCompany.id]
        );
        dbCompany = updateResult.rows[0];
        console.log(`✅ Company ${dbCompany.name} synced to Auth0 Organization: ${auth0Org.org_id}`);
      }
    } catch (auth0Error) {
      console.error(`⚠️  Auth0 sync failed: ${auth0Error.message}`);
    }

    return dbCompany;
  } catch (error) {
    console.error('Error updating company:', error);
    throw error;
  }
};

/**
 * Delete a company
 */
export const deleteCompany = async (companyId) => {
  try {
    const companyResult = await query('SELECT org_id, name FROM companies WHERE id = $1', [companyId]);
    if (companyResult.rows.length === 0) {
      throw new Error('Company not found');
    }

    const company = companyResult.rows[0];
    await query('DELETE FROM companies WHERE id = $1', [companyId]);
    console.log(`✅ Company ${company.name} deleted from DB`);

    // Delete from Auth0 if org_id exists
    if (company.org_id) {
      try {
        await deleteAuth0Organization(company.org_id);
        console.log(`✅ Auth0 Organization ${company.org_id} deleted`);
      } catch (auth0Error) {
        console.error(`⚠️  Auth0 deletion failed: ${auth0Error.message}`);
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting company:', error);
    throw error;
  }
};

/**
 * Toggle company active status
 */
export const toggleCompanyStatus = async (companyId) => {
  try {
    const result = await query(
      'UPDATE companies SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [companyId]
    );
    if (result.rows.length === 0) {
      throw new Error('Company not found');
    }
    return result.rows[0];
  } catch (error) {
    console.error('Error toggling company status:', error);
    throw error;
  }
};

export default {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  toggleCompanyStatus
};
