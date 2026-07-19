-- Seed script for E2E testing (single-user)
INSERT OR IGNORE INTO profiles (
    user_id,
    username,
    dynamic_background,
    theme,
    send_shortcut,
    is_admin,
    updated_at
) VALUES (
    'single-user',
    'Test Sensei',
    1,
    'standard',
    'ctrl_enter',
    1,
    strftime('%s', 'now') * 1000
);

-- Ensure a default workspace exists for the test user
INSERT OR IGNORE INTO workspaces (
    id,
    name,
    user_id,
    created_at,
    updated_at
) VALUES (
    'default',
    'Default Workspace',
    'single-user',
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- Set some default app settings for the test user
INSERT OR IGNORE INTO app_settings (key, value, user_id, updated_at)
VALUES ('selected_model', 'google/gemini-3-flash-preview', 'single-user', strftime('%s', 'now') * 1000);

INSERT OR IGNORE INTO app_settings (key, value, user_id, updated_at)
VALUES ('active_workspace_id', 'default', 'single-user', strftime('%s', 'now') * 1000);
