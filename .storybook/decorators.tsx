import React, { useEffect } from 'react';
import { ConsentProvider, useConsent } from '../src/contexts/ConsentContext';
import { CookieCategory } from '../src/utils/consent-types';
import { AuthProvider } from '../src/contexts/AuthContext';

export const withConsentProvider = (Story: React.ComponentType) => (
  <ConsentProvider>
    <Story />
  </ConsentProvider>
);

/**
 * Decorator that wraps in ConsentProvider and auto-accepts functional consent.
 * Use for components that require functional consent (e.g. CalendarEmbed).
 */
function AutoAcceptFunctional({ children }: { children: React.ReactNode }) {
  const { consent, updateConsent } = useConsent();
  useEffect(() => {
    if (!consent.functional) {
      updateConsent(CookieCategory.FUNCTIONAL, true);
    }
  }, [consent.functional, updateConsent]);
  return <>{children}</>;
}

export const withFunctionalConsent = (Story: React.ComponentType) => (
  <ConsentProvider>
    <AutoAcceptFunctional>
      <Story />
    </AutoAcceptFunctional>
  </ConsentProvider>
);

/**
 * Decorator that wraps in AuthProvider.
 * Use for components that call useAuth() (e.g. MessagingGate, ReAuthModal, ChatWindow).
 */
export const withAuthProvider = (Story: React.ComponentType) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);
