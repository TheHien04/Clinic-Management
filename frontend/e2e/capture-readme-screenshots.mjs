import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const outputDir = path.resolve(process.cwd(), '../assets/current');

const routes = [
  ['login', '/login', false],
  ['register', '/register', false],
  ['dashboard', '/dashboard', true],
  ['appointments', '/appointments', true],
  ['patients', '/patients', true],
  ['doctors', '/doctors', true],
  ['reports', '/reports', true],
  ['medical-records', '/medical-records', true],
  ['innovation-lab', '/innovation-lab', true],
  ['bioinformatics', '/bioinformatics', true],
  ['notifications', '/notifications', true],
  ['hospital-portal', '/hospital-portal', true],
  ['patient-portal', '/patient-portal', true],
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();

try {
  for (const [name, route, authenticated] of routes) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.route('**/api/**', async (request) => {
      await request.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [], metadata: {} }),
      });
    });
    if (authenticated) {
      await page.addInitScript(() => {
        sessionStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiJ9.e2e.signature');
        localStorage.setItem('user', JSON.stringify({ email: 'readme@clinic.com', name: 'README Capture', role: 'admin' }));
      });
    }
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
    await context.close();
    console.log(`captured ${name}`);
  }
} finally {
  await browser.close();
}
