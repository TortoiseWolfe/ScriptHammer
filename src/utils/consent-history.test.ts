import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  addConsentHistoryEntry,
  getConsentHistory,
  clearConsentHistory,
  pruneConsentHistory,
  formatConsentHistory,
  ConsentHistoryEntry,
} from './consent-history';
import { ConsentState, ConsentMethod } from './consent-types';

describe('Consent History', () => {
  const mockConsentState: ConsentState = {
    necessary: true,
    functional: true,
    analytics: false,
    marketing: false,
    timestamp: Date.now(),
    version: '1.0.0',
    lastUpdated: Date.now(),
    method: 'banner_accept_all' as ConsentMethod,
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('addConsentHistoryEntry', () => {
    it('should add a new history entry', () => {
      const entry = addConsentHistoryEntry(mockConsentState, 'user_action');

      expect(entry).toEqual({
        timestamp: Date.now(),
        date: '2024-01-15T10:00:00.000Z',
        consent: mockConsentState,
        trigger: 'user_action',
        method: 'banner_accept_all',
        categories: {
          necessary: true,
          functional: true,
          analytics: false,
          marketing: false,
        },
      });

      // Verify it was saved to localStorage
      const history = getConsentHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(entry);
    });

    it('should add multiple entries in chronological order', () => {
      addConsentHistoryEntry(mockConsentState, 'initial');

      vi.advanceTimersByTime(1000);
      const updatedConsent = { ...mockConsentState, analytics: true };
      addConsentHistoryEntry(updatedConsent, 'update');

      const history = getConsentHistory();
      expect(history).toHaveLength(2);
      expect(history[0].trigger).toBe('initial');
      expect(history[1].trigger).toBe('update');
      expect(history[1].categories.analytics).toBe(true);
    });

    it('should store different consent methods', () => {
      const entries = [
        { ...mockConsentState, method: 'banner_accept_all' as ConsentMethod },
        { ...mockConsentState, method: 'modal_custom' as ConsentMethod },
        { ...mockConsentState, method: 'banner_reject_all' as ConsentMethod },
      ];

      entries.forEach((consent, index) => {
        vi.advanceTimersByTime(1000);
        addConsentHistoryEntry(consent, `action_${index}`);
      });

      const history = getConsentHistory();
      expect(history[0].method).toBe('banner_accept_all');
      expect(history[1].method).toBe('modal_custom');
      expect(history[2].method).toBe('banner_reject_all');
    });
  });

  describe('pruneConsentHistory', () => {
    it('should maintain maximum of 50 entries', () => {
      // Add 60 entries
      for (let i = 0; i < 60; i++) {
        vi.advanceTimersByTime(1000);
        addConsentHistoryEntry(mockConsentState, `action_${i}`);
      }

      const history = getConsentHistory();
      expect(history).toHaveLength(50);

      // Should keep the most recent 50 entries
      expect(history[0].trigger).toBe('action_10'); // Oldest kept
      expect(history[49].trigger).toBe('action_59'); // Newest
    });

    it('should remove oldest entries first (FIFO)', () => {
      // Add 50 entries
      for (let i = 0; i < 50; i++) {
        vi.advanceTimersByTime(1000);
        addConsentHistoryEntry(mockConsentState, `action_${i}`);
      }

      // Add one more
      vi.advanceTimersByTime(1000);
      addConsentHistoryEntry(mockConsentState, 'new_action');

      const history = getConsentHistory();
      expect(history).toHaveLength(50);
      expect(history[0].trigger).toBe('action_1'); // action_0 removed
      expect(history[49].trigger).toBe('new_action');
    });

    it('should handle manual pruning', () => {
      // Add 30 entries
      for (let i = 0; i < 30; i++) {
        addConsentHistoryEntry(mockConsentState, `action_${i}`);
      }

      const pruned = pruneConsentHistory(10);
      expect(pruned).toHaveLength(10);
      expect(pruned[0].trigger).toBe('action_20'); // Kept last 10
      expect(pruned[9].trigger).toBe('action_29');

      // Should be saved to localStorage
      const history = getConsentHistory();
      expect(history).toHaveLength(10);
    });
  });

  describe('getConsentHistory', () => {
    it('should return empty array when no history exists', () => {
      const history = getConsentHistory();
      expect(history).toEqual([]);
    });

    it('should parse stored history from localStorage', () => {
      const mockHistory: ConsentHistoryEntry[] = [
        {
          timestamp: Date.now() - 10000,
          date: new Date(Date.now() - 10000).toISOString(),
          consent: mockConsentState,
          trigger: 'test',
          method: 'banner_accept_all',
          categories: {
            necessary: true,
            functional: true,
            analytics: false,
            marketing: false,
          },
        },
      ];

      localStorage.setItem('consentHistory', JSON.stringify(mockHistory));

      const history = getConsentHistory();
      expect(history).toEqual(mockHistory);
    });

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('consentHistory', 'invalid json{');

      const history = getConsentHistory();
      expect(history).toEqual([]);
    });

    it('should handle partially corrupted entries', () => {
      const validEntry: ConsentHistoryEntry = {
        timestamp: Date.now(),
        date: new Date().toISOString(),
        consent: mockConsentState,
        trigger: 'valid',
        method: 'banner_accept_all',
        categories: {
          necessary: true,
          functional: false,
          analytics: false,
          marketing: false,
        },
      };

      const invalidEntry = { invalid: 'entry' };

      localStorage.setItem(
        'consentHistory',
        JSON.stringify([validEntry, invalidEntry, validEntry])
      );

      const history = getConsentHistory();
      // Should filter out invalid entries
      expect(history).toHaveLength(2);
      expect(history[0].trigger).toBe('valid');
      expect(history[1].trigger).toBe('valid');
    });
  });

  describe('clearConsentHistory', () => {
    it('should remove all history entries', () => {
      // Add some entries
      addConsentHistoryEntry(mockConsentState, 'action1');
      addConsentHistoryEntry(mockConsentState, 'action2');
      addConsentHistoryEntry(mockConsentState, 'action3');

      expect(getConsentHistory()).toHaveLength(3);

      clearConsentHistory();

      expect(getConsentHistory()).toHaveLength(0);
      expect(localStorage.getItem('consentHistory')).toBeNull();
    });

    it('should handle clearing when no history exists', () => {
      expect(() => clearConsentHistory()).not.toThrow();
      expect(getConsentHistory()).toHaveLength(0);
    });
  });

  describe('formatConsentHistory', () => {
    it('should format history for export', () => {
      const history: ConsentHistoryEntry[] = [
        {
          timestamp: Date.now() - 86400000, // 1 day ago
          date: new Date(Date.now() - 86400000).toISOString(),
          consent: mockConsentState,
          trigger: 'initial_load',
          method: 'default',
          categories: {
            necessary: true,
            functional: false,
            analytics: false,
            marketing: false,
          },
        },
        {
          timestamp: Date.now(),
          date: new Date().toISOString(),
          consent: { ...mockConsentState, functional: true },
          trigger: 'user_action',
          method: 'banner_accept_all',
          categories: {
            necessary: true,
            functional: true,
            analytics: false,
            marketing: false,
          },
        },
      ];

      const formatted = formatConsentHistory(history);

      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toHaveProperty('date');
      expect(formatted[0]).toHaveProperty('action');
      expect(formatted[0]).toHaveProperty('categories');
      expect(formatted[0].action).toBe('initial_load - default');
      expect(formatted[1].action).toBe('user_action - banner_accept_all');
    });

    it('should include summary of consent changes', () => {
      const history: ConsentHistoryEntry[] = [
        {
          timestamp: Date.now(),
          date: new Date().toISOString(),
          consent: mockConsentState,
          trigger: 'update',
          method: 'modal_custom',
          categories: {
            necessary: true,
            functional: true,
            analytics: true,
            marketing: false,
          },
        },
      ];

      const formatted = formatConsentHistory(history);

      expect(formatted[0].categories).toEqual({
        necessary: true,
        functional: true,
        analytics: true,
        marketing: false,
      });
      expect(formatted[0].summary).toBe('Necessary, Functional, Analytics');
    });

    it('should handle empty history', () => {
      const formatted = formatConsentHistory([]);
      expect(formatted).toEqual([]);
    });

    it('should sort by timestamp in ascending order', () => {
      const history: ConsentHistoryEntry[] = [
        {
          timestamp: Date.now(),
          date: new Date().toISOString(),
          consent: mockConsentState,
          trigger: 'newest',
          method: 'modal_custom',
          categories: mockConsentState,
        },
        {
          timestamp: Date.now() - 10000,
          date: new Date(Date.now() - 10000).toISOString(),
          consent: mockConsentState,
          trigger: 'older',
          method: 'banner_accept_all',
          categories: mockConsentState,
        },
        {
          timestamp: Date.now() - 5000,
          date: new Date(Date.now() - 5000).toISOString(),
          consent: mockConsentState,
          trigger: 'middle',
          method: 'default',
          categories: mockConsentState,
        },
      ];

      const formatted = formatConsentHistory(history);

      expect(formatted[0].action).toContain('older');
      expect(formatted[1].action).toContain('middle');
      expect(formatted[2].action).toContain('newest');
    });
  });

  describe('Integration with consent state changes', () => {
    it('should track complete consent lifecycle', () => {
      // Initial state - no consent
      const initial: ConsentState = {
        necessary: true,
        functional: false,
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
        version: '1.0.0',
        lastUpdated: Date.now(),
        method: 'default' as ConsentMethod,
      };
      addConsentHistoryEntry(initial, 'page_load');

      // User accepts all
      vi.advanceTimersByTime(5000);
      const acceptAll: ConsentState = {
        ...initial,
        functional: true,
        analytics: true,
        marketing: true,
        method: 'banner_accept_all' as ConsentMethod,
        lastUpdated: Date.now(),
      };
      addConsentHistoryEntry(acceptAll, 'user_accept_all');

      // User customizes preferences
      vi.advanceTimersByTime(10000);
      const customized: ConsentState = {
        ...acceptAll,
        marketing: false,
        method: 'modal_custom' as ConsentMethod,
        lastUpdated: Date.now(),
      };
      addConsentHistoryEntry(customized, 'user_customize');

      // User revokes consent
      vi.advanceTimersByTime(20000);
      const revoked: ConsentState = {
        ...initial,
        method: 'user_revoke' as ConsentMethod,
        lastUpdated: Date.now(),
      };
      addConsentHistoryEntry(revoked, 'user_revoke');

      const history = getConsentHistory();
      expect(history).toHaveLength(4);

      // Verify the progression
      expect(history[0].trigger).toBe('page_load');
      expect(history[0].categories.functional).toBe(false);

      expect(history[1].trigger).toBe('user_accept_all');
      expect(history[1].categories.functional).toBe(true);
      expect(history[1].categories.marketing).toBe(true);

      expect(history[2].trigger).toBe('user_customize');
      expect(history[2].categories.marketing).toBe(false);

      expect(history[3].trigger).toBe('user_revoke');
      expect(history[3].categories.functional).toBe(false);
    });
  });
});
