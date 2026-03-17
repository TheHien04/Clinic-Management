import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Header.css';
import { STORAGE_KEYS, ROUTES } from '../constants';
import CommandPalette from './CommandPalette';
import { exportToCSV } from '../utils/exportUtils';
import { subscribeOpsAlerts } from '../services/socket';
import { formatDateTimeCompact } from '../utils/i18nFormat';
import { getApiBaseUrl } from '../utils/runtimeEnv';

const API_BASE_URL = getApiBaseUrl();
const OPS_ALERTS_EVENT = 'ops-alerts:update';
const OPS_ALERTS_STORAGE_KEY = 'ops_alerts_global_v1';
const OPS_ALERTS_OPEN_EVENT = 'ops-alerts:open';
const OPS_ALERTS_MARK_UNREAD_EVENT = 'ops-alerts:mark-unread';
const OPS_ALERTS_TOGGLE_PULSE_EVENT = 'ops-alerts:toggle-pulse';
const CRITICAL_ALERT_ACK_KEY = 'doctors_critical_alert_ack_v1';
const OPS_ALERTS_SEVERITY_FILTER_KEY = 'ops_alerts_severity_filter_v1';
const OPS_ALERTS_SEEN_SIGNATURE_KEY = 'ops_alerts_seen_signature_v1';
const OPS_ALERTS_PULSE_DISABLED_KEY = 'ops_alerts_pulse_disabled_v1';

function buildAlertsSignature(payload) {
  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
  const marker = alerts
    .slice(0, 8)
    .map((alert) => `${alert.id || ''}:${alert.severity || ''}:${alert.acknowledged ? '1' : '0'}`)
    .join('|');
  return `${Number(payload?.total || 0)}:${Number(payload?.critical || 0)}:${marker}`;
}

function formatRelativeTime(value, now = new Date()) {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return 'unknown';
  const seconds = Math.max(0, Math.floor((now.getTime() - target.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"' && inQuotes) {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseOpsAlertsCsv(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    severity: headers.indexOf('severity'),
    acknowledged: headers.indexOf('acknowledged'),
    title: headers.indexOf('title'),
    detail: headers.indexOf('detail'),
    at: headers.indexOf('at'),
  };

  if (idx.severity < 0 || idx.title < 0) return [];

  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    return {
      id: `replay-${Date.now()}-${rowIndex}`,
      severity: String(cells[idx.severity] || 'info').toLowerCase(),
      acknowledged: String(cells[idx.acknowledged] || '').toLowerCase() === 'yes',
      title: cells[idx.title] || 'Untitled Alert',
      detail: cells[idx.detail] || 'No details available.',
      at: cells[idx.at] || new Date().toISOString(),
    };
  });
}

const pageTitles = {
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.APPOINTMENTS]: 'Appointments',
  [ROUTES.PATIENTS]: 'Patients',
  [ROUTES.DOCTORS]: 'Doctors',
  [ROUTES.REPORTS]: 'Reports',
  [ROUTES.MEDICAL_RECORDS]: 'Medical Records',
};

function formatDateTime(date) {
  return formatDateTimeCompact(date);
}

