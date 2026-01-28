/**
 * Failed Sync Service
 * Handles tracking and retrying failed Auth0 sync operations
 */

import { query } from '../config/database.js';
import { deleteAuth0User, updateAuth0User, createAuth0User } from './auth0.service.js';
import { withRetry, isRetryableAuth0Error } from '../utils/retry.js';

/**
 * Queue a failed sync operation for later retry
 * @param {Object} operation - Operation details
 * @param {string} operation.type - Operation type: 'delete', 'create', 'update'
 * @param {string} operation.auth0UserId - Auth0 user ID
 * @param {string} operation.email - User email
 * @param {Object} operation.payload - Original operation data
 * @param {string} operation.errorMessage - Error message from failed attempt
 * @returns {Promise<Object>} - Created failed sync record
 */
export const queueFailedSync = async (operation) => {
  try {
    const { type, auth0UserId, email, payload, errorMessage } = operation;

    const result = await query(
      `INSERT INTO failed_sync_operations
       (operation_type, auth0_user_id, email, payload, error_message, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [type, auth0UserId, email, JSON.stringify(payload), errorMessage]
    );

    console.log(`📋 Queued failed ${type} operation for ${email} (ID: ${result.rows[0].id})`);
    return result.rows[0];
  } catch (error) {
    console.error('Error queueing failed sync:', error);
    throw error;
  }
};

/**
 * Get all pending failed sync operations
 * @param {Object} options - Query options
 * @param {string} options.type - Filter by operation type
 * @param {number} options.limit - Maximum number of records
 * @returns {Promise<Array>} - Array of failed sync records
 */
export const getPendingFailedSyncs = async (options = {}) => {
  try {
    const { type, limit = 100 } = options;

    let sql = `
      SELECT * FROM failed_sync_operations
      WHERE status = 'pending' AND retry_count < max_retries
    `;
    const params = [];

    if (type) {
      params.push(type);
      sql += ` AND operation_type = $${params.length}`;
    }

    sql += ` ORDER BY created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching pending failed syncs:', error);
    throw error;
  }
};

/**
 * Get all failed sync operations (for admin view)
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Object with operations and counts
 */
export const getAllFailedSyncs = async (options = {}) => {
  try {
    const { status, type, page = 1, limit = 25 } = options;
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (type) {
      conditions.push(`operation_type = $${paramIndex++}`);
      params.push(type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get counts by status
    const countResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
        COUNT(*) as total_count
      FROM failed_sync_operations
    `);

    // Get paginated records
    params.push(limit, offset);
    const result = await query(
      `SELECT * FROM failed_sync_operations ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    return {
      operations: result.rows,
      counts: countResult.rows[0],
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total_count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total_count) / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching all failed syncs:', error);
    throw error;
  }
};

/**
 * Retry a specific failed sync operation
 * @param {number} operationId - Failed sync operation ID
 * @returns {Promise<Object>} - Result of retry attempt
 */
export const retryFailedSync = async (operationId) => {
  try {
    // Get the operation
    const opResult = await query(
      'SELECT * FROM failed_sync_operations WHERE id = $1',
      [operationId]
    );

    if (opResult.rows.length === 0) {
      throw new Error(`Failed sync operation ${operationId} not found`);
    }

    const operation = opResult.rows[0];

    if (operation.status === 'completed') {
      return { success: true, message: 'Operation already completed', operation };
    }

    if (operation.status === 'failed') {
      return { success: false, message: 'Operation has exceeded max retries', operation };
    }

    // Attempt the operation
    let result;
    try {
      switch (operation.operation_type) {
        case 'delete':
          result = await deleteAuth0User(operation.auth0_user_id);
          break;
        case 'update':
          const updatePayload = typeof operation.payload === 'string'
            ? JSON.parse(operation.payload)
            : operation.payload;
          result = await updateAuth0User(operation.auth0_user_id, updatePayload);
          break;
        case 'create':
          const createPayload = typeof operation.payload === 'string'
            ? JSON.parse(operation.payload)
            : operation.payload;
          result = await createAuth0User(createPayload);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.operation_type}`);
      }

      // Mark as completed
      await query(
        `UPDATE failed_sync_operations
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, last_retry_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [operationId]
      );

      console.log(`✅ Successfully retried ${operation.operation_type} operation for ${operation.email}`);
      return { success: true, message: 'Operation completed successfully', operation, result };

    } catch (retryError) {
      // Update retry count and error message
      const newRetryCount = operation.retry_count + 1;
      const newStatus = newRetryCount >= operation.max_retries ? 'failed' : 'pending';

      await query(
        `UPDATE failed_sync_operations
         SET retry_count = $1, error_message = $2, status = $3, last_retry_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [newRetryCount, retryError.message, newStatus, operationId]
      );

      console.error(`❌ Retry failed for ${operation.email}: ${retryError.message}`);
      return {
        success: false,
        message: `Retry failed: ${retryError.message}`,
        operation: { ...operation, retry_count: newRetryCount, status: newStatus }
      };
    }
  } catch (error) {
    console.error('Error retrying failed sync:', error);
    throw error;
  }
};

/**
 * Retry all pending failed sync operations
 * @returns {Promise<Object>} - Summary of retry results
 */
export const retryAllPendingFailedSyncs = async () => {
  try {
    const pending = await getPendingFailedSyncs({ limit: 100 });

    const results = {
      total: pending.length,
      succeeded: 0,
      failed: 0,
      details: []
    };

    for (const operation of pending) {
      const result = await retryFailedSync(operation.id);
      if (result.success) {
        results.succeeded++;
      } else {
        results.failed++;
      }
      results.details.push({
        id: operation.id,
        email: operation.email,
        type: operation.operation_type,
        success: result.success,
        message: result.message
      });
    }

    console.log(`🔄 Retry batch complete: ${results.succeeded} succeeded, ${results.failed} failed`);
    return results;
  } catch (error) {
    console.error('Error retrying all pending syncs:', error);
    throw error;
  }
};

/**
 * Delete a failed sync operation (for cleanup)
 * @param {number} operationId - Operation ID to delete
 * @returns {Promise<boolean>} - True if deleted
 */
export const deleteFailedSync = async (operationId) => {
  try {
    const result = await query(
      'DELETE FROM failed_sync_operations WHERE id = $1',
      [operationId]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting failed sync:', error);
    throw error;
  }
};

/**
 * Clean up old completed/failed operations
 * @param {number} daysOld - Delete operations older than this many days (default: 30)
 * @returns {Promise<number>} - Number of deleted records
 */
export const cleanupOldFailedSyncs = async (daysOld = 30) => {
  try {
    const result = await query(
      `DELETE FROM failed_sync_operations
       WHERE (status = 'completed' OR status = 'failed')
       AND created_at < NOW() - INTERVAL '${daysOld} days'`
    );

    console.log(`🧹 Cleaned up ${result.rowCount} old failed sync records`);
    return result.rowCount;
  } catch (error) {
    console.error('Error cleaning up old failed syncs:', error);
    throw error;
  }
};

export default {
  queueFailedSync,
  getPendingFailedSyncs,
  getAllFailedSyncs,
  retryFailedSync,
  retryAllPendingFailedSyncs,
  deleteFailedSync,
  cleanupOldFailedSyncs
};
