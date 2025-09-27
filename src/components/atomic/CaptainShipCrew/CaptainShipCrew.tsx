'use client';

import { useState, useEffect } from 'react';
import DraggableDice from '../DraggableDice/DraggableDice';

interface Player {
  id: string;
  name: string;
  score: number;
  roundScore: number;
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

export interface CaptainShipCrewProps {
  playerCount?: number;
  gameMode?: 'single' | 'target';
  targetScore?: number;
  className?: string;
}

export default function CaptainShipCrew({
  playerCount = 2,
  gameMode = 'single',
  targetScore = 50,
  className = '',
}: CaptainShipCrewProps) {
  const [players, setPlayers] = useState<Player[]>([]);
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
  const [isRolling, setIsRolling] = useState(false);

  // Initialize players
  useEffect(() => {
    const newPlayers = Array.from({ length: playerCount }, (_, i) => ({
      id: `player-${i}`,
      name: `Player ${i + 1}`,
      score: 0,
      roundScore: 0,
    }));
    setPlayers(newPlayers);
  }, [playerCount]);

  const rollDice = () => {
    if (turnState.rollsRemaining <= 0 || isRolling) return;

    setIsRolling(true);
    const duration = 1000;
    const interval = 100;
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
  };

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

  const rerollCargo = () => {
    if (!turnState.hasShip || !turnState.hasCaptain || !turnState.hasCrew)
      return;
    if (turnState.rollsRemaining <= 0) return;

    setIsRolling(true);
    const duration = 500;

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
  };

  const keepCargo = () => {
    setTurnState((prev) => ({ ...prev, phase: 'complete' }));
  };

  const endTurn = () => {
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
    }
  };

  const startGame = () => {
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
    setPlayers(players.map((p) => ({ ...p, score: 0, roundScore: 0 })));
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
          <h2 className="card-title">Captain, Ship & Crew</h2>
          <p className="text-sm opacity-75">
            Roll 6-5-4 in sequence, then score with remaining cargo dice!
          </p>
          <div className="mt-4">
            <button onClick={startGame} className="btn btn-primary">
              Start Game ({playerCount} Players)
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
          <h2 className="card-title">Game Over!</h2>
          <div className="py-8 text-center">
            <div className="mb-4 text-4xl">🏆</div>
            <h3 className="text-primary text-2xl font-bold">
              {gameState.winner?.name} Wins!
            </h3>
            <p className="mt-2 text-xl">
              Final Score: {gameState.winner?.score} points
            </p>
          </div>
          <div className="divider">Final Scores</div>
          {players
            .sort((a, b) => b.score - a.score)
            .map((player) => (
              <div key={player.id} className="flex justify-between">
                <span>{player.name}</span>
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

  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title">Captain, Ship & Crew</h2>
          <div className="badge badge-primary">Round {gameState.round}</div>
        </div>

        {/* Current Player Info */}
        <div className="alert alert-info">
          <span className="font-bold">{currentPlayer?.name}&apos;s Turn</span>
          <span>Rolls Remaining: {turnState.rollsRemaining}</span>
        </div>

        {/* Required Sequence Status */}
        <div className="my-4 flex justify-center gap-4">
          <div
            className={`badge ${turnState.hasShip ? 'badge-success' : 'badge-outline'} badge-lg`}
          >
            ⚓ Ship (6)
          </div>
          <div
            className={`badge ${turnState.hasCaptain ? 'badge-success' : 'badge-outline'} badge-lg`}
          >
            👨‍✈️ Captain (5)
          </div>
          <div
            className={`badge ${turnState.hasCrew ? 'badge-success' : 'badge-outline'} badge-lg`}
          >
            ⚒️ Crew (4)
          </div>
        </div>

        {/* Dice Display */}
        <div className="my-6 flex flex-wrap justify-center gap-3">
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

        {/* Action Buttons */}
        <div className="flex justify-center gap-2">
          {turnState.phase === 'rolling' && (
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

          {turnState.phase === 'deciding' && (
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

          {turnState.phase === 'complete' && (
            <button onClick={endTurn} className="btn btn-primary">
              End Turn (Score: {turnState.cargoTotal})
            </button>
          )}
        </div>

        {/* Scoreboard */}
        <div className="divider">Scores</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {players.map((player) => (
            <div
              key={player.id}
              className={`flex justify-between rounded p-2 ${
                player.id === currentPlayer?.id ? 'bg-primary/10' : ''
              }`}
            >
              <span>{player.name}</span>
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
