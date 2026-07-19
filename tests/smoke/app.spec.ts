import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Use VITE_PREVIEW_PASSWORD to login in smoke tests
  await page.goto('/');

  // Find the password input (based on AuthPanel.tsx)
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.fill('test-preview-password');

  // Click the login button
  const loginButton = page.locator('button.ba-auth-button.primary');
  await loginButton.click();

  // Wait for boot loader to complete and sidebar to be visible (authenticated state)
  // The transition animation takes some time (1.2s in App.tsx)
  await expect(page.locator('.ba-sidebar')).toBeVisible({ timeout: 15000 });
});

test('application loads and basic navigation works', async ({ page }) => {
  await expect(page).toHaveTitle(/Arona Chat/);

  // Verify preview banner is visible
  await expect(page.locator('.ba-preview-banner')).toBeVisible();
  await expect(page.locator('.ba-preview-banner')).toContainText('PREVIEW BUILD');
});

test('user can send a mocked message', async ({ page }) => {
  const textarea = page.locator('.ba-composer-shell textarea');
  await textarea.fill('Hello Arona!');
  await page.keyboard.press('Control+Enter');

  // Check for user message
  await expect(page.locator('.ba-message.is-user')).toContainText('Hello Arona!');

  // Check for assistant response (mocked in preview mode)
  // Preview mode response is streamed, so we wait for the message to appear
  await expect(page.locator('.ba-message.is-assistant')).toBeVisible({ timeout: 10000 });
});

test('navigation to settings works', async ({ page }) => {
  // Open settings
  const settingsBtn = page.locator('.ba-secondary-btn').filter({ hasText: 'Settings' }).first();
  await settingsBtn.click();

  // Verify settings panel is open
  await expect(page.locator('.ba-settings-panel')).toBeVisible();
});
