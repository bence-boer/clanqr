-- Split features.model into planning_model + execution_model
-- Add per-task model override

-- Add new columns to features
ALTER TABLE features ADD COLUMN planning_model text;
ALTER TABLE features ADD COLUMN execution_model text;

-- Migrate existing data: copy model to both new columns
UPDATE features SET planning_model = model, execution_model = model WHERE model IS NOT NULL;

-- Drop the old model column
ALTER TABLE features DROP COLUMN model;

-- Add model column to tasks for per-task override
ALTER TABLE tasks ADD COLUMN model text;
