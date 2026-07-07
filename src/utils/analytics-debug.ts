/**
 * Analytics Debug Utilities
 * Provides debugging tools for Google Analytics integration
 */

import { isAnalyticsEnabled } from './analytics';
import { createLogger } from '@/lib/logger';

const logger = createLogger('utils:analytics-debug');

interface DebugEvent {
  timestamp: Date;
  type: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  parameters?: Record<string, unknown>;
}

class AnalyticsDebugger {
  private events: DebugEvent[] = [];
  private isDebugMode: boolean = false;
  private maxEvents: number = 100;

  constructor() {
    if (typeof window !== 'undefined') {
      // Check for debug mode in URL or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      this.isDebugMode =
        urlParams.get('ga_debug') === 'true' ||
        localStorage.getItem('ga_debug') === 'true' ||
        process.env.NODE_ENV === 'development';

      // Expose to window for console access
      (window as Window & { __GA_DEBUG__?: AnalyticsDebugger }).__GA_DEBUG__ =
        this;
    }
  }

  /**
   * Enable debug mode
   */
  enable(): void {
    this.isDebugMode = true;
    localStorage.setItem('ga_debug', 'true');
    logger.info('GA Debug Mode: ENABLED');
    this.logStatus();
  }

  /**
   * Disable debug mode
   */
  disable(): void {
    this.isDebugMode = false;
    localStorage.removeItem('ga_debug');
    logger.info('GA Debug Mode: DISABLED');
  }

  /**
   * Log current analytics status
   */
  logStatus(): void {
    logger.info('Google Analytics Status', {
      enabled: isAnalyticsEnabled(),
      measurementId:
        process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'Not configured',
      debugMode: this.isDebugMode,
      consent: this.getConsentStatus(),
      eventsTracked: this.events.length,
      dataLayerSize:
        typeof window !== 'undefined' && window.dataLayer
          ? window.dataLayer.length
          : 0,
    });
  }

  /**
   * Get current consent status
   */
  private getConsentStatus(): string {
    if (typeof window === 'undefined') return 'N/A';

    const consent = localStorage.getItem('cookie-consent');
    if (!consent) return 'Not set';

    try {
      const parsed = JSON.parse(consent);
      return parsed.analytics ? 'Granted' : 'Denied';
    } catch {
      return 'Invalid';
    }
  }

  /**
   * Log an event (called internally by analytics)
   */
  logEvent(
    action: string,
    category?: string,
    label?: string,
    value?: number,
    parameters?: Record<string, unknown>
  ): void {
    if (!this.isDebugMode) return;

    const event: DebugEvent = {
      timestamp: new Date(),
      type: 'custom',
      action,
      category,
      label,
      value,
      parameters,
    };

    this.events.push(event);

    // Limit stored events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log to console
    logger.debug(`GA Event: ${action}`, {
      category: category || 'N/A',
      label: label || 'N/A',
      value: value || 'N/A',
      parameters: parameters || undefined,
    });
  }

  /**
   * Get recent events
   */
  getEvents(count?: number): DebugEvent[] {
    return this.events.slice(-(count || 10));
  }

  /**
   * Clear event history
   */
  clearEvents(): void {
    this.events = [];
    logger.info('Event history cleared');
  }

  /**
   * Inspect dataLayer
   */
  inspectDataLayer(): void {
    if (typeof window === 'undefined' || !window.dataLayer) {
      logger.warn('DataLayer not available');
      return;
    }

    // Group by event type
    const eventTypes = new Map<string, number>();
    window.dataLayer.forEach((entry: unknown) => {
      if (Array.isArray(entry) && entry[0] === 'event') {
        const eventName = entry[1];
        eventTypes.set(eventName, (eventTypes.get(eventName) || 0) + 1);
      }
    });

    logger.info('DataLayer Inspection', {
      totalEntries: window.dataLayer.length,
      eventTypes: Object.fromEntries(eventTypes),
      lastEntries: window.dataLayer.slice(-5),
    });
  }

  /**
   * Test event tracking
   */
  testEvent(): void {
    logger.info('Sending test event...');

    if (!window.gtag) {
      logger.error(
        'gtag not available - ensure analytics is loaded and consent granted'
      );
      return;
    }

    window.gtag('event', 'debug_test', {
      event_category: 'Debug',
      event_label: 'Test Event',
      value: Math.floor(Math.random() * 100),
      debug_timestamp: new Date().toISOString(),
    });

    logger.info('Test event sent - check GA4 DebugView');
  }

  /**
   * Validate implementation
   */
  validate(): void {
    const checks = [
      {
        name: 'Measurement ID configured',
        pass: !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      },
      {
        name: 'gtag function exists',
        pass:
          typeof window !== 'undefined' && typeof window.gtag === 'function',
      },
      {
        name: 'dataLayer exists',
        pass: typeof window !== 'undefined' && Array.isArray(window.dataLayer),
      },
      {
        name: 'Consent integration',
        pass:
          typeof window !== 'undefined' &&
          !!localStorage.getItem('cookie-consent'),
      },
      {
        name: 'Analytics enabled',
        pass: isAnalyticsEnabled(),
      },
    ];

    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass);

    logger.info('GA Implementation Validation', {
      passed,
      total: checks.length,
      checks: checks.map((c) => ({ name: c.name, pass: c.pass })),
      failedChecks: failed.map((c) => c.name),
    });
  }

  /**
   * Monitor events in real-time
   */
  startMonitoring(): void {
    if (typeof window === 'undefined' || !window.dataLayer) {
      logger.error('Cannot monitor - dataLayer not available');
      return;
    }

    logger.info('Starting event monitoring...');

    // Override push to intercept new events
    const originalPush = window.dataLayer.push;
    window.dataLayer.push = function (...args: unknown[]) {
      logger.debug('New dataLayer entry', { args });
      return originalPush.apply(window.dataLayer, args);
    };

    logger.info('Monitoring active - all new events will be logged');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    logger.info('Stopping event monitoring...');
    // Note: This would need to restore the original push function
    // For simplicity, recommend page refresh
    logger.info('Refresh the page to fully stop monitoring');
  }

  /**
   * Export debug data
   */
  exportDebugData(): string {
    const data = {
      timestamp: new Date().toISOString(),
      status: {
        enabled: isAnalyticsEnabled(),
        measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
        consent: this.getConsentStatus(),
        debugMode: this.isDebugMode,
      },
      events: this.events,
      dataLayerSize:
        typeof window !== 'undefined' && window.dataLayer
          ? window.dataLayer.length
          : 0,
    };

    const json = JSON.stringify(data, null, 2);

    // Create download link
    if (typeof window !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ga-debug-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    return json;
  }
}

// Create singleton instance
const analyticsDebugger = new AnalyticsDebugger();

// Export debugger instance and utility functions
export default analyticsDebugger;

/**
 * Quick debug utilities for console
 */
export const gaDebug = {
  enable: () => analyticsDebugger.enable(),
  disable: () => analyticsDebugger.disable(),
  status: () => analyticsDebugger.logStatus(),
  events: (count?: number) => analyticsDebugger.getEvents(count),
  clear: () => analyticsDebugger.clearEvents(),
  inspect: () => analyticsDebugger.inspectDataLayer(),
  test: () => analyticsDebugger.testEvent(),
  validate: () => analyticsDebugger.validate(),
  monitor: () => analyticsDebugger.startMonitoring(),
  stop: () => analyticsDebugger.stopMonitoring(),
  export: () => analyticsDebugger.exportDebugData(),
};

// Auto-initialize in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  logger.info(
    'GA Debug utilities available: window.__GA_DEBUG__ or import { gaDebug }'
  );
}
