import express from 'express';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  toggleCompanyStatus
} from '../services/company.service.js';
import {
  getCompanyUsers,
  createCompanyUser,
  updateCompanyUser,
  deleteCompanyUser,
  toggleCompanyUserStatus
} from '../services/companyUsers.service.js';
import { requireRole, requireSuperAdmin } from '../middleware/rbac.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/companies
 * @desc    Get all companies with pagination and filters
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const { page = 1, limit = 25, search, is_active } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      is_active: is_active !== undefined ? is_active === 'true' : undefined
    };

    const result = await getAllCompanies(options);

    res.json({
      success: true,
      data: result.companies,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companies',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/companies/:id
 * @desc    Get company by ID (UUID)
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/:id', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const companyId = req.params.id; // UUID
    const company = await getCompanyById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/companies
 * @desc    Create a new company (also creates Auth0 Organization)
 * @access  Private (SuperAdmin only)
 */
router.post('/', requireSuperAdmin, async (req, res) => {
  try {
    const { name, enabled_modules } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Company name is required'
      });
    }

    const newCompany = await createCompany({
      name,
      enabled_modules: enabled_modules || ['order_management']
    });

    res.status(201).json({
      success: true,
      data: newCompany,
      message: 'Company created successfully'
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create company',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/companies/:id
 * @desc    Update a company
 * @access  Private (SuperAdmin only)
 */
router.put('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.params.id; // UUID
    const { name, enabled_modules, is_active } = req.body;

    const updatedCompany = await updateCompany(companyId, {
      name,
      enabled_modules,
      is_active
    });

    res.json({
      success: true,
      data: updatedCompany,
      message: 'Company updated successfully'
    });
  } catch (error) {
    console.error('Error updating company:', error);

    if (error.message === 'Company not found') {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update company',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/companies/:id/toggle-status
 * @desc    Toggle company active status
 * @access  Private (SuperAdmin only)
 */
router.post('/:id/toggle-status', requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.params.id; // UUID
    const company = await toggleCompanyStatus(companyId);

    res.json({
      success: true,
      data: company,
      message: `Company ${company.is_active ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Error toggling company status:', error);

    if (error.message === 'Company not found') {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to toggle company status',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/companies/:id
 * @desc    Delete a company (also deletes Auth0 Organization)
 * @access  Private (SuperAdmin only)
 */
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.params.id; // UUID
    await deleteCompany(companyId);

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company:', error);

    if (error.message === 'Company not found') {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete company',
      message: error.message
    });
  }
});

// ==========================================
// Company Users Routes (B2B User Management)
// ==========================================

/**
 * @route   GET /api/companies/:id/users
 * @desc    Get all users for a company
 * @access  Private (SuperAdmin only)
 */
router.get('/:id/users', requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.params.id;
    const { page = 1, limit = 25, search, is_active } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      is_active: is_active !== undefined ? is_active === 'true' : undefined
    };

    const result = await getCompanyUsers(companyId, options);

    res.json({
      success: true,
      data: result.users,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching company users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch company users',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/companies/:id/users
 * @desc    Add a new user to a company
 * @access  Private (SuperAdmin only)
 */
router.post('/:id/users', requireSuperAdmin, async (req, res) => {
  try {
    const companyId = req.params.id;
    const { email, name, role } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Email and name are required'
      });
    }

    const user = await createCompanyUser(companyId, { email, name, role: role || null });

    res.status(201).json({
      success: true,
      message: `User ${email} added to company successfully`,
      data: user
    });
  } catch (error) {
    console.error('Error creating company user:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: error.message
      });
    }

    if (error.message.includes('not found') || error.message.includes('inactive')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid company',
        message: error.message
      });
    }

    if (error.message.includes('SuperAdmin')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create company user',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/companies/:id/users/:userId
 * @desc    Update a company user
 * @access  Private (SuperAdmin only)
 */
router.put('/:id/users/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { id: companyId, userId } = req.params;
    const { name, role, is_active } = req.body;

    const user = await updateCompanyUser(companyId, parseInt(userId), { name, role, is_active });

    res.json({
      success: true,
      message: 'Company user updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Error updating company user:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: error.message
      });
    }

    if (error.message.includes('SuperAdmin')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update company user',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/companies/:id/users/:userId/toggle-status
 * @desc    Toggle company user active status
 * @access  Private (SuperAdmin only)
 */
router.post('/:id/users/:userId/toggle-status', requireSuperAdmin, async (req, res) => {
  try {
    const { id: companyId, userId } = req.params;
    const user = await toggleCompanyUserStatus(companyId, parseInt(userId));

    res.json({
      success: true,
      message: `User ${user.is_active ? 'enabled' : 'disabled'} successfully`,
      data: user
    });
  } catch (error) {
    console.error('Error toggling company user status:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to toggle user status',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/companies/:id/users/:userId
 * @desc    Remove a user from a company
 * @access  Private (SuperAdmin only)
 */
router.delete('/:id/users/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { id: companyId, userId } = req.params;

    const user = await deleteCompanyUser(companyId, parseInt(userId));

    res.json({
      success: true,
      message: `User ${user.email} removed from company and deactivated`,
      data: user
    });
  } catch (error) {
    console.error('Error deleting company user:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to remove company user',
      message: error.message
    });
  }
});

export default router;
