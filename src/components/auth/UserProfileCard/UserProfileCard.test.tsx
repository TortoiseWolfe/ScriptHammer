import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import UserProfileCard from './UserProfileCard';

describe('UserProfileCard', () => {
  it('renders without crashing', () => {
    render(<UserProfileCard />);
    const element = screen.getByText(/UserProfileCard/i);
    expect(element).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    const { container } = render(<UserProfileCard className={customClass} />);
    const element = container.querySelector('.user-profile-card');
    expect(element).toHaveClass(customClass);
  });

  // TODO: Add more specific tests for UserProfileCard functionality
});
