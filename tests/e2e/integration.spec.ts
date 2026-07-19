import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // E2E tests use the test token bypass
  // We need to set the token in localStorage before the app initializes
  await page.goto('/');
  await page.evaluate((token) => {
    localStorage.setItem('arona-chat.auth-token', token);
  }, 'test-token-123');

  await page.reload();

  // Wait for boot loader and sidebar (authenticated state)
  await expect(page.locator('.ba-sidebar')).toBeVisible({ timeout: 20000 });
});

test('real backend integration: send message and receive response', async ({ page }) => {
  // Ensure we are NOT in preview mode
  await expect(page.locator('.ba-preview-banner')).not.toBeVisible();

  const textarea = page.locator('.ba-composer-shell textarea');
  await textarea.fill('What is Blue Archive?');
  await page.keyboard.press('Control+Enter');

  // Verify user message
  await expect(page.locator('.ba-message.is-user')).toContainText('What is Blue Archive?');

  // Verify assistant message appears (real backend response)
  // Since it's a real backend, we might need a longer timeout
  await expect(page.locator('.ba-message.is-assistant')).toBeVisible({ timeout: 30000 });
});

test('persistence: session history is preserved', async ({ page }) => {
  // Send a message to create a session
  const textarea = page.locator('.ba-composer-shell textarea');
  await textarea.fill('Testing persistence');
  await page.keyboard.press('Control+Enter');

  await expect(page.locator('.ba-message.is-assistant')).toBeVisible({ timeout: 30000 });

  // Reload page
  await page.reload();

  // Verify session exists in sidebar (either generated title or default "New Chat" on upstream auth failure)
  const sessionItem = page.locator('.ba-session-item').first();
  await expect(sessionItem).toBeVisible();
});

test('settings: theme switching works', async ({ page }) => {
  // Open settings
  const settingsBtn = page.locator('.ba-secondary-btn').filter({ hasText: 'Settings' }).first();
  await settingsBtn.click();

  // Switch to Appearance tab
  const appearanceTabBtn = page.locator('.ba-settings-tab').filter({ hasText: 'Appearance' }).first();
  await appearanceTabBtn.click();

  // Switch to Ethereal Light theme
  const themeCard = page.locator('.theme-preview-card.ethereal-light');
  await themeCard.click();

  // Verify theme class on body
  await expect(page.locator('body')).toHaveClass(/theme-ethereal-light/);

  // Reload and verify persistence
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/theme-ethereal-light/);
});
