import { describe, expect, it, vi } from 'vitest';
import {
  getNotificationInbox,
  postNotification,
  patchNotificationRead,
  postNotificationDeliveryProcess,
  getNotificationDeadLetter,
} from '../../../src/controllers/notificationController.js';

const createRes = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe('notification controller', () => {
  it('creates a notification and marks it as read', async () => {
    const createReq = {
      user: { id: 101, role: 'admin' },
      body: {
        title: 'Queue Test',
        body: 'Testing in-app queue behavior',
        channels: ['in_app'],
        recipientId: 101,
      },
    };
    const createResObj = createRes();

    await postNotification(createReq, createResObj);

    expect(createResObj.status).toHaveBeenCalledWith(201);
    const createdPayload = createResObj.json.mock.calls[0][0];
    expect(createdPayload.success).toBe(true);
    const notificationId = createdPayload.data[0].id;

    const inboxRes = createRes();
    await getNotificationInbox({ user: { id: 101 } }, inboxRes);
    const inboxPayload = inboxRes.json.mock.calls[0][0];
    expect(inboxPayload.success).toBe(true);
    expect(inboxPayload.data.find((item) => item.id === notificationId)).toBeTruthy();

    const readRes = createRes();
    await patchNotificationRead({ user: { id: 101 }, params: { id: String(notificationId) } }, readRes);
    const readPayload = readRes.json.mock.calls[0][0];
    expect(readPayload.success).toBe(true);
    expect(readPayload.data.readAt).toBeTruthy();
  });

  it('moves failed deliveries to dead-letter queue after retries', async () => {
    const createReq = {
      user: { id: 201, role: 'admin' },
      body: {
        title: 'Dead-letter test',
        body: 'force failure test',
        channels: ['email'],
        recipientId: 201,
      },
    };
    const createResObj = createRes();
    await postNotification(createReq, createResObj);

    await postNotificationDeliveryProcess({ body: { forceFail: true, limit: 10 } }, createRes());
    await postNotificationDeliveryProcess({ body: { forceFail: true, limit: 10 } }, createRes());
    await postNotificationDeliveryProcess({ body: { forceFail: true, limit: 10 } }, createRes());

    const deadRes = createRes();
    await getNotificationDeadLetter({}, deadRes);
    const deadPayload = deadRes.json.mock.calls[0][0];
    expect(deadPayload.success).toBe(true);
    expect(Number(deadPayload.metadata.count)).toBeGreaterThan(0);
  });
});
