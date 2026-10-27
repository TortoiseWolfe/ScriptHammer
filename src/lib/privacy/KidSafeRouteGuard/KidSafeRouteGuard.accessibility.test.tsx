import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import KidSafeRouteGuard from './KidSafeRouteGuard';

expect.extend(toHaveNoViolations);

vi.mock('next/navigation', () => ({ usePathname: () => '/band/' }));

describe('KidSafeRouteGuard accessibility', () => {
  it('renders nothing for a screen reader to step over', async () => {
    const { container } = render(<KidSafeRouteGuard />);
    expect(container).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });
});
