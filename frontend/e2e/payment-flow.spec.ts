import { test, expect } from '@playwright/test';

test.describe('Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home and check if we need to login
    await page.goto('/');
  });

  test('can navigate to payments page', async ({ page }) => {
    await page.goto('/payments');
    await expect(page).toHaveURL(/payments/);
  });

  test('displays payment form correctly', async ({ page }) => {
    // Navigate to payment creation page
    await page.goto('/payments/make');

    // Verify form elements are visible
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue|pay/i })).toBeVisible();
  });

  test('payment amount field accepts numeric input', async ({ page }) => {
    await page.goto('/payments/make');

    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('10.50');
    await expect(amountInput).toHaveValue('10.5');
  });

  test('payment form shows minimum amount hint', async ({ page }) => {
    await page.goto('/payments/make');

    // Check for minimum amount hint text
    await expect(page.getByText(/minimum/i)).toBeVisible();
  });

  test('payment form validates positive amount', async ({ page }) => {
    await page.goto('/payments/make');

    // Try to submit with empty amount
    const continueButton = page.getByRole('button', { name: /continue/i });
    await expect(continueButton).toBeDisabled();
  });

  test('payment flow - form interaction', async ({ page }) => {
    await page.goto('/payments/make');

    // Fill amount
    const amountInput = page.locator('input[type="number"]');
    await amountInput.fill('100');

    // Fill description if field exists
    const descriptionInput = page.locator('input[placeholder*="payment"]');
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('Test payment');
    }

    // Verify continue button becomes enabled with valid amount
    const continueButton = page.getByRole('button', { name: /continue/i });
    await expect(continueButton).toBeEnabled();
  });
});