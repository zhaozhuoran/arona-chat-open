ALTER TABLE user_profile ADD COLUMN total_requests INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_profile ADD COLUMN total_prompt_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_profile ADD COLUMN total_completion_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_profile ADD COLUMN total_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_profile ADD COLUMN total_cost_usd REAL NOT NULL DEFAULT 0;
ALTER TABLE user_profile ADD COLUMN usage_by_model_json TEXT;
