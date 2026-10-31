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

const bioinformaticsFixture = {
  source: 'synthetic-sql',
  overview: { profiles: 40, variantObservations: 240, genes: 18, assayTypes: 3, genomicsConsents: 36, multiOmicsLayers: 5, structuredReports: 28, specimenEvents: 160 },
  assayComposition: [{ label: 'WGS', value: 18 }, { label: 'RNA-seq', value: 13 }, { label: 'Methylation', value: 9 }],
  evidenceDistribution: [{ label: 'pathogenic', value: 24 }, { label: 'likely-pathogenic', value: 42 }, { label: 'vus', value: 86 }, { label: 'benign', value: 58 }],
  geneCatalog: [{ gene: 'TP53', observations: 32, averageAlleleFraction: 0.42, curatedSignals: 12 }, { gene: 'EGFR', observations: 27, averageAlleleFraction: 0.31, curatedSignals: 9 }, { gene: 'BRCA1', observations: 19, averageAlleleFraction: 0.28, curatedSignals: 7 }],
  genomeBuilds: [{ label: 'GRCh38', value: 28 }, { label: 'GRCh37', value: 12 }],
  workflows: [{ id: 1, analysisType: 'cohort-qc', datasetVersion: 'health-synthetic-v1', pipelineVersion: '2.4.0', status: 'completed', checksumPrefix: 'abc123def456', completedAt: '2026-10-17T01:00:00Z' }],
  multiOmicsComposition: [{ label: 'genomics', profiles: 40, features: 120, qcPassed: 38 }, { label: 'transcriptomics', profiles: 26, features: 88, qcPassed: 24 }],
  specimenJourney: [{ stage: 'collected', events: 40, healthyEvents: 40 }, { stage: 'qc-passed', events: 38, healthyEvents: 36 }],
  precisionReadiness: { structuredReports: 28, fhirReadyReports: 24, averageCompleteness: 92, consentCoverage: 90, longitudinalPatients: 16, specimenEvents: 160 },
  provenance: { datasetVersion: 'health-synthetic-v1' },
  recentProfiles: [],
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch();

try {
  for (const [name, route, authenticated] of routes) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.route('**/api/**', async (request) => {
      if (request.request().url().includes('/bioinformatics/atlas')) {
        await request.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: bioinformaticsFixture }) });
        return;
      }
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
    if (name === 'bioinformatics') await page.getByRole('heading', { name: /Bioinformatics/i }).waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false });
    await context.close();
    console.log(`captured ${name}`);
  }
} finally {
  await browser.close();
}
