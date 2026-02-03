import express from 'express';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  toggleCompanyStatus
} from '../services/company.service.js';
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

export default router;
