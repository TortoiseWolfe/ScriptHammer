import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CaptainShipCrew from './CaptainShipCrew';

describe('CaptainShipCrew', () => {
  it('renders with setup screen initially', () => {
    render(<CaptainShipCrew />);
    expect(screen.getByText('Captain, Ship & Crew')).toBeInTheDocument();
    expect(screen.getByText('Start Game (2 Players)')).toBeInTheDocument();
  });

  it('starts game when start button is clicked', () => {
    render(<CaptainShipCrew />);
    const startButton = screen.getByText('Start Game (2 Players)');
    fireEvent.click(startButton);

    expect(screen.getByText(/Player 1's Turn/)).toBeInTheDocument();
    expect(screen.getByText('Rolls Remaining: 3')).toBeInTheDocument();
  });

  it('shows required sequence badges', () => {
    render(<CaptainShipCrew />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));

    expect(screen.getByText('⚓ Ship (6)')).toBeInTheDocument();
    expect(screen.getByText('👨‍✈️ Captain (5)')).toBeInTheDocument();
    expect(screen.getByText('⚒️ Crew (4)')).toBeInTheDocument();
  });

  it('displays roll button with correct count', () => {
    render(<CaptainShipCrew />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));

    expect(screen.getByText('Roll Dice (3 left)')).toBeInTheDocument();
  });

  it('decrements roll count after rolling', async () => {
    render(<CaptainShipCrew />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));

    const rollButton = screen.getByText('Roll Dice (3 left)');
    fireEvent.click(rollButton);

    await waitFor(
      () => {
        expect(screen.getByText('Rolls Remaining: 2')).toBeInTheDocument();
      },
      { timeout: 1500 }
    );
  });

  it('renders with custom player count', () => {
    render(<CaptainShipCrew playerCount={4} />);
    expect(screen.getByText('Start Game (4 Players)')).toBeInTheDocument();
  });

  it('renders with target score mode', () => {
    render(<CaptainShipCrew gameMode="target" targetScore={100} />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));

    expect(screen.getByText('Playing to 100 points')).toBeInTheDocument();
  });

  it('shows scoreboard with all players', () => {
    render(<CaptainShipCrew playerCount={3} />);
    fireEvent.click(screen.getByText('Start Game (3 Players)'));

    expect(screen.getByText('Player 1')).toBeInTheDocument();
    expect(screen.getByText('Player 2')).toBeInTheDocument();
    expect(screen.getByText('Player 3')).toBeInTheDocument();
  });

  it('highlights current player in scoreboard', () => {
    render(<CaptainShipCrew />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));

    const player1Element = screen.getByText('Player 1').parentElement;
    expect(player1Element).toHaveClass('bg-primary/10');
  });

  it('shows round number', () => {
    render(<CaptainShipCrew />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));

    expect(screen.getByText('Round 1')).toBeInTheDocument();
  });

  it('disables roll button when rolls are exhausted', async () => {
    // Mock random to ensure we don't complete sequence
    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom.mockReturnValue(0); // Always roll 1s

    render(<CaptainShipCrew />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));

    // Roll 3 times
    for (let i = 3; i > 0; i--) {
      const rollButton = screen.getByText(`Roll Dice (${i} left)`);
      expect(rollButton).toBeInTheDocument();
      fireEvent.click(rollButton);

      await waitFor(
        () => {
          expect(screen.queryByText('Rolling...')).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    }

    // After 3 rolls with no sequence, should show End Turn with score 0
    expect(screen.getByText('End Turn (Score: 0)')).toBeInTheDocument();
    expect(screen.queryByText(/Roll Dice/)).not.toBeInTheDocument();

    mockRandom.mockRestore();
  });

  it('shows cargo score when sequence is complete', async () => {
    // Mock Math.random to get 6-5-4 sequence plus cargo
    const mockRandom = vi.spyOn(Math, 'random');
    // During animation rolls, return random values
    let callCount = 0;
    mockRandom.mockImplementation(() => {
      callCount++;
      // Final roll values (after animation)
      if (callCount > 50) {
        const finalValues = [5 / 6, 4 / 6, 3 / 6, 2 / 6, 1 / 6]; // 6, 5, 4, 3, 2
        return finalValues[(callCount - 51) % 5];
      }
      return Math.random(); // Animation values
    });

    render(<CaptainShipCrew />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));
    fireEvent.click(screen.getByText('Roll Dice (3 left)'));

    // Wait for roll to complete and cargo score to appear
    await waitFor(
      () => {
        expect(screen.getByText('Cargo Score: 5 points')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Should show decision buttons
    expect(screen.getByText('Reroll Cargo')).toBeInTheDocument();
    expect(screen.getByText('Keep Cargo (5)')).toBeInTheDocument();

    mockRandom.mockRestore();
  });

  it('shows game over screen when game ends', async () => {
    // Mock to ensure quick game completion
    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom.mockReturnValue(0); // All 1s, no sequence

    render(<CaptainShipCrew gameMode="single" />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));

    // Complete turns for both players
    for (let player = 0; player < 2; player++) {
      // Roll 3 times quickly
      for (let roll = 3; roll > 0; roll--) {
        fireEvent.click(screen.getByText(`Roll Dice (${roll} left)`));

        await waitFor(
          () => {
            expect(
              screen.getByText(`Rolls Remaining: ${roll - 1}`)
            ).toBeInTheDocument();
          },
          { timeout: 3000 }
        );
      }

      // End turn after exhausting rolls
      await waitFor(
        () => {
          expect(screen.getByText('End Turn (Score: 0)')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      fireEvent.click(screen.getByText('End Turn (Score: 0)'));

      // If it's the last player, game should be over
      if (player === 1) {
        await waitFor(
          () => {
            expect(screen.getByText('Game Over!')).toBeInTheDocument();
          },
          { timeout: 3000 }
        );
      }
    }

    // Verify game over screen elements
    expect(screen.getByText('🏆')).toBeInTheDocument();
    expect(screen.getByText('Play Again')).toBeInTheDocument();

    mockRandom.mockRestore();
  }, 10000);

  it('allows restarting the game', async () => {
    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom.mockReturnValue(0); // All 1s

    render(<CaptainShipCrew gameMode="single" />);
    fireEvent.click(screen.getByText('Start Game (2 Players)'));

    // Quick game completion - roll 3 times for each player
    for (let player = 0; player < 2; player++) {
      // Roll 3 times
      for (let roll = 3; roll > 0; roll--) {
        fireEvent.click(screen.getByText(`Roll Dice (${roll} left)`));

        await waitFor(
          () => {
            expect(
              screen.getByText(`Rolls Remaining: ${roll - 1}`)
            ).toBeInTheDocument();
          },
          { timeout: 3000 }
        );
      }

      // End turn
      await waitFor(
        () => {
          expect(screen.getByText('End Turn (Score: 0)')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      fireEvent.click(screen.getByText('End Turn (Score: 0)'));
    }

    // Wait for game over screen
    await waitFor(
      () => {
        expect(screen.getByText('Game Over!')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Click Play Again
    fireEvent.click(screen.getByText('Play Again'));

    // Should be back at setup
    expect(screen.getByText('Start Game (2 Players)')).toBeInTheDocument();
    expect(screen.getByText(/Roll 6-5-4 in sequence/)).toBeInTheDocument();

    mockRandom.mockRestore();
  }, 10000);

  it('applies custom className', () => {
    const { container } = render(<CaptainShipCrew className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
