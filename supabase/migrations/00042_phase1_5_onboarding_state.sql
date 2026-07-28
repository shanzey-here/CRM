-- Add onboarding_state to tenant_settings
-- Allowed values: 'pending', 'skipped', 'completed'

ALTER TABLE tenant_settings
ADD COLUMN onboarding_state text DEFAULT 'pending';

-- Add a check constraint to ensure only valid states are used
ALTER TABLE tenant_settings
ADD CONSTRAINT check_onboarding_state 
CHECK (onboarding_state IN ('pending', 'skipped', 'completed'));
