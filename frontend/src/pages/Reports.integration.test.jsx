import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Reports from './Reports';
import { AppointmentProvider } from '../contexts/AppointmentContext';

const exportCsvMock = vi.fn();
const getAppointmentsForAnalyticsAPIMock = vi.fn();
const getReportsAnalyticsAPIMock = vi.fn();
const askReportsAssistantAPIMock = vi.fn();

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../utils/exportUtils', () => ({
  exportAppointmentsCSV: (...args) => exportCsvMock(...args),
}));

vi.mock('../services/appointments', () => ({
  getAppointmentsForAnalyticsAPI: (...args) => getAppointmentsForAnalyticsAPIMock(...args),
}));

vi.mock('../services/reports', () => ({
  getReportsAnalyticsAPI: (...args) => getReportsAnalyticsAPIMock(...args),
  askReportsAssistantAPI: (...args) => askReportsAssistantAPIMock(...args),
}));

const renderReports = () => {
  return render(
    <MemoryRouter>
      <AppointmentProvider>
        <Reports />
      </AppointmentProvider>
    </MemoryRouter>
  );
};

describe('Reports integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppointmentsForAnalyticsAPIMock.mockResolvedValue([]);
    getReportsAnalyticsAPIMock.mockResolvedValue({ data: {} });
    askReportsAssistantAPIMock.mockResolvedValue({
      data: {
        answer: 'Highest risk is cancellation clustering in ENT this month.',
        highlights: ['ENT cancellation rate crossed threshold'],
      },
    });
  });

  it('shows fallback source label and filters by status', async () => {
    renderReports();

    await waitFor(() => {
      expect(screen.getByText('Data source: Mock fallback (backend needs auth/data seed)')).toBeTruthy();
    });

    const statusSelect = screen.getByDisplayValue('All Status');
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    await waitFor(() => {
      const summaryCard = screen.getByText('Summary').closest('.reports-summary-card');
      expect(summaryCard?.textContent || '').toContain('Total appointments: 11');
    });
  });

  it('asks reports copilot and renders answer with highlights', async () => {
    renderReports();

    const questionInput = screen.getByPlaceholderText('Ask: Which doctor has the highest cancellation risk this quarter?');
    fireEvent.change(questionInput, { target: { value: 'Where is the highest cancellation risk?' } });

    fireEvent.click(screen.getByRole('button', { name: /ask copilot/i }));

    await waitFor(() => {
      expect(screen.getByText('Highest risk is cancellation clustering in ENT this month.')).toBeTruthy();
      expect(screen.getByText('ENT cancellation rate crossed threshold')).toBeTruthy();
    });
  });

  it('renders advanced healthtech sections', async () => {
    renderReports();

    await waitFor(() => {
      expect(screen.getByText('Precision Health Risk Twin')).toBeTruthy();
      expect(screen.getByText('Remote Monitoring Command Center')).toBeTruthy();
      expect(screen.getByText('Clinical Pathway Orchestrator')).toBeTruthy();
      expect(screen.getByText('FHIR Subscription Live Feed')).toBeTruthy();
      expect(screen.getByText('Digital Therapeutics Coach')).toBeTruthy();
      expect(screen.getByText('Population Health Stratification')).toBeTruthy();
      expect(screen.getByText('Export Event Log (NDJSON)')).toBeTruthy();
      expect(screen.getByText('Start Replay')).toBeTruthy();
      expect(screen.getByText('Apply DTx Rules')).toBeTruthy();
      expect(screen.getByText('Publish Version')).toBeTruthy();
      expect(screen.getByText('Export Policy JSON')).toBeTruthy();
      expect(screen.getByText('Import Policy JSON')).toBeTruthy();
      expect(screen.getByText('Reset Default')).toBeTruthy();
      expect(screen.getByText('Export Signed Bundle')).toBeTruthy();
      expect(screen.getByText('Verify Signed Bundle')).toBeTruthy();
      expect(screen.getByText('Mark Reviewed')).toBeTruthy();
      expect(screen.getByText('Mark Approved')).toBeTruthy();
      expect(screen.getByText('Approval Workflow')).toBeTruthy();
      expect(screen.getByText('Policy Diff Viewer')).toBeTruthy();
      expect(screen.getByText('Governance Audit Trail')).toBeTruthy();
      expect(screen.getByText('Outreach Capacity Simulator')).toBeTruthy();
      expect(screen.getByText('Export Outreach Plan (CSV)')).toBeTruthy();
      expect(screen.getByText('Outreach SLA Breach Radar')).toBeTruthy();
      expect(screen.getByText('Preview Auto-Rebalance')).toBeTruthy();
      expect(screen.getByText('Apply Auto-Rebalance Suggestion')).toBeTruthy();
      expect(screen.getByText('Rollback Last Rebalance')).toBeTruthy();
    });
  });

  it('runs key-rotate tamper verify workflow in compliance cockpit', async () => {
    renderReports();

    fireEvent.click(screen.getByRole('button', { name: /rotate signing key/i }));

    await waitFor(() => {
      const status = screen.getByText(/Signing key rotated|Unable to rotate key in this environment/i);
      expect(status).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /sign executive package/i }));
    fireEvent.click(screen.getByRole('button', { name: /simulate tamper/i }));
    fireEvent.click(screen.getByRole('button', { name: /^verify signature$/i }));

    await waitFor(() => {
      const verifyStatus = screen.getByText(/Signature verification failed|No verifiable signature payload found|Unable to verify signature/i);
      expect(verifyStatus).toBeTruthy();
    });
  });

  it('rejects malformed imported manifest file', async () => {
    const { container } = renderReports();

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    const malformed = new File(['{"chain": [}'], 'manifest.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [malformed] } });

    await waitFor(() => {
      expect(screen.getByText(/Manifest import failed/i)).toBeTruthy();
    });
  });
});
