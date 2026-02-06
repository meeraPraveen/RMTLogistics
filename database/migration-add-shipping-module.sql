-- Migration: Add Shipping Module Permissions
-- Adds permissions for the new Shipping module for Shippo integration
-- Accessible by: Admin, SuperAdmin, and Production Tech roles

-- Add shipping module permissions
INSERT INTO role_permissions (role, module, permissions) VALUES
-- SuperAdmin - Full access to shipping module
('SuperAdmin', 'shipping', '["read", "write", "update", "delete"]'),

-- Admin - Full access to shipping module
('Admin', 'shipping', '["read", "write", "update", "delete"]'),

-- Production Tech - Read, write, and update access to shipping module
('Production Tech', 'shipping', '["read", "write", "update"]')

ON CONFLICT (role, module) DO NOTHING;

-- Verify the permissions
SELECT 'Shipping module permissions created:' as info, COUNT(*) as count
FROM role_permissions
WHERE module = 'shipping';

SELECT role, module, permissions
FROM role_permissions
WHERE module = 'shipping'
ORDER BY role;
