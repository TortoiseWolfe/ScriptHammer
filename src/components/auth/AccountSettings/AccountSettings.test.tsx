import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AccountSettings from './AccountSettings';

describe('AccountSettings', () => {
  it('renders without crashing', () => {
    render(<AccountSettings />);
    const element = screen.getByText(/AccountSettings/i);
    expect(element).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    const testContent = 'Test Content';
    render(<AccountSettings>{testContent}</AccountSettings>);
    const element = screen.getByText(testContent);
    expect(element).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<AccountSettings className={customClass} />);
    const element = container.querySelector('.account-settings');
    expect(element).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for AccountSettings functionality
});
