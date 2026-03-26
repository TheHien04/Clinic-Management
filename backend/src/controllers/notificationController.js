/**
 * Notification Center Controller
 * Provides inbox, retry queue, and dead-letter monitoring.
 */

let nextNotificationId = 1;
const notificationStore = [];
const deliveryQueue = [];
const deadLetterQueue = [];

const MAX_RETRY_ATTEMPTS = 3;

const asArray = (value) => (Array.isArray(value) ? value : []);

const nowIso = () => new Date().toISOString();

const normalizeRecipients = (rawRecipients, fallbackUserId) => {
  const recipients = asArray(rawRecipients)
    .map((item) => Number.parseInt(String(item), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (recipients.length) return recipients;
  if (Number.isFinite(Number(fallbackUserId))) return [Number(fallbackUserId)];
  return [];
};

const enqueueDeliveryJob = (notificationId, recipients, channels) => {
  const jobs = recipients.flatMap((recipientId) => channels.map((channel) => ({
    id: `${notificationId}-${recipientId}-${channel}`,
    notificationId,
    recipientId,
    channel,
    status: 'queued',
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastError: null,
  })));

  deliveryQueue.push(...jobs);
  return jobs;
};

const safeNotification = (row) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  severity: row.severity,
  createdAt: row.createdAt,
  readAt: row.readAt,
  metadata: row.metadata,
  recipientId: row.recipientId,
});

export const getNotificationInbox = async (req, res) => {
  const currentUserId = Number(req.user?.id);
  const rows = notificationStore
    .filter((item) => item.recipientId === currentUserId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return res.json({
    success: true,
    data: rows.map(safeNotification),
    metadata: {
      unreadCount: rows.filter((item) => !item.readAt).length,
      total: rows.length,
    },
  });
};

export const postNotification = async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  const severity = String(req.body?.severity || 'info').toLowerCase();
  const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
  const channels = asArray(req.body?.channels)
    .map((item) => String(item || '').toLowerCase())
    .filter((item) => ['in_app', 'email', 'sms', 'push'].includes(item));

  if (!title || !body) {
    return res.status(400).json({
      success: false,
      message: 'title and body are required',
    });
  }

  const recipients = normalizeRecipients(req.body?.recipientIds, req.body?.recipientId || req.user?.id);
  if (!recipients.length) {
    return res.status(400).json({
      success: false,
      message: 'At least one recipient is required',
    });
  }

  const resolvedChannels = channels.length ? channels : ['in_app'];
  const createdAt = nowIso();

  const createdRows = recipients.map((recipientId) => {
    const row = {
      id: nextNotificationId,
      recipientId,
      title,
      body,
      severity,
      metadata,
      createdAt,
      readAt: null,
    };
    nextNotificationId += 1;
    notificationStore.push(row);
    return row;
  });

  const jobs = enqueueDeliveryJob(createdRows[0].id, recipients, resolvedChannels.filter((item) => item !== 'in_app'));

  return res.status(201).json({
    success: true,
    message: 'Notification queued',
    data: createdRows.map(safeNotification),
    metadata: {
      queuedJobs: jobs.length,
      channels: resolvedChannels,
    },
  });
};

export const patchNotificationRead = async (req, res) => {
  const notificationId = Number.parseInt(String(req.params.id || ''), 10);
  if (!Number.isFinite(notificationId) || notificationId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification id',
    });
  }

  const currentUserId = Number(req.user?.id);
  const target = notificationStore.find((item) => item.id === notificationId && item.recipientId === currentUserId);
  if (!target) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found',
    });
  }

  target.readAt = nowIso();

  return res.json({
    success: true,
    message: 'Notification marked as read',
    data: safeNotification(target),
  });
};

export const getNotificationDeliveryQueue = async (_req, res) => {
  return res.json({
    success: true,
    data: deliveryQueue,
    metadata: {
      queued: deliveryQueue.filter((item) => item.status === 'queued').length,
      retrying: deliveryQueue.filter((item) => item.status === 'retrying').length,
      failed: deliveryQueue.filter((item) => item.status === 'failed').length,
    },
  });
};

export const postNotificationDeliveryProcess = async (req, res) => {
  const forceFail = Boolean(req.body?.forceFail);
  const limit = Math.min(25, Math.max(1, Number.parseInt(String(req.body?.limit || '10'), 10) || 10));

  const candidates = deliveryQueue.filter((item) => ['queued', 'retrying'].includes(item.status)).slice(0, limit);

  const processed = candidates.map((job) => {
    job.attempts += 1;
    job.updatedAt = nowIso();

    if (!forceFail) {
      job.status = 'delivered';
      job.lastError = null;
      return { ...job };
    }

    if (job.attempts >= MAX_RETRY_ATTEMPTS) {
      job.status = 'failed';
      job.lastError = 'delivery_timeout';
      deadLetterQueue.push({ ...job, movedAt: nowIso() });
    } else {
      job.status = 'retrying';
      job.lastError = 'delivery_attempt_failed';
    }

    return { ...job };
  });

  return res.json({
    success: true,
    message: 'Delivery batch processed',
    data: processed,
  });
};

export const getNotificationDeadLetter = async (_req, res) => {
  return res.json({
    success: true,
    data: deadLetterQueue,
    metadata: {
      count: deadLetterQueue.length,
    },
  });
};

export default {
  getNotificationInbox,
  postNotification,
  patchNotificationRead,
  getNotificationDeliveryQueue,
  postNotificationDeliveryProcess,
  getNotificationDeadLetter,
};
