import React, { useEffect, useMemo, useState } from 'react';
import { FaBell, FaCheckCircle, FaExclamationTriangle, FaInbox, FaPaperPlane, FaRedo, FaSkullCrossbones } from 'react-icons/fa';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  createNotificationAPI,
  getDeadLetterQueueAPI,
  getDeliveryQueueAPI,
  getNotificationInboxAPI,
  markNotificationReadAPI,
  processDeliveryQueueAPI,
} from '../services/notifications';
import './Common.css';
import './Notifications.css';

const fallbackInbox = [
  {
    id: 1,
    title: 'Pre-op checklist reminder',
    body: 'Please complete your digital checklist before 18:00 today.',
    severity: 'warning',
    createdAt: '2026-03-26T07:20:00.000Z',
    readAt: null,
  },
  {
    id: 2,
    title: 'Insurance claim approved',
    body: 'Your outpatient claim has been approved by partner insurer.',
    severity: 'info',
    createdAt: '2026-03-25T14:00:00.000Z',
    readAt: '2026-03-25T15:00:00.000Z',
  },
];

const severityClass = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'critical') return 'critical';
  if (normalized === 'warning') return 'warning';
  if (normalized === 'success') return 'success';
  return 'info';
};

export default function Notifications() {
  const [inbox, setInbox] = useState([]);
  const [queueStats, setQueueStats] = useState({ queued: 0, retrying: 0, failed: 0 });
  const [deadLetterCount, setDeadLetterCount] = useState(0);
  const [status, setStatus] = useState('Loading notification center...');
  const [composer, setComposer] = useState({
    title: 'Care plan reminder',
    body: 'Your follow-up call is scheduled for tomorrow morning.',
    severity: 'info',
    channels: ['in_app', 'email'],
  });

  const refreshCenter = async () => {
    try {
      const [inboxPayload, queuePayload, deadLetterPayload] = await Promise.all([
        getNotificationInboxAPI(),
        getDeliveryQueueAPI().catch(() => ({ data: [], metadata: { queued: 0, retrying: 0, failed: 0 } })),
        getDeadLetterQueueAPI().catch(() => ({ data: [], metadata: { count: 0 } })),
      ]);

      const inboxRows = Array.isArray(inboxPayload?.data) ? inboxPayload.data : [];
      setInbox(inboxRows.length ? inboxRows : fallbackInbox);
      setQueueStats(queuePayload?.metadata || { queued: 0, retrying: 0, failed: 0 });
      setDeadLetterCount(Number(deadLetterPayload?.metadata?.count || 0));
      setStatus('Notification center connected to backend queue.');
    } catch {
      setInbox(fallbackInbox);
      setQueueStats({ queued: 2, retrying: 1, failed: 0 });
      setDeadLetterCount(0);
      setStatus('Preview mode: backend notifications temporarily unavailable.');
    }
  };

  useEffect(() => {
    refreshCenter();
  }, []);

  const unreadCount = useMemo(() => inbox.filter((item) => !item.readAt).length, [inbox]);

  const markRead = async (id) => {
    try {
      await markNotificationReadAPI(id);
      await refreshCenter();
    } catch {
      setInbox((prev) => prev.map((row) => (row.id === id ? { ...row, readAt: new Date().toISOString() } : row)));
    }
  };

  const pushNotification = async () => {
    try {
      await createNotificationAPI({
        title: composer.title,
        body: composer.body,
        severity: composer.severity,
        channels: composer.channels,
      });
      setStatus('Notification queued for delivery channels.');
      await refreshCenter();
    } catch {
      setStatus('Unable to queue notification right now.');
    }
  };

  const runDelivery = async (forceFail = false) => {
    try {
      await processDeliveryQueueAPI({ limit: 10, forceFail });
      await refreshCenter();
      setStatus(forceFail ? 'Simulated failures routed to retry/dead-letter.' : 'Delivery processor completed successfully.');
    } catch {
      setStatus('Delivery processor is currently unavailable.');
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-main">
        <Header />
        <main className="notifications-content">
          <section className="notifications-hero">
            <div>
              <p className="notifications-eyebrow"><FaBell /> Notification Center</p>
              <h1>Enterprise Messaging Console</h1>
              <p>Unified inbox with queue retries, multi-channel dispatch, and dead-letter visibility.</p>
              <p className="notifications-status">{status}</p>
            </div>
            <div className="notifications-hero-metrics">
              <div><span>Unread</span><b>{unreadCount}</b></div>
              <div><span>Queued</span><b>{queueStats.queued || 0}</b></div>
              <div><span>Retrying</span><b>{queueStats.retrying || 0}</b></div>
              <div><span>Dead-letter</span><b>{deadLetterCount}</b></div>
            </div>
          </section>

          <section className="notifications-grid">
            <article className="notifications-card">
              <h3><FaInbox /> Inbox</h3>
              <ul className="notifications-list">
                {inbox.map((item) => (
                  <li key={item.id} className={`severity-${severityClass(item.severity)}`}>
                    <div>
                      <b>{item.title}</b>
                      <p>{item.body}</p>
                      <small>{new Date(item.createdAt).toLocaleString()}</small>
                    </div>
                    <button
                      className="notifications-btn"
                      type="button"
                      disabled={Boolean(item.readAt)}
                      onClick={() => markRead(item.id)}
                    >
                      <FaCheckCircle /> {item.readAt ? 'Read' : 'Mark Read'}
                    </button>
                  </li>
                ))}
              </ul>
            </article>

            <article className="notifications-card">
              <h3><FaPaperPlane /> Broadcast Composer</h3>
              <label>Title
                <input
                  value={composer.title}
                  onChange={(e) => setComposer((prev) => ({ ...prev, title: e.target.value }))}
                />
              </label>
              <label>Message
                <textarea
                  rows={4}
                  value={composer.body}
                  onChange={(e) => setComposer((prev) => ({ ...prev, body: e.target.value }))}
                />
              </label>
              <label>Severity
                <select
                  value={composer.severity}
                  onChange={(e) => setComposer((prev) => ({ ...prev, severity: e.target.value }))}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                  <option value="success">Success</option>
                </select>
              </label>
              <div className="notifications-actions">
                <button className="notifications-btn" type="button" onClick={pushNotification}><FaPaperPlane /> Queue Notification</button>
                <button className="notifications-btn" type="button" onClick={() => runDelivery(false)}><FaRedo /> Run Delivery</button>
                <button className="notifications-btn notifications-btn-danger" type="button" onClick={() => runDelivery(true)}><FaExclamationTriangle /> Simulate Failure</button>
              </div>
              <p className="notifications-footnote"><FaSkullCrossbones /> Failed jobs move to dead-letter after max retry policy.</p>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
