import { test, expect } from '@playwright/test';

test.describe('Mobile Pairing Screen — Redesign, Validation, and Real Backend Integration', () => {

  test.beforeEach(async ({ page }) => {
    // Reset local storage adapter mode if any
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('lazy_terminal_adapter_mode');
        localStorage.removeItem('lazy_terminal_host_url');
      } catch {}
    });
  });

  test.describe('1. UI and Layout Verification', () => {
    test('renders redesigned pairing page on mobile view', async ({ page }) => {
      await page.goto('/?view=mobile');

      // The new card heading
      await expect(page.locator('h1')).toHaveText('Pair with Windows PC');

      // Primary pairing code input is present
      const pairingInput = page.locator('#pairing-code');
      await expect(pairingInput).toBeVisible();

      // Primary action button is present
      const connectBtn = page.getByRole('button', { name: 'Connect to PC' });
      await expect(connectBtn).toBeVisible();

      // Security footer is present
      await expect(page.locator('text=TLS 1.3 · Mutual Ed25519 Token Authentication')).toBeVisible();
    });

    test('obsolete header and simulated status indicators are completely removed', async ({ page }) => {
      await page.goto('/?view=mobile');

      // Obsolete dev header items
      await expect(page.locator('text=Lazy Terminal Simulator')).not.toBeVisible();
      await expect(page.locator('header button:has-text("Install Apps")')).not.toBeVisible();
      await expect(page.locator('header button:has-text("Mobile App")')).not.toBeVisible();
      await expect(page.locator('header button:has-text("Laptop App")')).not.toBeVisible();

      // Obsolete simulated status bar
      await expect(page.locator('text=09:41')).not.toBeVisible();
      await expect(page.locator('text=5G')).not.toBeVisible();
    });

    test('obsolete Laptop App Token section is completely absent', async ({ page }) => {
      await page.goto('/?view=mobile');

      await expect(page.locator('text=Laptop App Token')).not.toBeVisible();
      await expect(page.locator('button:has-text("Fill Token")')).not.toBeVisible();
      await expect(page.locator('text=Need to check laptop app? Switch View')).not.toBeVisible();
    });

    test('pairing field starts completely blank and 784-291 is not rendered', async ({ page }) => {
      await page.goto('/?view=mobile');

      const pairingInput = page.locator('#pairing-code');
      await expect(pairingInput).toBeVisible();

      // Field value must be blank
      const val = await pairingInput.inputValue();
      expect(val).toBe('');

      // 784-291 must not appear anywhere on initial load
      await expect(page.locator('text=784-291')).not.toBeVisible();
      expect(await page.locator('body').textContent()).not.toContain('784-291');
    });

    test('real Lazy Terminal logo replaces key symbol and background watermark is decorative', async ({ page }) => {
      await page.goto('/?view=mobile');

      // Real brand logo image is rendered inside the card
      const logoImg = page.locator('img[alt="Lazy Terminal logo"]');
      await expect(logoImg).toBeVisible();
      expect(await logoImg.getAttribute('src')).toContain('icon.jpeg');

      // Background watermark has pointer-events-none and aria-hidden
      const bgWatermark = page.locator('div[aria-hidden="true"] img');
      await expect(bgWatermark).toBeAttached();

      // Clicking in the center of the screen does not get intercepted by the background watermark
      const input = page.locator('#pairing-code');
      await input.click();
      await expect(input).toBeFocused();
    });

    test('works properly at mobile viewport with no horizontal overflow', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/?view=mobile');

      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(isOverflowing).toBe(false);

      await expect(page.locator('#pairing-code')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Connect to PC' })).toBeVisible();
    });
  });

  test.describe('2. Validation and Connection Flow', () => {
    test('empty input disables submit and handles empty submission attempt', async ({ page }) => {
      await page.goto('/?view=mobile');

      const submitBtn = page.getByRole('button', { name: 'Connect to PC' });
      await expect(submitBtn).toBeDisabled();

      // Try typing spaces then deleting
      const input = page.locator('#pairing-code');
      await input.fill('   ');
      await expect(submitBtn).toBeDisabled();
    });

    test('invalid or incomplete input shows actionable validation message', async ({ page }) => {
      await page.goto('/?view=mobile');

      const input = page.locator('#pairing-code');
      await input.fill('123'); // Less than 6 digits

      // Submit via Enter key
      await input.press('Enter');

      // Actionable error message
      const alert = page.locator('div[role="alert"]');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText('Pairing code must be 6 digits');
    });

    test('auto-formats input cleanly with hyphen as digits are entered', async ({ page }) => {
      await page.goto('/?view=mobile');

      const input = page.locator('#pairing-code');
      await input.fill('481920');

      // Should automatically format to 481-920
      await expect(input).toHaveValue('481-920');
    });

    test('submitting valid code triggers API request and shows loading state without duplicate submission', async ({ page }) => {
      let requestPayload: any = null;
      let requestCount = 0;

      // Intercept pairing connect call with artificial delay
      await page.route('**/api/v1/tunnel/connect', async (route) => {
        requestCount++;
        requestPayload = route.request().postDataJSON();
        await new Promise((r) => setTimeout(r, 600));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            sessionToken: 'test_token_abc123',
            device: {
              deviceName: 'DESKTOP-TEST-PC',
              isOnline: true,
            },
          }),
        });
      });

      await page.goto('/?view=mobile');

      const input = page.locator('#pairing-code');
      await input.fill('654-321');

      const submitBtn = page.getByRole('button', { name: 'Connect to PC' });
      await submitBtn.click();

      // Loading state: button text changes and input is disabled
      const loadingIndicator = page.locator('text=Connecting to PC...');
      await expect(loadingIndicator).toBeVisible();
      await expect(input).toBeDisabled();

      // Verify button is disabled during verification to prevent duplicate submissions
      const activeSubmitBtn = page.locator('button[type="submit"]');
      await expect(activeSubmitBtn).toBeDisabled();

      // Verify exactly one request is in-flight
      expect(requestCount).toBe(1);

      // Verify payload received by the backend
      expect(requestPayload).toMatchObject({ pairingKey: '654-321' });

      // Successful connection transitions to terminal workspace and shows device info
      await expect(page.locator('text=DESKTOP-TEST-PC').first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('nav button:has-text("Terminal")')).toBeVisible();
    });

    test('invalid or expired pairing codes display structured error message and retry button', async ({ page }) => {
      await page.route('**/api/v1/tunnel/connect', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            errorMessage: 'Pairing key rejected by Windows host. Please check the 6-digit key displayed on your PC.',
          }),
        });
      });

      await page.goto('/?view=mobile');

      const input = page.locator('#pairing-code');
      await input.fill('999-999');

      const submitBtn = page.getByRole('button', { name: 'Connect to PC' });
      await submitBtn.click();

      // Alert displays the exact error message
      const alert = page.locator('div[role="alert"]');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText('Pairing key rejected by Windows host');

      // Failed request never produces a false connected state
      await expect(page.locator('nav button:has-text("Terminal")')).not.toBeVisible();
      await expect(page.locator('#pairing-code')).toBeVisible();

      // Retry button resets error and focuses input
      const retryBtn = page.locator('button:has-text("Retry")');
      await expect(retryBtn).toBeVisible();
      await retryBtn.click();
      await expect(alert).not.toBeVisible();
      await expect(input).toBeFocused();
    });

    test('network failure allows user to retry and never marks device as connected', async ({ page }) => {
      await page.route('**/api/v1/tunnel/connect', async (route) => {
        await route.abort('failed');
      });

      await page.goto('/?view=mobile');

      const input = page.locator('#pairing-code');
      await input.fill('111-222');

      const submitBtn = page.getByRole('button', { name: 'Connect to PC' });
      await submitBtn.click();

      // Shows unreachable message
      const alert = page.locator('div[role="alert"]');
      await expect(alert).toBeVisible();

      // Must NEVER show connected state on failure
      await expect(page.locator('nav button:has-text("Terminal")')).not.toBeVisible();
      await expect(submitBtn).toBeVisible();
    });
  });

  test.describe('3. Regression and Accessibility', () => {
    test('unrelated routes continue to render properly', async ({ page }) => {
      // Portal route
      await page.goto('/?view=portal');
      await expect(page.locator('text=Download APK')).toBeVisible();
      await expect(page.locator('text=Download EXE')).toBeVisible();

      // Laptop route
      await page.goto('/?view=laptop');
      await expect(page.locator('text=Windows 11').first()).toBeVisible();
    });

    test('accessible controls and keyboard-operable submit', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('pageerror', (err) => consoleErrors.push(err.message));

      await page.goto('/?view=mobile');

      // Accessible label
      const label = page.locator('label[for="pairing-code"]');
      await expect(label).toHaveText('Pairing Code');

      // Accessible button
      const button = page.getByRole('button', { name: 'Connect to PC' });
      await expect(button).toBeVisible();

      // Keyboard navigation: focus input, type, press enter
      const input = page.locator('#pairing-code');
      await input.focus();
      await page.keyboard.type('123456');

      // Route mock to prevent unhandled rejection
      await page.route('**/api/v1/tunnel/connect', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, errorMessage: 'Test rejection' }),
        });
      });

      await page.keyboard.press('Enter');

      // Form submits via keyboard
      await expect(page.locator('div[role="alert"]')).toBeVisible();

      // No unhandled page errors
      expect(consoleErrors).toEqual([]);
    });
  });

});
