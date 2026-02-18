import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Dice from './Dice';

expect.extend(toHaveNoViolations);

describe('Dice Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<Dice />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
