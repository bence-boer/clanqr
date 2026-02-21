-- Add model column to features for model selection per feature/run
ALTER TABLE features ADD COLUMN IF NOT EXISTS model TEXT DEFAULT NULL;
