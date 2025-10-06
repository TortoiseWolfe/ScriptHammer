import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AccountSettings from './AccountSettings';

describe('AccountSettings', () => {
  it('renders without crashing', () => {
    render(<AccountSettings />);
    expect(
      screen.getByRole('heading', { name: /account settings/i })
    ).toBeInTheDocument();
  });

  // TODO: Add more specific tests for AccountSettings functionality
});
