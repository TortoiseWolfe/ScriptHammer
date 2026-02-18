import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import CaptainShipCrew from './CaptainShipCrew';

expect.extend(toHaveNoViolations);

describe('CaptainShipCrew Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<CaptainShipCrew />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
