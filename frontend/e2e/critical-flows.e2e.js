import { test, expect } from '@playwright/test';

const bootstrapSession = async (page, role = 'admin') => {
  await page.addInitScript((sessionRole) => {
    // Access tokens are tab-scoped. Refresh credentials are HttpOnly and
    // intentionally cannot be seeded by browser JavaScript.
    sessionStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiJ9.e2e.signature');
    localStorage.setItem('user', JSON.stringify({ email: 'e2e@clinic.com', name: 'E2E User', role: sessionRole }));
  }, role);
};

const stubJsonApi = async (page) => {
  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [], metadata: {} }),
    });
  });
};

test('login page renders and allows sign-in form interaction', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Clinic Management' })).toBeVisible();
  await page.getByLabel('Email address').fill('admin@clinic.com');
  await page.getByLabel('Password', { exact: true }).fill('Clinic123');
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});

test('notification center page loads for authenticated user', async ({ page }) => {
  await bootstrapSession(page);
  await stubJsonApi(page);
  await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Keep every care message/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Queue Notification' })).toBeVisible();
});

test('patient portal advanced module renders', async ({ page }) => {
  await bootstrapSession(page, 'patient');
  await stubJsonApi(page);
  await page.goto('/patient-portal', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Patient Portal' })).toBeVisible();
  await expect(page.getByText('AI Preventive Health Navigator')).toBeVisible();
});

test('hospital portal route renders global services', async ({ page }) => {
  await bootstrapSession(page);
  await stubJsonApi(page);
  await page.goto('/hospital-portal', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Care without borders/i })).toBeVisible();
  await expect(page.getByText('Emergency Contacts')).toBeVisible();
});
