import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import DraggableDice from './DraggableDice';

expect.extend(toHaveNoViolations);

describe('DraggableDice Accessibility', () => {
  it('should have no accessibility violations with required props', async () => {
    const { container } = render(<DraggableDice id="dice-1" value={1} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
