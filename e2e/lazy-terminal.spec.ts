import { test, expect } from '@playwright/test';

// Helper to complete the connection/pairing flow
async function pairAndConnect(page: any) {
  // Mock successful pairing call
  await page.route('**/api/v1/tunnel/connect', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        sessionToken: 'e2e_session_token',
        device: {
          deviceName: 'DESKTOP-WIN11-PRO',
          isOnline: true,
        },
      }),
    });
  });

  await page.goto('/?view=mobile');

  // Wait for the redesigned connection screen
  await expect(page.locator('h1:has-text("Pair with Windows PC")')).toBeVisible({ timeout: 10000 });

  // Fill code in the single input
  const input = page.locator('#pairing-code');
  await input.fill('123-456');

  // Click the single primary action button: Connect to PC
  const connectBtn = page.getByRole('button', { name: 'Connect to PC' });
  await connectBtn.click();

  // Verify transition to connected Terminal screen
  await expect(page.locator('text=DESKTOP-WIN11-PRO').first()).toBeVisible({ timeout: 10000 });

  // If initial reconciliation modal appears (due to initial sample intents), dismiss with Review Later
  const reviewLater = page.locator('button:has-text("Review Later")');
  try {
    if (await reviewLater.isVisible({ timeout: 1500 })) {
      await reviewLater.click();
    }
  } catch {}
}

test.describe('Lazy Terminal — E2E Suite', () => {

  test('1. Full Pairing Flow: Enter token and connect to Terminal workspace', async ({ page }) => {
    await page.route('**/api/v1/tunnel/connect', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          sessionToken: 'e2e_session_token',
          device: {
            deviceName: 'DESKTOP-WIN11-PRO',
            isOnline: true,
          },
        }),
      });
    });

    await page.goto('/?view=mobile');

    // Box header
    await expect(page.locator('h1')).toHaveText('Pair with Windows PC');

    // Single pairing code input
    const input = page.locator('#pairing-code');
    await input.fill('123-456');

    // Single primary action: Connect to PC
    await page.getByRole('button', { name: 'Connect to PC' }).click();

    // Verify connected terminal workspace
    await expect(page.locator('text=DESKTOP-WIN11-PRO').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('nav button:has-text("Terminal")')).toBeVisible();
  });

  test('2. Terminal Command Execution: Output streaming', async ({ page }) => {
    await pairAndConnect(page);

    // Type a command in the accessory bar input
    const termInput = page.locator('input[placeholder*="Run command"]');
    await expect(termInput).toBeVisible();
    await termInput.fill('dir');
    await termInput.press('Enter');

    // Verify command appears in the terminal buffer
    await expect(page.locator('text=dir').last()).toBeVisible({ timeout: 5000 });
  });

  test('3. Honest Offline Intent Buffering: Local persistence when PC is offline', async ({ page }) => {
    await pairAndConnect(page);

    // Navigate to More screen to toggle PC offline
    await page.locator('nav button:has-text("More")').click();
    await expect(page.locator('text=More Options & Offline Engine')).toBeVisible();

    // Click Go Offline
    const goOfflineBtn = page.locator('button:has-text("Go Offline")');
    await goOfflineBtn.click();
    await expect(page.locator('button:has-text("Reconnect PC")')).toBeVisible();

    // Return to Terminal screen
    await page.locator('nav button:has-text("Terminal")').click();

    // Verify placeholder reflects offline state
    const termInput = page.locator('input[placeholder*="Draft command"]');
    await expect(termInput).toBeVisible();

    // Type command while disconnected
    await termInput.fill('git status');
    await termInput.press('Enter');

    // Verify honest offline notice in buffer
    await expect(page.locator('text=Buffered locally (PC offline)').first()).toBeVisible({ timeout: 5000 });
  });

  test('4. Reconnection & Reconciliation: Explicit user review required', async ({ page }) => {
    await pairAndConnect(page);

    // Go offline via More screen
    await page.locator('nav button:has-text("More")').click();
    await page.locator('button:has-text("Go Offline")').click();

    // Return to Terminal and buffer an intent
    await page.locator('nav button:has-text("Terminal")').click();
    const termInput = page.locator('input[placeholder*="Draft command"]');
    await termInput.fill('git diff');
    await termInput.press('Enter');
    await expect(page.locator('text=Buffered locally (PC offline)').first()).toBeVisible();

    // Reconnect PC via More screen
    await page.locator('nav button:has-text("More")').click();
    await page.locator('button:has-text("Reconnect PC")').click();

    // Verify Reconciliation review prompt appears (explicit approval requirement)
    await expect(page.locator('text=PC Reconnected: State Synchronization')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Execute Intents Now")')).toBeVisible();

    // Click Execute Intents Now and verify reconciliation executes
    await page.locator('button:has-text("Execute Intents Now")').click();
    await expect(page.locator('text=PC Reconnected: State Synchronization')).not.toBeVisible({ timeout: 5000 });
  });

  test('5. Persistent Bottom Navigation: Terminal, Explorer, Git, Preview, More', async ({ page }) => {
    await pairAndConnect(page);

    // Explorer
    await page.locator('nav button:has-text("Explorer")').click();
    await expect(page.locator('text=Explorer').first()).toBeVisible();

    // Git
    await page.locator('nav button:has-text("Git")').click();
    await expect(page.locator('text=Source Control').first()).toBeVisible();

    // Preview
    await page.locator('nav button:has-text("Preview")').click();
    await expect(page.locator('text=Preview').first()).toBeVisible();

    // More
    await page.locator('nav button:has-text("More")').click();
    await expect(page.locator('text=More Options & Offline Engine')).toBeVisible();

    // Terminal
    await page.locator('nav button:has-text("Terminal")').click();
    await expect(page.locator('text=Terminal').first()).toBeVisible();
  });

  test('6. Dual Frontend Architecture: Switch between Mobile and Laptop Workstation', async ({ page }) => {
    // Laptop view route
    await page.goto('/?view=laptop');
    await expect(page.locator('text=Windows 11').first()).toBeVisible();
    await expect(page.locator('text=DESKTOP-WIN11-PRO').first()).toBeVisible();

    // Mobile view route
    await page.goto('/?view=mobile');
    await expect(page.locator('h1')).toHaveText('Pair with Windows PC');
    await expect(page.locator('#pairing-code')).toBeVisible();
  });

  test('7. Offline Queue Persistence: Survives reload in IndexedDB', async ({ page }) => {
    await pairAndConnect(page);

    // Go offline via More screen
    await page.locator('nav button:has-text("More")').click();
    await page.locator('button:has-text("Go Offline")').click();

    // Queue a distinctive command while offline
    await page.locator('nav button:has-text("Terminal")').click();
    const termInput = page.locator('input[placeholder*="Draft command"]');
    await termInput.fill('cargo check --workspace');
    await termInput.press('Enter');
    await expect(page.locator('text=Buffered locally (PC offline)').first()).toBeVisible();

    // Reload the page and pair again — queued intent must survive in IndexedDB
    await page.reload();
    await expect(page.locator('h1:has-text("Pair with Windows PC")')).toBeVisible({ timeout: 10000 });
    await page.locator('#pairing-code').fill('123-456');
    await page.getByRole('button', { name: 'Connect to PC' }).click();

    // Reconciliation modal should appear and list our persisted command
    await expect(page.locator('text=PC Reconnected: State Synchronization')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=cargo check --workspace')).toBeVisible();
  });

});
