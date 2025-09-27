import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentProvider, useConsent } from './ConsentContext';
import {
  ConsentState,
  ConsentMethod,
  CookieCategory,
  StorageKey,
} from '../utils/consent-types';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Test component to access context
const TestComponent = () => {
  const context = useConsent();
  return (
    <div>
      <div data-testid="necessary">
        {context.consent.necessary ? 'Necessary enabled' : 'No consent'}
      </div>
      <div data-testid="functional">
        {context.consent.functional
          ? 'Functional enabled'
          : 'Functional disabled'}
      </div>
      <div data-testid="analytics">
        {context.consent.analytics ? 'Analytics enabled' : 'Analytics disabled'}
      </div>
      <div data-testid="marketing">
        {context.consent.marketing ? 'Marketing enabled' : 'Marketing disabled'}
      </div>
      <div data-testid="show-banner">
        {context.showBanner ? 'Banner visible' : 'Banner hidden'}
      </div>
      <div data-testid="show-modal">
        {context.showModal ? 'Modal visible' : 'Modal hidden'}
      </div>
      <div data-testid="has-consented">
        {context.hasConsented() ? 'Has consented' : 'No consent yet'}
      </div>

      <button onClick={() => context.acceptAll()}>Accept All</button>
      <button onClick={() => context.rejectAll()}>Reject All</button>
      <button
        onClick={() => context.updateConsent(CookieCategory.FUNCTIONAL, true)}
      >
        Enable Functional
      </button>
      <button
        onClick={() => context.updateConsent(CookieCategory.ANALYTICS, true)}
      >
        Enable Analytics
      </button>
      <button onClick={() => context.dismissBanner()}>Dismiss Banner</button>
      <button onClick={() => context.openModal()}>Open Modal</button>
      <button onClick={() => context.closeModal()}>Close Modal</button>
      <button onClick={() => context.resetConsent()}>Reset Consent</button>

      <div data-testid="can-use-functional">
        {context.canUseCookies(CookieCategory.FUNCTIONAL)
          ? 'Can use functional'
          : 'Cannot use functional'}
      </div>
      <div data-testid="can-use-analytics">
        {context.canUseCookies(CookieCategory.ANALYTICS)
          ? 'Can use analytics'
          : 'Cannot use analytics'}
      </div>
    </div>
  );
};

