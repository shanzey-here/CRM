-- =============================================================================
-- Migration: 00080_phase2_contact_preferences.sql
-- Description: Adds preferred_contact_method and best_time_to_call to
-- contacts — properties of the person (a contact can have multiple leads
-- over time), not any single lead. Shown/edited via the existing contact
-- edit form, displayed on the Lead detail page's Contact Info card.
-- =============================================================================

CREATE TYPE contact_method AS ENUM ('phone', 'email', 'text');

ALTER TABLE contacts ADD COLUMN preferred_contact_method contact_method;
ALTER TABLE contacts ADD COLUMN best_time_to_call text;
