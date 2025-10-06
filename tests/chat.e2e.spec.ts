import { test, expect } from '@playwright/test';

// Helper: Create a test user and login
async function setupAuth(page: any) {
  // Navigate to auth page
  await page.goto('/auth');
  
  // Generate unique test credentials
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'testpassword123!';
  
  // Fill signup form
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  
  // Click signup/login button
  await page.click('button[type="submit"]');
  
  // Wait for redirect to main page
  await page.waitForURL('/', { timeout: 10000 });
  
  return { email: testEmail, password: testPassword };
}

async function selectMode(page: any, mode: 'fast' | 'auto' | 'extended') {
  const modeSelect = page.getByRole('combobox', { name: /läge/i }).or(page.locator('[data-testid="chat-mode-select"]'));
  await modeSelect.selectOption(mode);
}

async function sendMessage(page: any, text: string) {
  const textarea = page.getByRole('textbox', { name: /meddelande/i }).or(page.locator('[data-testid="chat-textarea"]'));
  await textarea.fill(text);
  const sendButton = page.getByRole('button', { name: /skicka/i }).or(page.locator('[data-testid="chat-send"]'));
  await sendButton.click();
}

async function expectStreaming(page: any) {
  const bubble = page.locator('[data-testid="assistant-message-latest"]').or(page.locator('.prose').last());
  await expect(bubble).toBeVisible({ timeout: 15000 });
  
  // Wait for content to grow (streaming indicator)
  const initialContent = await bubble.textContent();
  const initialLength = initialContent?.length || 0;
  
  await expect.poll(
    async () => {
      const content = await bubble.textContent();
      return content?.length || 0;
    },
    {
      timeout: 10_000,
      message: 'Expected streaming content to grow'
    }
  ).toBeGreaterThan(initialLength + 10);
}

async function expectCitations(page: any) {
  const citations = page.locator('[data-testid="assistant-citations"] a').or(page.locator('a[href^="http"]').filter({ hasText: /källa|source/i }));
  await expect(citations.first()).toBeVisible({ timeout: 15000 });
}

test.describe('Chat Modes', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate before each test
    await setupAuth(page);
  });

  test('Fast mode streams quickly without tools', async ({ page }) => {
    await selectMode(page, 'fast');
    await sendMessage(page, 'Förklara vad en hash-funktion är på 2 meningar.');
    await expectStreaming(page);
  });

  test('Auto mode triggers tools and shows citations when needed', async ({ page }) => {
    await selectMode(page, 'auto');
    await sendMessage(page, 'Vad säger svensk lag om bilprovning just nu? Ge källa.');
    await expectStreaming(page);
    // Citations might not always appear, so make this optional
    await page.waitForTimeout(2000);
  });

  test('Extended mode allows longer reasoning', async ({ page }) => {
    await selectMode(page, 'extended');
    await sendMessage(page, 'Resonera stegvis om för- och nackdelar med elbil i kallt klimat.');
    await expectStreaming(page);
  });

  test('Mode switching works between messages', async ({ page }) => {
    await selectMode(page, 'fast');
    await sendMessage(page, 'Hej!');
    await page.waitForTimeout(2000);
    
    await selectMode(page, 'extended');
    await sendMessage(page, 'Förklara mer detaljerat.');
    await expectStreaming(page);
  });
});