describe('ConsentContext', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    // Reset to return null by default (first visit scenario)
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Initial state', () => {
    it('should provide default consent state', () => {
      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      expect(screen.getByTestId('necessary')).toHaveTextContent(
        'Necessary enabled'
      );
      expect(screen.getByTestId('functional')).toHaveTextContent(
        'Functional disabled'
      );
      expect(screen.getByTestId('analytics')).toHaveTextContent(
        'Analytics disabled'
      );
      expect(screen.getByTestId('marketing')).toHaveTextContent(
        'Marketing disabled'
      );
    });

    it('should show banner on first visit', () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      expect(screen.getByTestId('show-banner')).toHaveTextContent(
        'Banner visible'
      );
      expect(screen.getByTestId('has-consented')).toHaveTextContent(
        'No consent yet'
      );
    });

    it('should load consent from localStorage if available', () => {
      const storedConsent: ConsentState = {
        necessary: true,
        functional: true,
        analytics: true,
        marketing: false,
        timestamp: Date.now(),
        version: '1.0.0',
        lastUpdated: Date.now(),
        method: ConsentMethod.BANNER_ACCEPT_ALL,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedConsent));

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      expect(screen.getByTestId('functional')).toHaveTextContent(
        'Functional enabled'
      );
      expect(screen.getByTestId('analytics')).toHaveTextContent(
        'Analytics enabled'
      );
      expect(screen.getByTestId('show-banner')).toHaveTextContent(
        'Banner hidden'
      );
      expect(screen.getByTestId('has-consented')).toHaveTextContent(
        'Has consented'
      );
    });
  });

  describe('Consent actions', () => {
    it('should accept all cookies', async () => {
      const user = userEvent.setup();

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      await user.click(screen.getByText('Accept All'));

      await waitFor(() => {
        expect(screen.getByTestId('functional')).toHaveTextContent(
          'Functional enabled'
        );
        expect(screen.getByTestId('analytics')).toHaveTextContent(
          'Analytics enabled'
        );
        expect(screen.getByTestId('marketing')).toHaveTextContent(
          'Marketing enabled'
        );
        expect(screen.getByTestId('show-banner')).toHaveTextContent(
          'Banner hidden'
        );
      });

      // Check localStorage was updated
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        StorageKey.CONSENT,
        expect.stringContaining('"functional":true')
      );
    });

    it('should reject all optional cookies', async () => {
      const user = userEvent.setup();

      // Start with all enabled
      const storedConsent: ConsentState = {
        necessary: true,
        functional: true,
        analytics: true,
        marketing: true,
        timestamp: Date.now(),
        version: '1.0.0',
        lastUpdated: Date.now(),
        method: ConsentMethod.BANNER_ACCEPT_ALL,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedConsent));

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      await user.click(screen.getByText('Reject All'));

      await waitFor(() => {
        expect(screen.getByTestId('necessary')).toHaveTextContent(
          'Necessary enabled'
        );
        expect(screen.getByTestId('functional')).toHaveTextContent(
          'Functional disabled'
        );
        expect(screen.getByTestId('analytics')).toHaveTextContent(
          'Analytics disabled'
        );
        expect(screen.getByTestId('marketing')).toHaveTextContent(
          'Marketing disabled'
        );
        expect(screen.getByTestId('show-banner')).toHaveTextContent(
          'Banner hidden'
        );
      });
    });

    it('should update individual consent categories', async () => {
      const user = userEvent.setup();

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      await user.click(screen.getByText('Enable Functional'));

      await waitFor(() => {
        expect(screen.getByTestId('functional')).toHaveTextContent(
          'Functional enabled'
        );
        expect(screen.getByTestId('analytics')).toHaveTextContent(
          'Analytics disabled'
        );
      });

      await user.click(screen.getByText('Enable Analytics'));

      await waitFor(() => {
        expect(screen.getByTestId('analytics')).toHaveTextContent(
          'Analytics enabled'
        );
      });
    });

    it('should reset consent to default', async () => {
      const user = userEvent.setup();

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      // First accept all
      await user.click(screen.getByText('Accept All'));

      await waitFor(() => {
        expect(screen.getByTestId('functional')).toHaveTextContent(
          'Functional enabled'
        );
      });

      // Then reset
      await user.click(screen.getByText('Reset Consent'));

      await waitFor(() => {
        expect(screen.getByTestId('functional')).toHaveTextContent(
          'Functional disabled'
        );
        expect(screen.getByTestId('analytics')).toHaveTextContent(
          'Analytics disabled'
        );
        expect(screen.getByTestId('marketing')).toHaveTextContent(
          'Marketing disabled'
        );
        expect(screen.getByTestId('show-banner')).toHaveTextContent(
          'Banner visible'
        );
      });

      // Check localStorage was cleared
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        StorageKey.CONSENT
      );
    });
  });

  describe('UI controls', () => {
    it('should dismiss banner', async () => {
      const user = userEvent.setup();

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      expect(screen.getByTestId('show-banner')).toHaveTextContent(
        'Banner visible'
      );

      await user.click(screen.getByText('Dismiss Banner'));

      await waitFor(() => {
        expect(screen.getByTestId('show-banner')).toHaveTextContent(
          'Banner hidden'
        );
      });
    });

    it('should open and close modal', async () => {
      const user = userEvent.setup();

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      expect(screen.getByTestId('show-modal')).toHaveTextContent(
        'Modal hidden'
      );

      await user.click(screen.getByText('Open Modal'));

      await waitFor(() => {
        expect(screen.getByTestId('show-modal')).toHaveTextContent(
          'Modal visible'
        );
      });

      await user.click(screen.getByText('Close Modal'));

      await waitFor(() => {
        expect(screen.getByTestId('show-modal')).toHaveTextContent(
          'Modal hidden'
        );
      });
    });
  });

  describe('Utility functions', () => {
    it('should check if cookies can be used for categories', () => {
      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      // Initially only necessary cookies allowed
      expect(screen.getByTestId('can-use-functional')).toHaveTextContent(
        'Cannot use functional'
      );
      expect(screen.getByTestId('can-use-analytics')).toHaveTextContent(
        'Cannot use analytics'
      );
    });

    it('should update canUseCookies after consent changes', async () => {
      const user = userEvent.setup();

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      await user.click(screen.getByText('Enable Functional'));

      await waitFor(() => {
        expect(screen.getByTestId('can-use-functional')).toHaveTextContent(
          'Can use functional'
        );
        expect(screen.getByTestId('can-use-analytics')).toHaveTextContent(
          'Cannot use analytics'
        );
      });
    });
  });

  describe('Error handling', () => {
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not crash
      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      expect(screen.getByTestId('necessary')).toHaveTextContent(
        'Necessary enabled'
      );
    });

    it('should handle invalid stored consent', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      render(
        <ConsentProvider>
          <TestComponent />
        </ConsentProvider>
      );

      // Should use default consent
      expect(screen.getByTestId('functional')).toHaveTextContent(
        'Functional disabled'
      );
      expect(screen.getByTestId('show-banner')).toHaveTextContent(
        'Banner visible'
      );
    });
  });

  describe('useConsent hook outside provider', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useConsent must be used within a ConsentProvider');

      console.error = originalError;
    });
  });
});
