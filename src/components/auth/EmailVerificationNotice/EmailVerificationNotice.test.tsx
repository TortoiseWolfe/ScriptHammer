import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmailVerificationNotice from './EmailVerificationNotice';

describe('EmailVerificationNotice', () => {
  it('renders without crashing', () => {
    render(<EmailVerificationNotice />);
    expect(
      screen.getByText(/please verify your email address/i)
    ).toBeInTheDocument();
  });

  // TODO: Add more specific tests for EmailVerificationNotice functionality
});
