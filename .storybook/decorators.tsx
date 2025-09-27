import React from 'react';
import { ConsentProvider } from '../src/contexts/ConsentContext';

export const withConsentProvider = (Story: React.ComponentType) => (
  <ConsentProvider>
    <Story />
  </ConsentProvider>
);
