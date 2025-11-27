'use client';

import { useState, useEffect, useCallback } from 'react';
import DraggableDice from '../DraggableDice/DraggableDice';
import { ValidatedInput } from '@/components/forms';
import { playerNameSchema } from '@/schemas/forms';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:atomic:CaptainShipCrewWithNPC');

// TODO: Add validation to other atomic components throughout the app
// This is a demonstration of the new validation system in action.
// Future work: Extend validation to Button, Input, and other form components.

type PlayerType = 'human' | 'npc';
type NPCDifficulty = 'easy' | 'medium' | 'hard';

interface Player {
  id: string;
  name: string;
  score: number;
  roundScore: number;
  type: PlayerType;
  difficulty?: NPCDifficulty;
}

interface GameState {
  currentPlayerIndex: number;
  round: number;
  gameMode: 'single' | 'target';
  targetScore: number;
  gameStatus: 'setup' | 'playing' | 'ended';
  winner: Player | null;
}

interface TurnState {
  dice: number[];
  rollsRemaining: number;
  hasShip: boolean;
  hasCaptain: boolean;
  hasCrew: boolean;
  shipDieIndex: number | null;
  captainDieIndex: number | null;
  crewDieIndex: number | null;
  cargoTotal: number;
  phase: 'rolling' | 'deciding' | 'complete';
}

interface PlayerSetup {
  name: string;
  type: PlayerType;
  difficulty?: NPCDifficulty;
}

export interface CaptainShipCrewWithNPCProps {
  playerCount?: number;
  gameMode?: 'single' | 'target';
  targetScore?: number;
  className?: string;
}

