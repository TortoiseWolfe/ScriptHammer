/**
 * The pixel must not load without MARKETING consent (FR-026), and must not hold a click
 * identifier for someone who declined. Those two are the whole point of the component; the
 * rest is a script tag.
 */

import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import OpenAIPixel from './OpenAIPixel';
import { useConsent } from '@/contexts/ConsentContext';
import {
  createMockConsentAllAccepted,
  createMockConsentAllRejected,
  createMockConsentWithAnalytics,
} from '@/test-utils/consent-mocks';

interface ScriptProps {
  children?: string;
  id?: string;
}

vi.mock('next/script', () => ({
  default: vi.fn(({ children, id }: ScriptProps) =>
    children && id
      ? React.createElement('script', {
          'data-testid': `pixel-${id}`,
          dangerouslySetInnerHTML: { __html: children },
        })
      : null
  ),
}));

vi.mock('@/contexts/ConsentContext', () => ({
  useConsent: vi.fn(),
}));

const mockUseConsent = vi.mocked(useConsent);

describe('OpenAIPixel', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_OPENAI_PIXEL_ID = 'px_test_123';
    window.sessionStorage.clear();
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_OPENAI_PIXEL_ID;
    vi.clearAllMocks();
  });

  it('renders NOTHING when marketing consent is denied', () => {
    mockUseConsent.mockReturnValue(createMockConsentAllRejected());
    const { container } = render(<OpenAIPixel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders NOTHING on analytics-only consent — marketing is a separate choice', () => {
    // GoogleAnalytics next door gates on `analytics`. Accepting site measurement is not
    // the same as accepting an advertising network, and this asserts we do not conflate them.
    mockUseConsent.mockReturnValue(createMockConsentWithAnalytics());
    const { container } = render(<OpenAIPixel />);
    expect(container.innerHTML).toBe('');
  });

  it('renders NOTHING when no pixel id is configured, even with full consent', () => {
    delete process.env.NEXT_PUBLIC_OPENAI_PIXEL_ID;
    mockUseConsent.mockReturnValue(createMockConsentAllAccepted());
    const { container } = render(<OpenAIPixel />);
    expect(container.innerHTML).toBe('');
  });

  it('CONTROL: it CAN render, so the three assertions above mean something', () => {
    mockUseConsent.mockReturnValue(createMockConsentAllAccepted());
    const { container } = render(<OpenAIPixel />);
    expect(container.innerHTML).not.toBe('');
  });

  it('embeds the configured pixel id, JSON-encoded rather than interpolated raw', () => {
    mockUseConsent.mockReturnValue(createMockConsentAllAccepted());
    const { getByTestId } = render(<OpenAIPixel />);
    const html = getByTestId('pixel-openai-ads-pixel').innerHTML;
    expect(html).toContain('"px_test_123"');
    expect(html).toContain('bzrcdn.openai.com');
  });

  it('forgets the stored click id when consent is withdrawn', () => {
    window.sessionStorage.setItem('sh:ads:oppref', 'CLICK123');
    mockUseConsent.mockReturnValue(createMockConsentAllRejected());
    render(<OpenAIPixel />);
    expect(window.sessionStorage.getItem('sh:ads:oppref')).toBeNull();
  });
});
