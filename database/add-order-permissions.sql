-- Add Order Management permissions to SuperAdmin and Admin roles

-- Check if permissions already exist
DO $$
BEGIN
    -- Add for SuperAdmin
    IF NOT EXISTS (
        SELECT 1 FROM role_permissions
        WHERE role = 'SuperAdmin' AND module = 'order_management'
    ) THEN
        INSERT INTO role_permissions (role, module, permissions)
        VALUES ('SuperAdmin', 'order_management', '["read", "write", "update", "delete"]'::jsonb);
        RAISE NOTICE 'Added Order Management permissions for SuperAdmin';
    ELSE
        RAISE NOTICE 'Order Management permissions already exist for SuperAdmin';
    END IF;

    -- Add for Admin
    IF NOT EXISTS (
        SELECT 1 FROM role_permissions
        WHERE role = 'Admin' AND module = 'order_management'
    ) THEN
        INSERT INTO role_permissions (role, module, permissions)
        VALUES ('Admin', 'order_management', '["read", "write", "update", "delete"]'::jsonb);
        RAISE NOTICE 'Added Order Management permissions for Admin';
    ELSE
        RAISE NOTICE 'Order Management permissions already exist for Admin';
    END IF;
END$$;

-- Verify the permissions were added
SELECT role, module, permissions
FROM role_permissions
WHERE module = 'order_management'
ORDER BY role;
