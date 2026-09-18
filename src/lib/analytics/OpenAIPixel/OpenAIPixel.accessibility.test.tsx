import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';
import OpenAIPixel from './OpenAIPixel';
import { useConsent } from '@/contexts/ConsentContext';
import {
  createMockConsentAllAccepted,
  createMockConsentAllRejected,
} from '@/test-utils/consent-mocks';

expect.extend(toHaveNoViolations);

vi.mock('next/script', () => ({ default: vi.fn(() => null) }));
vi.mock('@/contexts/ConsentContext', () => ({ useConsent: vi.fn() }));

const mockUseConsent = vi.mocked(useConsent);

describe('OpenAIPixel accessibility', () => {
  it('adds nothing to the accessibility tree when consent is granted', async () => {
    // A measurement script is invisible by nature; the assertion worth making is that it
    // stays that way and never injects anything a screen reader has to step over.
    mockUseConsent.mockReturnValue(createMockConsentAllAccepted());
    const { container } = render(<OpenAIPixel />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('adds nothing when consent is denied either', async () => {
    mockUseConsent.mockReturnValue(createMockConsentAllRejected());
    const { container } = render(<OpenAIPixel />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
