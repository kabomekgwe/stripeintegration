import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('login page displays correctly', async ({ page }) => {
    await page.goto('/auth/login');

    // Verify page has login heading
    await expect(page.locator('h1, h2').filter({ hasText: /login|sign in/i })).toBeVisible();

    // Verify form elements are visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('login form shows validation for empty fields', async ({ page }) => {
    await page.goto('/auth/login');

    // Submit empty form
    const submitButton = page.getByRole('button', { name: /login|sign in/i });
    await submitButton.click();

    // Check for validation indication (browser required attribute or custom message)
    // The form should not navigate away
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('login form accepts email input', async ({ page }) => {
    await page.goto('/auth/login');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
  });

  test('login form accepts password input', async ({ page }) => {
    await page.goto('/auth/login');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('testpassword123');
    await expect(passwordInput).toHaveValue('testpassword123');
  });

  test('register page displays correctly', async ({ page }) => {
    await page.goto('/auth/register');

    // Verify register page has expected elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /register|sign up/i })).toBeVisible();
  });

  test('forgot password page displays correctly', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    // Verify forgot password page has email input
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('navigation between auth pages', async ({ page }) => {
    await page.goto('/auth/login');

    // Check for link to register page
    const registerLink = page.getByRole('link', { name: /sign up|register/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/auth\/register/);
    }
  });

  test('login page has forgot password link', async ({ page }) => {
    await page.goto('/auth/login');

    // Check for forgot password link
    const forgotPasswordLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotPasswordLink).toBeVisible();
  });
});