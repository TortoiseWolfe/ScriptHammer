import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CaptainShipCrewWithNPC from './CaptainShipCrewWithNPC';

describe('CaptainShipCrewWithNPC', () => {
  it('renders without crashing', () => {
    render(<CaptainShipCrewWithNPC />);
    expect(
      screen.getByText('Captain, Ship & Crew - Setup')
    ).toBeInTheDocument();
  });

  // TODO: Add more specific tests
});
