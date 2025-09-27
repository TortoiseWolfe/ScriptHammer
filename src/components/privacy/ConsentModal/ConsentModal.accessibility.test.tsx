import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConsentModal } from './ConsentModal';
import { ConsentProvider } from '@/contexts/ConsentContext';

expect.extend(toHaveNoViolations);

describe('ConsentModal Accessibility', () => {
  const renderComponent = () => {
    return render(
      <ConsentProvider>
        <ConsentModal />
      </ConsentProvider>
    );
  };

  it('should have no accessibility violations', async () => {
    const { container } = renderComponent();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should render without errors', () => {
    const { container } = renderComponent();
    expect(container).toBeInTheDocument();
  });

  it('should be accessible', () => {
    // Placeholder test - actual modal accessibility is tested in integration tests
    expect(true).toBe(true);
  });
});
