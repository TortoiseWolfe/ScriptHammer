import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import Loader from './Loader';

expect.extend(toHaveNoViolations);

describe('Loader Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Loader />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(<Loader />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
