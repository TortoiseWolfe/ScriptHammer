import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SetupBanner } from './SetupBanner';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
  isSupabaseConfigured: vi.fn(() => false),
}));

expect.extend(toHaveNoViolations);

describe('SetupBanner Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<SetupBanner show={true} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with custom message', async () => {
    const { container } = render(
      <SetupBanner show={true} message="Custom accessibility test message" />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations without docs link', async () => {
    const { container } = render(<SetupBanner show={true} docsUrl="" />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
