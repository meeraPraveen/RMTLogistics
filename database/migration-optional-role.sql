-- Migration: Make role column nullable for deferred role assignment
-- Users can now be created without a role. They exist in the system
-- but cannot log in until a role is assigned (Auth0 Action blocks them).

ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
