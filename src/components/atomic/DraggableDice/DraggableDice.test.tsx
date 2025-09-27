import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DraggableDice from './DraggableDice';

describe('DraggableDice', () => {
  it('renders without crashing', () => {
    render(<DraggableDice id="test-dice" value={3} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('displays the correct dice face for value', () => {
    render(<DraggableDice id="test-dice" value={5} />);
    expect(screen.getByText('⚄')).toBeInTheDocument();
  });

  it('shows locked state correctly', () => {
    render(<DraggableDice id="test-dice" value={2} locked={true} />);
    expect(screen.getByLabelText(/locked/)).toBeInTheDocument();
  });
});