function getInitials(value) {
  if (!value) return 'AD';
  const clean = String(value).trim();
  if (!clean) return 'AD';
  const chunks = clean.split(/[\s@._-]+/).filter(Boolean);
  if (chunks.length === 1) {
    return chunks[0].slice(0, 2).toUpperCase();
  }
  return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase();
}

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const opsPanelRef = React.useRef(null);
  const opsImportInputRef = React.useRef(null);
  const user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
  const currentPath = location.pathname.replace(/^\//, '');
  const pageTitle = pageTitles[currentPath] || 'Dashboard';
  const [now, setNow] = React.useState(() => new Date());
  const [health, setHealth] = React.useState({ state: 'checking', latencyMs: null });
  const [theme, setTheme] = React.useState(() => (localStorage.getItem(STORAGE_KEYS.THEME) === 'slate' ? 'slate' : 'light'));
  const [opsAlerts, setOpsAlerts] = React.useState(() => {
    try {
      const raw = sessionStorage.getItem(OPS_ALERTS_STORAGE_KEY);
      const parsed = JSON.parse(raw || '{}');
      return {
        total: Number(parsed.total || 0),
        critical: Number(parsed.critical || 0),
        page: parsed.page || '',
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
        at: parsed.at || null,
      };
    } catch {
      return { total: 0, critical: 0, page: '', alerts: [], at: null };
    }
  });
  const [opsPanelOpen, setOpsPanelOpen] = React.useState(false);
  const [opsSeverityFilter, setOpsSeverityFilter] = React.useState(() => {
    const saved = sessionStorage.getItem(OPS_ALERTS_SEVERITY_FILTER_KEY);
    return saved === 'critical' || saved === 'warning' || saved === 'info' ? saved : 'all';
  });
  const [opsHasUnread, setOpsHasUnread] = React.useState(() => {
    try {
      const raw = sessionStorage.getItem(OPS_ALERTS_STORAGE_KEY);
      const parsed = JSON.parse(raw || '{}');
      const seen = sessionStorage.getItem(OPS_ALERTS_SEEN_SIGNATURE_KEY) || '';
      const signature = buildAlertsSignature(parsed);
      return Number(parsed.total || 0) > 0 && signature !== seen;
    } catch {
      return false;
    }
  });
  const [opsPulseEnabled, setOpsPulseEnabled] = React.useState(
    () => localStorage.getItem(OPS_ALERTS_PULSE_DISABLED_KEY) !== '1'
  );
  const [opsReplayStatus, setOpsReplayStatus] = React.useState('');
  const displayName = user.name || user.email || 'Admin';
  const userInitials = getInitials(displayName);

  const healthLabel =
    health.state === 'online'
      ? `System Online${health.latencyMs ? ` • ${health.latencyMs} ms` : ''}`
      : health.state === 'degraded'
        ? 'Backend Degraded'
        : 'Checking System';

  const pingBackend = React.useCallback(async () => {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Health endpoint returned ${response.status}`);
      }
      const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
      setHealth({ state: 'online', latencyMs });
    } catch {
      setHealth((prev) => ({ state: 'degraded', latencyMs: prev.latencyMs }));
    }
  }, []);

  React.useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  React.useEffect(() => {
    pingBackend();
    const healthTimer = setInterval(() => {
      pingBackend();
    }, 45000);
    return () => clearInterval(healthTimer);
  }, [pingBackend]);

  const applyTheme = React.useCallback((nextTheme) => {
    const resolvedTheme = nextTheme === 'slate' ? 'slate' : 'light';
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, resolvedTheme);
    setTheme(resolvedTheme);
    window.dispatchEvent(new CustomEvent('app-theme:changed', { detail: { theme: resolvedTheme } }));
  }, []);

  React.useEffect(() => {
    applyTheme(theme);
  }, [applyTheme, theme]);

  React.useEffect(() => {
    const onThemeChanged = (event) => {
      const nextTheme = event?.detail?.theme;
      if (nextTheme === 'light' || nextTheme === 'slate') {
        setTheme(nextTheme);
      }
    };

    window.addEventListener('app-theme:changed', onThemeChanged);
    return () => window.removeEventListener('app-theme:changed', onThemeChanged);
  }, []);

  React.useEffect(() => {
    sessionStorage.setItem(OPS_ALERTS_STORAGE_KEY, JSON.stringify(opsAlerts));
  }, [opsAlerts]);

  React.useEffect(() => {
    sessionStorage.setItem(OPS_ALERTS_SEVERITY_FILTER_KEY, opsSeverityFilter);
  }, [opsSeverityFilter]);

  React.useEffect(() => {
    const seen = sessionStorage.getItem(OPS_ALERTS_SEEN_SIGNATURE_KEY) || '';
    const signature = buildAlertsSignature(opsAlerts);
    setOpsHasUnread(opsAlerts.total > 0 && signature !== seen);
  }, [opsAlerts]);

  React.useEffect(() => {
    localStorage.setItem(OPS_ALERTS_PULSE_DISABLED_KEY, opsPulseEnabled ? '0' : '1');
  }, [opsPulseEnabled]);

  React.useEffect(() => {
    const onOpsAlertsUpdated = (event) => {
      const next = event?.detail || {};
      setOpsAlerts({
        total: Number(next.total || 0),
        critical: Number(next.critical || 0),
        page: next.page || '',
        alerts: Array.isArray(next.alerts) ? next.alerts : [],
        at: next.at || new Date().toISOString(),
      });
    };

    window.addEventListener(OPS_ALERTS_EVENT, onOpsAlertsUpdated);
    return () => window.removeEventListener(OPS_ALERTS_EVENT, onOpsAlertsUpdated);
  }, []);

  React.useEffect(() => {
    const unsubscribe = subscribeOpsAlerts((payload) => {
      window.dispatchEvent(new CustomEvent(OPS_ALERTS_EVENT, { detail: payload }));
    });

    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const onOpenOpsAlerts = () => setOpsPanelOpen(true);
    window.addEventListener(OPS_ALERTS_OPEN_EVENT, onOpenOpsAlerts);
    return () => window.removeEventListener(OPS_ALERTS_OPEN_EVENT, onOpenOpsAlerts);
  }, []);

  React.useEffect(() => {
    const onMarkUnread = () => {
      sessionStorage.removeItem(OPS_ALERTS_SEEN_SIGNATURE_KEY);
      setOpsHasUnread((prev) => (opsAlerts.total > 0 ? true : prev));
    };

    const onTogglePulse = () => {
      setOpsPulseEnabled((prev) => !prev);
    };

    window.addEventListener(OPS_ALERTS_MARK_UNREAD_EVENT, onMarkUnread);
    window.addEventListener(OPS_ALERTS_TOGGLE_PULSE_EVENT, onTogglePulse);
    return () => {
      window.removeEventListener(OPS_ALERTS_MARK_UNREAD_EVENT, onMarkUnread);
      window.removeEventListener(OPS_ALERTS_TOGGLE_PULSE_EVENT, onTogglePulse);
    };
  }, [opsAlerts.total]);

  React.useEffect(() => {
    if (!opsPanelOpen) return;
    const signature = buildAlertsSignature(opsAlerts);
    sessionStorage.setItem(OPS_ALERTS_SEEN_SIGNATURE_KEY, signature);
    setOpsHasUnread(false);
  }, [opsAlerts, opsPanelOpen]);

  const handleAcknowledgeAllCritical = React.useCallback(() => {
    const criticalIds = (opsAlerts.alerts || [])
      .filter((alert) => alert.severity === 'critical' && !alert.acknowledged)
      .map((alert) => alert.id);

    if (!criticalIds.length) return;

    try {
      const raw = sessionStorage.getItem(CRITICAL_ALERT_ACK_KEY);
      const existing = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
      const merged = Array.from(new Set([...existing, ...criticalIds])).slice(-80);
      sessionStorage.setItem(CRITICAL_ALERT_ACK_KEY, JSON.stringify(merged));
    } catch {
      sessionStorage.setItem(CRITICAL_ALERT_ACK_KEY, JSON.stringify(criticalIds));
    }

    setOpsAlerts((prev) => ({
      ...prev,
      critical: 0,
      alerts: (prev.alerts || []).map((alert) => (
        alert.severity === 'critical' ? { ...alert, acknowledged: true } : alert
      )),
      at: new Date().toISOString(),
    }));
  }, [opsAlerts.alerts]);

  const handleExportOpsAlerts = React.useCallback(() => {
    const rows = (opsAlerts.alerts || []).map((alert) => ({
      severity: alert.severity,
      acknowledged: alert.acknowledged ? 'yes' : 'no',
      title: alert.title,
      detail: alert.detail,
      at: alert.at,
    }));
    exportToCSV(rows, `ops_alerts_${new Date().toISOString().slice(0, 10)}.csv`);
  }, [opsAlerts.alerts]);

  const filteredOpsAlerts = React.useMemo(() => {
    const alerts = opsAlerts.alerts || [];
    if (opsSeverityFilter === 'all') return alerts;
    return alerts.filter((alert) => String(alert.severity || '').toLowerCase() === opsSeverityFilter);
  }, [opsAlerts.alerts, opsSeverityFilter]);

  const opsSeverityCounts = React.useMemo(() => {
    const counts = { critical: 0, warning: 0, info: 0 };
    (opsAlerts.alerts || []).forEach((alert) => {
      const severity = String(alert.severity || '').toLowerCase();
      if (severity === 'critical' || severity === 'warning' || severity === 'info') {
        counts[severity] += 1;
      }
    });
    return counts;
  }, [opsAlerts.alerts]);

  const handleImportOpsAlerts = React.useCallback(() => {
    opsImportInputRef.current?.click();
  }, []);

  const handleMarkOpsUnread = React.useCallback(() => {
    sessionStorage.removeItem(OPS_ALERTS_SEEN_SIGNATURE_KEY);
    setOpsHasUnread(opsAlerts.total > 0);
  }, [opsAlerts.total]);

  const handleImportOpsAlertsFile = React.useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = parseOpsAlertsCsv(text);
      if (!imported.length) {
        setOpsReplayStatus('Import failed: invalid or empty alerts CSV.');
        return;
      }

      const critical = imported.filter((alert) => alert.severity === 'critical' && !alert.acknowledged).length;
      setOpsAlerts({
        total: imported.length,
        critical,
        page: 'replay',
        alerts: imported,
        at: new Date().toISOString(),
      });
      setOpsReplayStatus(`Imported ${imported.length} alert(s) from CSV replay.`);
      setOpsSeverityFilter('all');
      sessionStorage.removeItem(OPS_ALERTS_SEEN_SIGNATURE_KEY);
      setOpsPanelOpen(true);
    } catch {
      setOpsReplayStatus('Import failed: unable to parse selected file.');
    } finally {
      event.target.value = '';
    }
  }, []);

  React.useEffect(() => {
    if (!opsPanelOpen) return undefined;

    const onClickOutside = (event) => {
      if (!opsPanelRef.current?.contains(event.target)) {
        setOpsPanelOpen(false);
      }
    };

    const onEscape = (event) => {
      if (event.key === 'Escape') setOpsPanelOpen(false);
    };

    window.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onEscape);
    };
  }, [opsPanelOpen]);
  
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    navigate(`/${ROUTES.LOGIN}`);
  };
  
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-title-wrap">
          <p className="header-eyebrow">Global Care Workspace</p>
          <div className="header-title">{pageTitle}</div>
        </div>
        <div className={`header-health-pill is-${health.state}`} aria-live="polite">
          <span className="health-dot" />
          <span>{healthLabel}</span>
        </div>
      </div>

      <div className="header-user">
        <div className="header-ops-wrap" ref={opsPanelRef}>
          <button
            type="button"
            className={`header-ops-alerts ${opsAlerts.critical > 0 ? 'is-critical' : ''} ${opsHasUnread && opsPulseEnabled ? 'has-unread' : ''}`}
            onClick={() => setOpsPanelOpen((prev) => !prev)}
            title="Open operations alerts panel"
          >
            Ops Alerts: {opsAlerts.total}
            {opsAlerts.critical > 0 && <span className="header-ops-critical">Critical {opsAlerts.critical}</span>}
            {opsHasUnread && <span className="header-ops-new">new</span>}
          </button>
          {opsPanelOpen && (
            <div className="header-ops-panel" role="dialog" aria-label="Operations alerts panel">
              <div className="header-ops-panel-head">
                <b>Operations Alerts</b>
                <small>
                  {opsAlerts.page ? `Source: ${opsAlerts.page}` : 'Source: system'}
                  {opsAlerts.at ? ` • Updated ${formatRelativeTime(opsAlerts.at, now)}` : ''}
                </small>
              </div>
              <div className="header-ops-actions">
                <button type="button" onClick={handleAcknowledgeAllCritical}>Acknowledge All Critical</button>
                <button type="button" onClick={handleExportOpsAlerts}>Export Alerts CSV</button>
                <button type="button" onClick={handleImportOpsAlerts}>Import Replay CSV</button>
                <button type="button" onClick={handleMarkOpsUnread}>Mark all unread</button>
                <button type="button" onClick={() => setOpsPulseEnabled((prev) => !prev)}>
                  Pulse: {opsPulseEnabled ? 'On' : 'Off'}
                </button>
                <input
                  ref={opsImportInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportOpsAlertsFile}
                  className="header-ops-import-input"
                />
              </div>
              <div className="header-ops-filters">
                <button type="button" className={opsSeverityFilter === 'all' ? 'is-active' : ''} onClick={() => setOpsSeverityFilter('all')}>
                  All ({opsAlerts.total})
                </button>
                <button type="button" className={opsSeverityFilter === 'critical' ? 'is-active' : ''} onClick={() => setOpsSeverityFilter('critical')}>
                  Critical ({opsSeverityCounts.critical})
                </button>
                <button type="button" className={opsSeverityFilter === 'warning' ? 'is-active' : ''} onClick={() => setOpsSeverityFilter('warning')}>
                  Warning ({opsSeverityCounts.warning})
                </button>
                <button type="button" className={opsSeverityFilter === 'info' ? 'is-active' : ''} onClick={() => setOpsSeverityFilter('info')}>
                  Info ({opsSeverityCounts.info})
                </button>
              </div>
              {opsReplayStatus && <p className="header-ops-replay-status">{opsReplayStatus}</p>}
              <div className="header-ops-list">
                {filteredOpsAlerts?.length ? filteredOpsAlerts.map((alert) => (
                  <article key={alert.id} className={`header-ops-item is-${alert.severity}`}>
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.detail}</p>
                    </div>
                    <span>{alert.acknowledged ? 'ack' : alert.severity}</span>
                  </article>
                )) : (
                  <p className="header-ops-empty">No alerts in this severity filter.</p>
                )}
              </div>
              <button
                type="button"
                className="header-ops-open"
                onClick={() => {
                  setOpsPanelOpen(false);
                  navigate(`/${ROUTES.DOCTORS}`);
                }}
              >
                Open Doctors Operations Center
              </button>
            </div>
          )}
        </div>
        <div className="header-time">{formatDateTime(now)}</div>
        <button
          type="button"
          className="header-quick-action"
          onClick={() => navigate(`/${ROUTES.APPOINTMENTS}`)}
        >
          New Appointment
        </button>
        <button
          type="button"
          className="header-quick-action"
          onClick={() => navigate(`/${ROUTES.REPORTS}`)}
        >
          Open Reports
        </button>
        <button
          type="button"
          className="header-theme-toggle"
          onClick={() => applyTheme(theme === 'light' ? 'slate' : 'light')}
          title="Toggle visual theme"
        >
          Theme: {theme === 'light' ? 'Light' : 'Slate'}
        </button>
        <button
          type="button"
          className="command-launcher"
          title="Open command palette"
          onClick={() => window.dispatchEvent(new Event('command-palette:open'))}
        >
          Search (Cmd/Ctrl + K)
        </button>
        <span className="user-avatar">{userInitials}</span>
        <span className="user-name">{displayName}</span>
        {user.email && (
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        )}
      </div>
      <CommandPalette onLogout={handleLogout} />
    </header>
  );
}
