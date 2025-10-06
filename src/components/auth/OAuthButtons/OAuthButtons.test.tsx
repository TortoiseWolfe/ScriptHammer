import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OAuthButtons from './OAuthButtons';

describe('OAuthButtons', () => {
  it('renders without crashing', () => {
    render(<OAuthButtons />);
    expect(screen.getByRole('button', { name: /github/i })).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<OAuthButtons className={customClass} />);
    const element = container.firstChild as HTMLElement;
    expect(element).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for OAuthButtons functionality
});
