-- Migration: Add Failed Sync Operations Table
-- Tracks Auth0 sync operations that failed and need retry

-- Create failed_sync_operations table
CREATE TABLE IF NOT EXISTS failed_sync_operations (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL,  -- 'delete', 'create', 'update'
    auth0_user_id VARCHAR(255),           -- Auth0 user ID (if known)
    email VARCHAR(255),                   -- User email (for reference)
    payload JSONB,                        -- Original operation data
    error_message TEXT,                   -- Last error message
    retry_count INTEGER DEFAULT 0,        -- Number of retry attempts
    max_retries INTEGER DEFAULT 5,        -- Maximum retry attempts
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_retry_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_failed_sync_status ON failed_sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_failed_sync_operation_type ON failed_sync_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_failed_sync_created_at ON failed_sync_operations(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_failed_sync_operations_updated_at
    BEFORE UPDATE ON failed_sync_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE failed_sync_operations IS 'Tracks Auth0 sync operations that failed and need retry';
COMMENT ON COLUMN failed_sync_operations.operation_type IS 'Type of operation: delete, create, or update';
COMMENT ON COLUMN failed_sync_operations.status IS 'Current status: pending (needs retry), completed (succeeded), failed (max retries exceeded)';

SELECT 'Migration complete! Added failed_sync_operations table.' as message;
