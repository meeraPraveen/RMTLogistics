import express from 'express';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany
} from '../services/company.service.js';
import { requireRole } from '../middleware/rbac.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/companies
 * @desc    Get all companies with pagination and filters
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      is_active
    } = req.query;

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
 * @desc    Get company by ID
 * @access  Private (Admin, SuperAdmin)
 */
router.get('/:id', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
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
 * @desc    Create a new company
 * @access  Private (Admin, SuperAdmin)
 */
router.post('/', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const companyData = {
      ...req.body,
      // Parse JSON strings from form data
      address: typeof req.body.address === 'string'
        ? JSON.parse(req.body.address)
        : req.body.address,
      // Parse numeric values
      discount_rate: req.body.discount_rate ? parseFloat(req.body.discount_rate) : null,
    };

    // Get user ID from auth
    const createdBy = req.user.id;

    const newCompany = await createCompany(companyData, createdBy);

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
 * @access  Private (Admin, SuperAdmin)
 */
router.put('/:id', requireRole(['Admin', 'SuperAdmin']), async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);

    const updates = {
      ...req.body,
      // Parse JSON strings from form data
      address: typeof req.body.address === 'string'
        ? JSON.parse(req.body.address)
        : req.body.address,
      // Parse numeric values
      discount_rate: req.body.discount_rate ? parseFloat(req.body.discount_rate) : undefined,
    };

    const updatedCompany = await updateCompany(companyId, updates);

    if (!updatedCompany) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: updatedCompany,
      message: 'Company updated successfully'
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update company',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/companies/:id
 * @desc    Delete a company
 * @access  Private (SuperAdmin only)
 */
router.delete('/:id', requireRole(['SuperAdmin']), async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    const deleted = await deleteCompany(companyId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    res.json({
      success: true,
      message: 'Company deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete company',
      message: error.message
    });
  }
});

export default router;
