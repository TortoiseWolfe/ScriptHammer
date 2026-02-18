import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import CaptainShipCrewWithNPC from './CaptainShipCrewWithNPC';

expect.extend(toHaveNoViolations);

describe('CaptainShipCrewWithNPC Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<CaptainShipCrewWithNPC />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
