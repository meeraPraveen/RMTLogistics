import express from 'express';
import { requireSuperAdmin } from '../middleware/rbac.middleware.js';
import {
  getAllFailedSyncs,
  retryFailedSync,
  retryAllPendingFailedSyncs,
  deleteFailedSync,
  cleanupOldFailedSyncs
} from '../services/failedSync.service.js';

const router = express.Router();

/**
 * GET /api/admin/failed-syncs
 * Get all failed sync operations with optional filters
 * Query params: status, type, page, limit
 * Accessible by SuperAdmin only
 */
router.get('/failed-syncs', requireSuperAdmin, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 25 } = req.query;

    const result = await getAllFailedSyncs({
      status,
      type,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching failed syncs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch failed sync operations',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/failed-syncs/:id/retry
 * Retry a specific failed sync operation
 * Accessible by SuperAdmin only
 */
router.post('/failed-syncs/:id/retry', requireSuperAdmin, async (req, res) => {
  try {
    const operationId = parseInt(req.params.id);

    const result = await retryFailedSync(operationId);

    res.json({
      success: result.success,
      message: result.message,
      operation: result.operation
    });
  } catch (error) {
    console.error('Error retrying failed sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry sync operation',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/failed-syncs/retry-all
 * Retry all pending failed sync operations
 * Accessible by SuperAdmin only
 */
router.post('/failed-syncs/retry-all', requireSuperAdmin, async (req, res) => {
  try {
    const result = await retryAllPendingFailedSyncs();

    res.json({
      success: true,
      message: `Processed ${result.total} operations: ${result.succeeded} succeeded, ${result.failed} failed`,
      ...result
    });
  } catch (error) {
    console.error('Error retrying all failed syncs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retry sync operations',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/failed-syncs/:id
 * Delete a failed sync operation (for manual cleanup)
 * Accessible by SuperAdmin only
 */
router.delete('/failed-syncs/:id', requireSuperAdmin, async (req, res) => {
  try {
    const operationId = parseInt(req.params.id);

    const deleted = await deleteFailedSync(operationId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Failed sync operation not found'
      });
    }

    res.json({
      success: true,
      message: 'Failed sync operation deleted'
    });
  } catch (error) {
    console.error('Error deleting failed sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete sync operation',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/failed-syncs/cleanup
 * Clean up old completed/failed operations
 * Query params: daysOld (default: 30)
 * Accessible by SuperAdmin only
 */
router.post('/failed-syncs/cleanup', requireSuperAdmin, async (req, res) => {
  try {
    const daysOld = parseInt(req.query.daysOld) || 30;

    const deletedCount = await cleanupOldFailedSyncs(daysOld);

    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old failed sync records`,
      deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up failed syncs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up sync operations',
      message: error.message
    });
  }
});

export default router;
