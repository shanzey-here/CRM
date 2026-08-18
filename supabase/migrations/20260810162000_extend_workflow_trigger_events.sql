-- Additive-only enum extension (existing values untouched) so email label
-- assignment domain_events are actually consumable by the real workflow
-- engine (src/modules/workflows/server/engine.ts filters
-- automation_workflows by trigger_event_type, typed against this enum)
-- instead of landing inert in the outbox.
ALTER TYPE workflow_trigger_event_type ADD VALUE 'email.label_added';
