import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Bioinformatics from './Bioinformatics';

vi.mock('../components/Sidebar', () => ({ default: () => <div>Sidebar</div> }));
vi.mock('../components/Header', () => ({ default: () => <div>Header</div> }));

const getAtlasMock = vi.fn();
vi.mock('../services/bioinformatics', () => ({
  getBioinformaticsAtlasAPI: (...args) => getAtlasMock(...args),
}));

vi.mock('recharts', () => {
  const Mock = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock, PieChart: Mock, Pie: Mock, Cell: Mock, Tooltip: Mock,
    BarChart: Mock, Bar: Mock, XAxis: Mock, YAxis: Mock, CartesianGrid: Mock,
  };
});

const fixture = {
  overview: { profiles: 40, variantObservations: 240, genes: 12, assayTypes: 3, genomicsConsents: 40, multiOmicsLayers: 5, structuredReports: 40, specimenEvents: 240 },
  assayComposition: [{ label: 'Whole exome sequencing', value: 14 }],
  evidenceDistribution: [{ label: 'vus', value: 90 }],
  geneCatalog: [{ gene: 'TP53', observations: 20, averageAlleleFraction: .42, curatedSignals: 5 }],
  genomeBuilds: [{ label: 'GRCh38', value: 20 }, { label: 'GRCh37', value: 20 }],
  workflows: [{ id: 1, analysisType: 'cohort-qc', datasetVersion: 'health-synthetic-v1', pipelineVersion: '2.4.0', checksumPrefix: 'abc123', completedAt: '2026-10-17T01:00:00Z' }],
  multiOmicsComposition: [{ label: 'genomics', profiles: 40, features: 42000, qcPassed: 38 }],
  specimenJourney: [{ stage: 'collected', events: 40, healthyEvents: 40 }],
  precisionReadiness: { structuredReports: 40, fhirReadyReports: 35, averageCompleteness: 94, consentCoverage: 100, longitudinalPatients: 8, specimenEvents: 240 },
  provenance: { datasetVersion: 'health-synthetic-v1' },
};

describe('Bioinformatics Atlas integration', () => {
  beforeEach(() => getAtlasMock.mockResolvedValue(fixture));

  it('renders governed SQL modules and safety boundaries', async () => {
    render(<Bioinformatics />);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('Bioinformatics')).toBeTruthy();
    expect(screen.getByText('Cohort Atlas')).toBeTruthy();
    expect(screen.getByText('Variant Evidence')).toBeTruthy();
    expect(screen.getByText(/Research demo/)).toBeTruthy();
    expect(screen.getByText('Gene observation matrix')).toBeTruthy();
    expect(screen.getByText('TP53')).toBeTruthy();
    expect(screen.getByText('From specimen to governed evidence')).toBeTruthy();
    expect(screen.getByText('FHIR-ready reports')).toBeTruthy();
    expect(screen.getByText('Multi-omics coverage')).toBeTruthy();
    expect(screen.getByText('Specimen journey')).toBeTruthy();
  });

  it('changes evidence explanation from question tabs', async () => {
    render(<Bioinformatics />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('tab', { name: /genome builds harmonised/i }));
    expect(screen.getByText(/GRCh37 and GRCh38 coordinates must not be joined directly/i)).toBeTruthy();
  });

  it('explains consent governance without diagnostic claims', async () => {
    render(<Bioinformatics />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('tab', { name: /every profile consent-ready/i }));
    expect(screen.getByText(/Consent history remains append-only/i)).toBeTruthy();
    expect(screen.getByText(/100% of profiled patients/i)).toBeTruthy();
  });
});
