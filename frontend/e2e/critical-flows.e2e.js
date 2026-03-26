import { test, expect } from '@playwright/test';

const bootstrapSession = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'e2e-token');
    localStorage.setItem('refresh_token', 'e2e-refresh');
    localStorage.setItem('user', JSON.stringify({ email: 'e2e@clinic.com', name: 'E2E User', role: 'admin' }));
  });
};

test('login page renders and allows sign-in form interaction', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Clinic Management' })).toBeVisible();
  await page.getByPlaceholder('Username').fill('admin@clinic.com');
  await page.getByPlaceholder('Password').fill('123456');
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});

test('notification center page loads for authenticated user', async ({ page }) => {
  await bootstrapSession(page);
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Enterprise Messaging Console' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Queue Notification' })).toBeVisible();
});

test('patient portal advanced module renders', async ({ page }) => {
  await bootstrapSession(page);
  await page.goto('/patient-portal');
  await expect(page.getByRole('heading', { name: 'Patient Portal' })).toBeVisible();
  await expect(page.getByText('AI Preventive Health Navigator')).toBeVisible();
});

test('hospital portal route renders global services', async ({ page }) => {
  await bootstrapSession(page);
  await page.goto('/hospital-portal');
  await expect(page.getByRole('heading', { name: 'Hospital Portal' })).toBeVisible();
});
