import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import UserProfileCard from './UserProfileCard';

describe('UserProfileCard', () => {
  it('renders without crashing', () => {
    render(<UserProfileCard />);
    // With mocked user (testuser), component should render the username
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  // TODO: Add more specific tests for UserProfileCard functionality
});
