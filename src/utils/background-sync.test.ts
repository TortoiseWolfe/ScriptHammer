import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Sending messages saved while offline (#1321).
 *
 * The property that matters is the negative one. A message the visitor was told would be
 * sent leaves the queue only when it WAS sent, or when they discard it. The old path deleted
 * it after three failed replays through a provider production never configured.
 */

const queue = vi.hoisted(() => ({
  getQueuedItems: vi.fn(),
  removeFromQueue: vi.fn(),
  updateRetryCount: vi.fn(),
}));
vi.mock('./offline-queue', () => queue);

const service = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/utils/email/email-service', () => ({ emailService: service }));

import {
  QUEUE_CHANGED_EVENT,
  discardNextQueued,
  sendNextQueued,
} from './background-sync';

const saved = (id: number, retryCount = 0) => ({
  id,
  data: {
    name: 'Ada',
    email: 'ada@lovelace.dev',
    subject: 'Engines',
    message: `Saved message ${id}`,
    _gotcha: '',
  },
  timestamp: id,
  retryCount,
});

describe('sendNextQueued', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue.removeFromQueue.mockResolvedValue(true);
    queue.updateRetryCount.mockResolvedValue(true);
  });

  it('reports an empty queue without sending anything', async () => {
    queue.getQueuedItems.mockResolvedValue([]);
    expect(await sendNextQueued('tok')).toEqual({ outcome: 'empty' });
    expect(service.send).not.toHaveBeenCalled();
  });

  it('sends the OLDEST message with the token, then removes only that one', async () => {
    queue.getQueuedItems.mockResolvedValue([saved(1), saved(2)]);
    service.send.mockResolvedValue({ success: true });

    const result = await sendNextQueued('tok-1');

    expect(result).toEqual({ outcome: 'sent', remaining: 1 });
    expect(service.send).toHaveBeenCalledTimes(1);
    expect(service.send).toHaveBeenCalledWith({
      name: 'Ada',
      email: 'ada@lovelace.dev',
      subject: 'Engines',
      message: 'Saved message 1',
      captchaToken: 'tok-1',
    });
    expect(queue.removeFromQueue).toHaveBeenCalledWith(1);
  });

  it('sends no token key when there is no token (no site key configured)', async () => {
    queue.getQueuedItems.mockResolvedValue([saved(1)]);
    service.send.mockResolvedValue({ success: true });

    await sendNextQueued(null);
    expect(service.send.mock.calls[0][0]).not.toHaveProperty('captchaToken');
  });

  it('announces the change so every count on the page follows', async () => {
    queue.getQueuedItems.mockResolvedValue([saved(1)]);
    service.send.mockResolvedValue({ success: true });
    const heard = vi.fn();
    window.addEventListener(QUEUE_CHANGED_EVENT, heard);

    await sendNextQueued('tok');
    window.removeEventListener(QUEUE_CHANGED_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  // The old path's MAX_RETRIES deleted the message here. It must stay, however many
  // times it has already failed.
  it('KEEPS a message that failed, however often it has failed before', async () => {
    queue.getQueuedItems.mockResolvedValue([saved(1, 7)]);
    service.send.mockRejectedValue(new Error('Network error'));

    const result = await sendNextQueued('tok');

    expect(result.outcome).toBe('failed');
    expect(queue.removeFromQueue).not.toHaveBeenCalled();
    expect(queue.updateRetryCount).toHaveBeenCalledWith(1, 8);
  });

  it('carries a reason the visitor can read', async () => {
    queue.getQueuedItems.mockResolvedValue([saved(1)]);
    service.send.mockRejectedValue(new Error('Network error'));

    const result = await sendNextQueued('tok');
    expect(result).toMatchObject({
      outcome: 'failed',
      message: expect.stringMatching(/network/i),
      remaining: 1,
    });
  });
});

describe('discardNextQueued', () => {
  it('removes the oldest message, and only when the visitor asks', async () => {
    queue.getQueuedItems.mockResolvedValue([saved(3), saved(4)]);
    queue.removeFromQueue.mockResolvedValue(true);

    await discardNextQueued();
    expect(queue.removeFromQueue).toHaveBeenCalledWith(3);
  });
});
