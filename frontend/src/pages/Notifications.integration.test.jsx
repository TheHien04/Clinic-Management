import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Notifications from './Notifications';

vi.mock('../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../components/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../services/notifications', () => ({
  getNotificationInboxAPI: vi.fn().mockResolvedValue({ data: [] }),
  createNotificationAPI: vi.fn().mockResolvedValue({ data: [] }),
  markNotificationReadAPI: vi.fn().mockResolvedValue({ data: {} }),
  getDeliveryQueueAPI: vi.fn().mockResolvedValue({ data: [], metadata: { queued: 0, retrying: 0, failed: 0 } }),
  processDeliveryQueueAPI: vi.fn().mockResolvedValue({ data: [] }),
  getDeadLetterQueueAPI: vi.fn().mockResolvedValue({ data: [], metadata: { count: 0 } }),
}));

describe('Notifications integration', () => {
  it('renders enterprise messaging center', async () => {
    render(
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    );

    expect(await screen.findByText('Enterprise Messaging Console')).toBeTruthy();
    expect(screen.getByText('Inbox')).toBeTruthy();
    expect(screen.getByText('Broadcast Composer')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Queue Notification/i })).toBeTruthy();
  });
});
