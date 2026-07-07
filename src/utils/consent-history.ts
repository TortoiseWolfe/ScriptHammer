import { ConsentState } from './consent-types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:consent-history');

/**
 * Consent history entry structure
 */
export interface ConsentHistoryEntry {
  timestamp: number;
  date: string;
  consent: ConsentState;
  trigger: string;
  method: string;
  categories: {
    necessary: boolean;
    functional: boolean;
    analytics: boolean;
    marketing: boolean;
  };
}

/**
 * Formatted history entry for export
 */
export interface FormattedHistoryEntry {
  date: string;
  action: string;
  categories: {
    necessary: boolean;
    functional: boolean;
    analytics: boolean;
    marketing: boolean;
  };
  summary: string;
}

const HISTORY_KEY = 'consentHistory';
const MAX_HISTORY_ENTRIES = 50;

/**
 * Validate if an entry is a valid ConsentHistoryEntry
 */
function isValidHistoryEntry(entry: unknown): entry is ConsentHistoryEntry {
  if (!entry || typeof entry !== 'object') return false;

  const e = entry as Record<string, unknown>;

  return (
    typeof e.timestamp === 'number' &&
    typeof e.date === 'string' &&
    typeof e.trigger === 'string' &&
    typeof e.method === 'string' &&
    e.consent !== undefined &&
    e.categories !== undefined &&
    typeof e.categories === 'object'
  );
}

/**
 * Get consent history from localStorage
 */
export function getConsentHistory(): ConsentHistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    // Filter out invalid entries
    return parsed.filter(isValidHistoryEntry);
  } catch {
    // If parsing fails, return empty array
    return [];
  }
}

/**
 * Save consent history to localStorage
 */
function saveConsentHistory(history: ConsentHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    logger.error('Failed to save consent history', { error });
  }
}

/**
 * Add a new consent history entry
 */
export function addConsentHistoryEntry(
  consent: ConsentState,
  trigger: string
): ConsentHistoryEntry {
  const entry: ConsentHistoryEntry = {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    consent,
    trigger,
    method: consent.method || 'unknown',
    categories: {
      necessary: consent.necessary,
      functional: consent.functional,
      analytics: consent.analytics,
      marketing: consent.marketing,
    },
  };

  // Get existing history
  const history = getConsentHistory();

  // Add new entry
  history.push(entry);

  // Prune if necessary (keep last 50)
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.splice(0, history.length - MAX_HISTORY_ENTRIES);
  }

  // Save to localStorage
  saveConsentHistory(history);

  return entry;
}

/**
 * Prune consent history to specified limit
 */
export function pruneConsentHistory(limit: number): ConsentHistoryEntry[] {
  const history = getConsentHistory();

  if (history.length <= limit) {
    return history;
  }

  // Keep the most recent entries
  const pruned = history.slice(-limit);
  saveConsentHistory(pruned);

  return pruned;
}

/**
 * Clear all consent history
 */
export function clearConsentHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

/**
 * Format consent history for export/display
 */
export function formatConsentHistory(
  history: ConsentHistoryEntry[]
): FormattedHistoryEntry[] {
  // Sort by timestamp ascending (oldest first)
  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);

  return sorted.map((entry) => {
    // Create summary of enabled categories
    const enabledCategories: string[] = [];
    if (entry.categories.necessary) enabledCategories.push('Necessary');
    if (entry.categories.functional) enabledCategories.push('Functional');
    if (entry.categories.analytics) enabledCategories.push('Analytics');
    if (entry.categories.marketing) enabledCategories.push('Marketing');

    return {
      date: entry.date,
      action: `${entry.trigger} - ${entry.method}`,
      categories: entry.categories,
      summary: enabledCategories.join(', ') || 'None',
    };
  });
}
