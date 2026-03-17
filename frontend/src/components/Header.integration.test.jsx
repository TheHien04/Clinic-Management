import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Header from './Header';

const subscribeOpsAlertsMock = vi.fn();
let socketOpsAlertCallback = null;

vi.mock('./CommandPalette', () => ({
  default: () => null,
}));

vi.mock('../services/socket', () => ({
  subscribeOpsAlerts: (callback) => {
    subscribeOpsAlertsMock(callback);
    socketOpsAlertCallback = callback;
    return () => {
      socketOpsAlertCallback = null;
    };
  },
}));

const OPS_ALERTS_STORAGE_KEY = 'ops_alerts_global_v1';
const OPS_ALERTS_SEEN_SIGNATURE_KEY = 'ops_alerts_seen_signature_v1';

function buildAlertsSignature(payload) {
  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
  const marker = alerts
    .slice(0, 8)
    .map((alert) => `${alert.id || ''}:${alert.severity || ''}:${alert.acknowledged ? '1' : '0'}`)
    .join('|');
  return `${Number(payload?.total || 0)}:${Number(payload?.critical || 0)}:${marker}`;
}

describe('Header ops alerts integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    socketOpsAlertCallback = null;

    localStorage.setItem('user', JSON.stringify({ name: 'Ops Admin', email: 'ops@example.com' }));
    localStorage.setItem('app_theme', 'light');

    const payload = {
      total: 1,
      critical: 0,
      page: 'doctors',
      alerts: [
        {
          id: 'alert-1',
          severity: 'info',
          acknowledged: false,
          title: 'Info alert',
          detail: 'Capacity stable',
          at: new Date().toISOString(),
        },
      ],
      at: new Date().toISOString(),
    };

    sessionStorage.setItem(OPS_ALERTS_STORAGE_KEY, JSON.stringify(payload));
    sessionStorage.setItem(OPS_ALERTS_SEEN_SIGNATURE_KEY, buildAlertsSignature(payload));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('marks current ops alerts as unread from global event', async () => {
    render(
      <MemoryRouter initialEntries={['/doctors']}>
        <Header />
      </MemoryRouter>
    );

    const opsButton = await screen.findByRole('button', { name: /ops alerts/i });
    expect(opsButton.textContent || '').not.toMatch(/new/i);

    await act(async () => {
      window.dispatchEvent(new Event('ops-alerts:mark-unread'));
      await Promise.resolve();
    });

    expect(opsButton.textContent || '').toMatch(/new/i);
  });

  it('toggles pulse class off when global toggle event is fired', async () => {
    render(
      <MemoryRouter initialEntries={['/doctors']}>
        <Header />
      </MemoryRouter>
    );

    const opsButton = await screen.findByRole('button', { name: /ops alerts/i });

    await act(async () => {
      window.dispatchEvent(new Event('ops-alerts:mark-unread'));
      await Promise.resolve();
    });

    expect(opsButton.className).toContain('has-unread');

    await act(async () => {
      window.dispatchEvent(new Event('ops-alerts:toggle-pulse'));
      await Promise.resolve();
    });

    expect(opsButton.className).not.toContain('has-unread');
  });

  it('marks ops alerts as unread when socket callback pushes new alert', async () => {
    render(
      <MemoryRouter initialEntries={['/doctors']}>
        <Header />
      </MemoryRouter>
    );

    const opsButton = await screen.findByRole('button', { name: /ops alerts/i });
    expect(subscribeOpsAlertsMock).toHaveBeenCalled();
    expect(opsButton.textContent || '').not.toMatch(/new/i);

    await act(async () => {
      socketOpsAlertCallback?.({
        total: 2,
        critical: 1,
        page: 'appointments',
        alerts: [
          {
            id: 'socket-alert-1',
            severity: 'warning',
            acknowledged: false,
            title: 'Socket warning',
            detail: 'Realtime alert from backend socket',
            at: new Date().toISOString(),
          },
        ],
        at: new Date().toISOString(),
      });
      await Promise.resolve();
    });

    expect(opsButton.textContent || '').toMatch(/new/i);
  });
});