export default function CaptainShipCrewWithNPC({
  playerCount = 2,
  gameMode = 'single',
  targetScore = 50,
  className = '',
}: CaptainShipCrewWithNPCProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerSetups, setPlayerSetups] = useState<PlayerSetup[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    Record<number, string>
  >({});
  const [gameState, setGameState] = useState<GameState>({
    currentPlayerIndex: 0,
    round: 1,
    gameMode,
    targetScore,
    gameStatus: 'setup',
    winner: null,
  });
  const [turnState, setTurnState] = useState<TurnState>({
    dice: [0, 0, 0, 0, 0],
    rollsRemaining: 3,
    hasShip: false,
    hasCaptain: false,
    hasCrew: false,
    shipDieIndex: null,
    captainDieIndex: null,
    crewDieIndex: null,
    cargoTotal: 0,
    phase: 'rolling',
  });
  const [previousTurnState, setPreviousTurnState] = useState<TurnState | null>(
    null
  );
  const [isRolling, setIsRolling] = useState(false);
  const [isProcessingNPC, setIsProcessingNPC] = useState(false);
  const [npcActionCount, setNpcActionCount] = useState(0);

  // Load saved player names from localStorage
  const loadSavedPlayerNames = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('captainShipCrew_playerNames');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      logger.error('Error loading saved player names', { error });
    }
    return [];
  };

  // Save player names to localStorage
  const savePlayerNames = (setups: PlayerSetup[]) => {
    if (typeof window === 'undefined') return;
    try {
      // Only save human player names
      const humanNames = setups
        .filter((setup) => setup.type === 'human')
        .map((setup) => setup.name);
      if (humanNames.length > 0) {
        localStorage.setItem(
          'captainShipCrew_playerNames',
          JSON.stringify(humanNames)
        );
      }
    } catch (error) {
      logger.error('Error saving player names', { error });
    }
  };

  // Initialize player setups with saved names
  useEffect(() => {
    const savedNames = loadSavedPlayerNames();
    const setups: PlayerSetup[] = Array.from(
      { length: playerCount },
      (_, i) => {
        // First player is human by default, use saved name if available
        if (i === 0) {
          return {
            name: savedNames[0] || `Player ${i + 1}`,
            type: 'human' as PlayerType,
            difficulty: undefined,
          };
        }
        // Additional human players get saved names if available
        if (savedNames[i]) {
          return {
            name: savedNames[i],
            type: 'human' as PlayerType,
            difficulty: undefined,
          };
        }
        // Default to NPC for other players
        return {
          name: `Player ${i + 1}`,
          type: 'npc' as PlayerType,
          difficulty: 'medium' as NPCDifficulty,
        };
      }
    );
    setPlayerSetups(setups);
  }, [playerCount]);

  // Process the dice roll
  const processRoll = (state: TurnState): TurnState => {
    const newState = { ...state };
    const availableDice = state.dice
      .map((die, index) => ({ value: die, index }))
      .filter(
        (d) =>
          d.index !== state.shipDieIndex &&
          d.index !== state.captainDieIndex &&
          d.index !== state.crewDieIndex
      );

    // Look for ship (6) first
    if (!newState.hasShip) {
      const shipDie = availableDice.find((d) => d.value === 6);
      if (shipDie) {
        newState.hasShip = true;
        newState.shipDieIndex = shipDie.index;
      }
    }

    // Look for captain (5) only if we have ship
    if (newState.hasShip && !newState.hasCaptain) {
      const captainDie = availableDice.find(
        (d) => d.value === 5 && d.index !== newState.shipDieIndex
      );
      if (captainDie) {
        newState.hasCaptain = true;
        newState.captainDieIndex = captainDie.index;
      }
    }

    // Look for crew (4) only if we have ship and captain
    if (newState.hasShip && newState.hasCaptain && !newState.hasCrew) {
      const crewDie = availableDice.find(
        (d) =>
          d.value === 4 &&
          d.index !== newState.shipDieIndex &&
          d.index !== newState.captainDieIndex
      );
      if (crewDie) {
        newState.hasCrew = true;
        newState.crewDieIndex = crewDie.index;
      }
    }

    // Calculate cargo if we have all three
    if (newState.hasShip && newState.hasCaptain && newState.hasCrew) {
      const cargoDice = newState.dice.filter(
        (_, index) =>
          index !== newState.shipDieIndex &&
          index !== newState.captainDieIndex &&
          index !== newState.crewDieIndex
      );
      newState.cargoTotal = cargoDice.reduce((sum, die) => sum + die, 0);
    }

    return newState;
  };

  // NPC decision logic for cargo reroll
  const shouldNPCRerollCargo = (
    cargo: number,
    difficulty: NPCDifficulty,
    rollsLeft: number
  ): boolean => {
    if (rollsLeft === 0) return false;

    switch (difficulty) {
      case 'easy':
        // Easy NPCs never reroll cargo
        return false;
      case 'medium':
        // Medium NPCs reroll if cargo is below average (7)
        return cargo < 7;
      case 'hard':
        // Hard NPCs use expected value calculation
        // Expected value of two dice = 7, with standard deviation
        // Reroll if current is below 8 and have rolls left
        return cargo < 8 && rollsLeft > 0;
      default:
        return false;
    }
  };

  const rollDice = useCallback(() => {
    if (turnState.rollsRemaining <= 0 || isRolling) return;

    setIsRolling(true);
    const currentPlayer = players[gameState.currentPlayerIndex];
    const duration = currentPlayer?.type === 'npc' ? 300 : 1000; // Much faster for NPCs
    const interval = 50;
    let elapsed = 0;

    const rollInterval = setInterval(() => {
      elapsed += interval;

      setTurnState((prev) => {
        const newDice = [...prev.dice];
        // Only roll dice that aren't locked
        for (let i = 0; i < 5; i++) {
          if (
            i !== prev.shipDieIndex &&
            i !== prev.captainDieIndex &&
            i !== prev.crewDieIndex
          ) {
            newDice[i] = Math.floor(Math.random() * 6) + 1;
          }
        }
        return { ...prev, dice: newDice };
      });

      if (elapsed >= duration) {
        clearInterval(rollInterval);
        setIsRolling(false);

        // Final roll and process
        setTurnState((prev) => {
          const newDice = [...prev.dice];
          // Final roll for unlocked dice
          for (let i = 0; i < 5; i++) {
            if (
              i !== prev.shipDieIndex &&
              i !== prev.captainDieIndex &&
              i !== prev.crewDieIndex
            ) {
              newDice[i] = Math.floor(Math.random() * 6) + 1;
            }
          }

          // Process the roll and lock dice in sequence
          let newState = {
            ...prev,
            dice: newDice,
            rollsRemaining: prev.rollsRemaining - 1,
          };
          newState = processRoll(newState);

          // Check if turn is complete
          if (newState.rollsRemaining === 0) {
            newState.phase = 'complete';
          } else if (
            newState.hasShip &&
            newState.hasCaptain &&
            newState.hasCrew
          ) {
            newState.phase = 'deciding';
          }

          return newState;
        });
      }
    }, interval);
  }, [
    turnState.rollsRemaining,
    isRolling,
    players,
    gameState.currentPlayerIndex,
  ]);

  const rerollCargo = useCallback(() => {
    if (!turnState.hasShip || !turnState.hasCaptain || !turnState.hasCrew)
      return;
    if (turnState.rollsRemaining <= 0) return;

    setIsRolling(true);
    const currentPlayer = players[gameState.currentPlayerIndex];
    const duration = currentPlayer?.type === 'npc' ? 200 : 500;

    setTimeout(() => {
      setTurnState((prev) => {
        const newDice = [...prev.dice];
        // Reroll only cargo dice
        for (let i = 0; i < 5; i++) {
          if (
            i !== prev.shipDieIndex &&
            i !== prev.captainDieIndex &&
            i !== prev.crewDieIndex
          ) {
            newDice[i] = Math.floor(Math.random() * 6) + 1;
          }
        }

        const cargoDice = newDice.filter(
          (_, index) =>
            index !== prev.shipDieIndex &&
            index !== prev.captainDieIndex &&
            index !== prev.crewDieIndex
        );
        const cargoTotal = cargoDice.reduce((sum, die) => sum + die, 0);

        return {
          ...prev,
          dice: newDice,
          cargoTotal,
          rollsRemaining: prev.rollsRemaining - 1,
          phase: prev.rollsRemaining - 1 === 0 ? 'complete' : 'deciding',
        };
      });
      setIsRolling(false);
    }, duration);
  }, [turnState, players, gameState.currentPlayerIndex]);

  const keepCargo = () => {
    setTurnState((prev) => ({ ...prev, phase: 'complete' }));
  };

  const endTurn = () => {
    // Save current turn state as previous
    setPreviousTurnState({ ...turnState });

    // Update player score
    const currentPlayer = players[gameState.currentPlayerIndex];
    const roundScore =
      turnState.hasShip && turnState.hasCaptain && turnState.hasCrew
        ? turnState.cargoTotal
        : 0;

    const updatedPlayers = [...players];
    updatedPlayers[gameState.currentPlayerIndex] = {
      ...currentPlayer,
      roundScore,
      score: currentPlayer.score + roundScore,
    };
    setPlayers(updatedPlayers);

    // Check for winner in target mode
    if (gameState.gameMode === 'target') {
      const winner = updatedPlayers.find(
        (p) => p.score >= gameState.targetScore
      );
      if (winner) {
        setGameState((prev) => ({ ...prev, gameStatus: 'ended', winner }));
        return;
      }
    }

    // Move to next player
    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % players.length;
    const isNewRound = nextPlayerIndex === 0;

    if (gameState.gameMode === 'single' && isNewRound) {
      // End game after one round in single mode
      const winner = updatedPlayers.reduce((prev, curr) =>
        curr.roundScore > prev.roundScore ? curr : prev
      );
      setGameState((prev) => ({ ...prev, gameStatus: 'ended', winner }));
    } else {
      // Continue to next turn
      setGameState((prev) => ({
        ...prev,
        currentPlayerIndex: nextPlayerIndex,
        round: isNewRound ? prev.round + 1 : prev.round,
      }));

      // Reset turn state
      setTurnState({
        dice: [0, 0, 0, 0, 0],
        rollsRemaining: 3,
        hasShip: false,
        hasCaptain: false,
        hasCrew: false,
        shipDieIndex: null,
        captainDieIndex: null,
        crewDieIndex: null,
        cargoTotal: 0,
        phase: 'rolling',
      });
      setIsProcessingNPC(false);
      setNpcActionCount(0);
    }
  };

  // Handle NPC turns automatically
  useEffect(() => {
    if (gameState.gameStatus !== 'playing') return;

    const currentPlayer = players[gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.type !== 'npc') return;
    if (isRolling) return;

    // NPC turn logic
    const executeNPCTurn = async () => {
      // Small initial delay only on first action
      if (npcActionCount === 0) {
        setIsProcessingNPC(true);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Roll dice up to 3 times or until complete
      if (turnState.phase === 'rolling' && turnState.rollsRemaining > 0) {
        setNpcActionCount((prev) => prev + 1);
        rollDice();
      } else if (turnState.phase === 'deciding') {
        // NPC decision on cargo reroll
        const shouldReroll = shouldNPCRerollCargo(
          turnState.cargoTotal,
          currentPlayer.difficulty || 'medium',
          turnState.rollsRemaining
        );

        await new Promise((resolve) => setTimeout(resolve, 300));
        setNpcActionCount((prev) => prev + 1);

        if (shouldReroll) {
          rerollCargo();
        } else {
          keepCargo();
        }
      } else if (turnState.phase === 'complete') {
        // End NPC turn quickly
        await new Promise((resolve) => setTimeout(resolve, 200));
        endTurn();
      }
    };

    executeNPCTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gameState.gameStatus,
    gameState.currentPlayerIndex,
    players,
    turnState.phase,
    turnState.rollsRemaining,
    isRolling,
    npcActionCount,
  ]);

  const startGame = () => {
    // Validate all player names before starting
    let hasErrors = false;
    const newErrors: Record<number, string> = {};

    playerSetups.forEach((setup, index) => {
      const result = playerNameSchema.safeParse(setup.name);
      if (!result.success) {
        hasErrors = true;
        newErrors[index] = result.error.issues[0].message;
      }
    });

    setValidationErrors(newErrors);

    if (hasErrors) {
      return; // Don't start game if there are validation errors
    }

    // Create players from setups
    const gamePlayers: Player[] = playerSetups.map((setup, i) => ({
      id: `player-${i}`,
      name: setup.name,
      score: 0,
      roundScore: 0,
      type: setup.type,
      difficulty: setup.difficulty,
    }));

    setPlayers(gamePlayers);
    setGameState((prev) => ({ ...prev, gameStatus: 'playing' }));
    setTurnState({
      dice: [0, 0, 0, 0, 0],
      rollsRemaining: 3,
      hasShip: false,
      hasCaptain: false,
      hasCrew: false,
      shipDieIndex: null,
      captainDieIndex: null,
      crewDieIndex: null,
      cargoTotal: 0,
      phase: 'rolling',
    });
  };

  const resetGame = () => {
    setGameState({
      currentPlayerIndex: 0,
      round: 1,
      gameMode,
      targetScore,
      gameStatus: 'setup',
      winner: null,
    });
    setTurnState({
      dice: [0, 0, 0, 0, 0],
      rollsRemaining: 3,
      hasShip: false,
      hasCaptain: false,
      hasCrew: false,
      shipDieIndex: null,
      captainDieIndex: null,
      crewDieIndex: null,
      cargoTotal: 0,
      phase: 'rolling',
    });
  };

  const updatePlayerSetup = (index: number, setup: Partial<PlayerSetup>) => {
    setPlayerSetups((prev) => {
      const newSetups = [...prev];
      newSetups[index] = { ...newSetups[index], ...setup };
      // Save to localStorage whenever names are updated
      if (setup.name !== undefined || setup.type !== undefined) {
        savePlayerNames(newSetups);
      }
      return newSetups;
    });
  };

  const getDiceDisplay = (index: number) => {
    const value = turnState.dice[index];
    const isLocked =
      index === turnState.shipDieIndex ||
      index === turnState.captainDieIndex ||
      index === turnState.crewDieIndex;

    let label = '';
    if (index === turnState.shipDieIndex) label = 'Ship';
    else if (index === turnState.captainDieIndex) label = 'Captain';
    else if (index === turnState.crewDieIndex) label = 'Crew';
    else if (turnState.hasShip && turnState.hasCaptain && turnState.hasCrew)
      label = 'Cargo';

    return { value, isLocked, label };
  };

  if (gameState.gameStatus === 'setup') {
    return (
      <div className={`card bg-base-100 shadow-xl ${className}`}>
        <div className="card-body">
          <h2 className="card-title text-lg sm:text-xl">
            Captain, Ship & Crew - Setup
          </h2>
          <p className="text-sm opacity-75">
            Configure players - add NPCs to play against computer opponents!
          </p>

          <div className="divider">Players</div>
          <div className="space-y-3">
            {playerSetups.map((setup, index) => (
              <div
                key={index}
                className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2"
              >
                <ValidatedInput
                  type="text"
                  value={setup.name}
                  onChange={(value) => {
                    updatePlayerSetup(index, { name: value });
                    // Clear validation error for this field when user types
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next[index];
                      return next;
                    });
                  }}
                  schema={playerNameSchema}
                  error={validationErrors[index]}
                  className="input-bordered input-sm w-full sm:flex-1"
                  placeholder="Player name"
                  size="sm"
                  validateOnChange
                  debounceMs={500}
                  showStateIcon
                />
                <select
                  aria-label={`Player type for ${setup.name}`}
                  value={setup.type}
                  onChange={(e) =>
                    updatePlayerSetup(index, {
                      type: e.target.value as PlayerType,
                      difficulty:
                        e.target.value === 'npc' ? 'medium' : undefined,
                    })
                  }
                  className="select select-bordered select-sm w-full sm:w-auto"
                >
                  <option value="human">👤 Human</option>
                  <option value="npc">🤖 NPC</option>
                </select>
                {setup.type === 'npc' && (
                  <select
                    aria-label={`Difficulty for ${setup.name}`}
                    value={setup.difficulty}
                    onChange={(e) =>
                      updatePlayerSetup(index, {
                        difficulty: e.target.value as NPCDifficulty,
                      })
                    }
                    className="select select-bordered select-sm w-full sm:w-auto"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                )}
              </div>
            ))}
          </div>

          <div className="divider">Game Mode</div>
          <div className="text-sm opacity-75">
            {gameMode === 'single'
              ? 'Single Round'
              : `Playing to ${targetScore} points`}
          </div>

          <div className="mt-4">
            <button onClick={startGame} className="btn btn-primary">
              Start Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState.gameStatus === 'ended') {
    return (
      <div className={`card bg-base-100 shadow-xl ${className}`}>
        <div className="card-body">
          <h2 className="card-title text-lg sm:text-xl">Game Over!</h2>
          <div className="py-8 text-center">
            <div className="mb-4 text-4xl">🏆</div>
            <h3 className="text-primary text-2xl font-bold">
              {gameState.winner?.name} Wins!
            </h3>
            <p className="mt-2 text-xl">
              Final Score: {gameState.winner?.score} points
            </p>
            {gameState.winner?.type === 'npc' && (
              <p className="mt-1 text-sm opacity-75">
                (🤖 NPC - {gameState.winner.difficulty} difficulty)
              </p>
            )}
          </div>
          <div className="divider">Final Scores</div>
          {players
            .sort((a, b) => b.score - a.score)
            .map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  {player.type === 'npc' ? '🤖' : '👤'} {player.name}
                  {player.type === 'npc' && (
                    <span className="text-xs opacity-60">
                      ({player.difficulty})
                    </span>
                  )}
                </span>
                <span className="font-bold">{player.score}</span>
              </div>
            ))}
          <button onClick={resetGame} className="btn btn-primary mt-4">
            Play Again
          </button>
        </div>
      </div>
    );
  }

  const currentPlayer = players[gameState.currentPlayerIndex];
  const isNPCTurn = currentPlayer?.type === 'npc';

  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-lg sm:text-xl">
            Captain, Ship & Crew
          </h2>
          <div className="badge badge-primary">Round {gameState.round}</div>
        </div>

        {/* Current Player Info */}
        <div className={`alert ${isNPCTurn ? 'alert-warning' : 'alert-info'}`}>
          <span className="flex items-center gap-2 font-bold">
            {isNPCTurn ? '🤖' : '👤'} {currentPlayer?.name}&apos;s Turn
            {isNPCTurn && (
              <span className="text-xs opacity-75">
                ({currentPlayer.difficulty} NPC)
              </span>
            )}
          </span>
          <span>Rolls Remaining: {turnState.rollsRemaining}</span>
        </div>

        {/* NPC Processing Indicator */}
        {isNPCTurn && isProcessingNPC && (
          <div className="text-center text-sm opacity-75">
            <span className="loading loading-dots loading-sm"></span>
            NPC is thinking...
          </div>
        )}

        {/* Required Sequence Status */}
        <div className="my-4 flex justify-center gap-2 sm:gap-4">
          <div
            className={`badge ${turnState.hasShip ? 'badge-success' : 'badge-outline'} sm:badge-lg px-3 py-2`}
          >
            ⚓ Ship (6)
          </div>
          <div
            className={`badge ${turnState.hasCaptain ? 'badge-success' : 'badge-outline'} sm:badge-lg px-3 py-2`}
          >
            👨‍✈️ Captain (5)
          </div>
          <div
            className={`badge ${turnState.hasCrew ? 'badge-success' : 'badge-outline'} sm:badge-lg px-3 py-2`}
          >
            ⚒️ Crew (4)
          </div>
        </div>

        {/* Previous Player's Result */}
        {previousTurnState && gameState.currentPlayerIndex === 0 && (
          <div className="alert alert-neutral mb-4">
            <div className="text-sm">
              Previous: {players[players.length - 1]?.name} scored{' '}
              {previousTurnState.hasShip &&
              previousTurnState.hasCaptain &&
              previousTurnState.hasCrew
                ? `${previousTurnState.cargoTotal} points`
                : '0 points (no sequence)'}
            </div>
          </div>
        )}

        {/* Dice Display */}
        <div className="my-4 flex flex-wrap justify-center gap-2 sm:my-6 sm:gap-3">
          {turnState.dice.map((_, index) => {
            const { value, isLocked, label } = getDiceDisplay(index);
            return (
              <div key={index} className="text-center">
                {label && (
                  <div className="mb-1 text-xs font-semibold">{label}</div>
                )}
                <DraggableDice
                  id={`game-die-${index}`}
                  value={value || null}
                  locked={isLocked}
                  isRolling={isRolling && !isLocked}
                  className={isLocked ? 'opacity-75' : ''}
                />
              </div>
            );
          })}
        </div>

        {/* Cargo Score Display */}
        {turnState.hasShip && turnState.hasCaptain && turnState.hasCrew && (
          <div className="alert alert-success">
            <span className="text-lg font-bold">
              Cargo Score: {turnState.cargoTotal} points
            </span>
          </div>
        )}

        {/* Action Buttons (disabled for NPCs) */}
        <div className="flex justify-center gap-2">
          {turnState.phase === 'rolling' && !isNPCTurn && (
            <button
              onClick={rollDice}
              disabled={isRolling || turnState.rollsRemaining === 0}
              className="btn btn-primary"
            >
              {isRolling ? (
                <>
                  <span className="loading loading-spinner"></span>
                  Rolling...
                </>
              ) : (
                `Roll Dice (${turnState.rollsRemaining} left)`
              )}
            </button>
          )}

          {turnState.phase === 'deciding' && !isNPCTurn && (
            <>
              <button
                onClick={rerollCargo}
                disabled={isRolling || turnState.rollsRemaining === 0}
                className="btn btn-warning"
              >
                Reroll Cargo
              </button>
              <button onClick={keepCargo} className="btn btn-success">
                Keep Cargo ({turnState.cargoTotal})
              </button>
            </>
          )}

          {turnState.phase === 'complete' && !isNPCTurn && (
            <button onClick={endTurn} className="btn btn-primary">
              End Turn (Score: {turnState.cargoTotal})
            </button>
          )}
        </div>

        {/* Scoreboard */}
        <div className="divider">Scores</div>
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 sm:text-sm">
          {players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded p-2 ${
                player.id === currentPlayer?.id ? 'bg-primary/10' : ''
              }`}
            >
              <span className="flex items-center gap-1">
                {player.type === 'npc' ? '🤖' : '👤'}
                {player.name}
              </span>
              <span className="font-bold">
                {player.score}
                {player.roundScore > 0 && (
                  <span className="text-success ml-1">
                    +{player.roundScore}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        {gameState.gameMode === 'target' && (
          <div className="mt-2 text-center text-sm opacity-75">
            Playing to {gameState.targetScore} points
          </div>
        )}
      </div>
    </div>
  );
}
