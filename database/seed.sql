-- Seed Data for Auth0 RBAC Application
-- Run this after schema.sql to populate initial data

-- Insert default role permissions (from rbac.config.js)
INSERT INTO role_permissions (role, module, permissions) VALUES
-- SuperAdmin - Full access to all modules
('SuperAdmin', 'user_management', '["read", "write", "update", "delete"]'),
('SuperAdmin', 'order_management', '["read", "write", "update", "delete"]'),
('SuperAdmin', 'inventory_management', '["read", "write", "update", "delete"]'),
('SuperAdmin', 'printing_software', '["read", "write", "update", "delete"]'),
('SuperAdmin', 'system_config', '["read", "write", "update", "delete"]'),

-- Admin - Order, Inventory, Printing
('Admin', 'order_management', '["read", "write", "update", "delete"]'),
('Admin', 'inventory_management', '["read", "write", "update", "delete"]'),
('Admin', 'printing_software', '["read", "write", "update", "delete"]'),

-- Lead Artist - Order Management only
('Lead Artist', 'order_management', '["read", "write", "update"]'),

-- Production Tech - Printing Software only
('Production Tech', 'printing_software', '["read", "write", "update"]')

ON CONFLICT (role, module) DO NOTHING;

-- Insert sample users
-- NOTE: Replace these auth0_user_id values with real Auth0 user IDs from your Auth0 dashboard
INSERT INTO users (auth0_user_id, email, role) VALUES
('auth0|REPLACE_WITH_REAL_ID_1', 'admin@example.com', 'SuperAdmin'),
('auth0|REPLACE_WITH_REAL_ID_2', 'manager@example.com', 'Admin'),
('auth0|REPLACE_WITH_REAL_ID_3', 'artist@example.com', 'Lead Artist'),
('auth0|REPLACE_WITH_REAL_ID_4', 'tech@example.com', 'Production Tech')
ON CONFLICT (auth0_user_id) DO NOTHING;

-- Verify the data
SELECT 'Users created:' as info, COUNT(*) as count FROM users;
SELECT 'Role permissions created:' as info, COUNT(*) as count FROM role_permissions;
