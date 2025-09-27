'use client';

import { useState } from 'react';

export interface DiceProps {
  sides?: 6 | 20;
  className?: string;
}

export default function Dice({ sides = 6, className = '' }: DiceProps) {
  const [value, setValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const roll = () => {
    setIsRolling(true);
    setValue(null);

    // Simulate rolling animation
    const rollDuration = 1000;
    const rollInterval = 100;
    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += rollInterval;
      setValue(Math.floor(Math.random() * sides) + 1);

      if (elapsed >= rollDuration) {
        clearInterval(interval);
        setIsRolling(false);
        setValue(Math.floor(Math.random() * sides) + 1);
      }
    }, rollInterval);
  };

  const getDiceIcon = () => {
    if (sides === 6 && value) {
      const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      return faces[value - 1];
    }
    return value?.toString() || '?';
  };

  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body items-center text-center">
        <h2 className="card-title">{sides === 6 ? 'D6' : 'D20'} Dice</h2>

        <div
          className={`my-8 text-8xl transition-all duration-200 ${
            isRolling ? 'animate-bounce opacity-50' : ''
          }`}
          aria-live="polite"
        >
          <span className="sr-only">
            {value ? `Dice showing ${value}` : 'Dice not rolled yet'}
          </span>
          {sides === 6 ? (
            <span className="font-mono" aria-hidden="true">
              {getDiceIcon()}
            </span>
          ) : (
            <div
              className="bg-primary text-primary-content flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold"
              aria-hidden="true"
            >
              {value || '?'}
            </div>
          )}
        </div>

        <div className="card-actions">
          <button
            onClick={roll}
            disabled={isRolling}
            className="btn btn-primary"
            aria-label={`Roll ${sides}-sided dice`}
          >
            {isRolling ? (
              <>
                <span className="loading loading-spinner"></span>
                Rolling...
              </>
            ) : (
              `Roll D${sides}`
            )}
          </button>
        </div>

        {value && !isRolling && (
          <div className="stats mt-4 shadow">
            <div className="stat">
              <div className="stat-title">Result</div>
              <div className="stat-value text-primary">{value}</div>
              <div className="stat-desc">
                {value === sides
                  ? 'Critical!'
                  : value === 1
                    ? 'Critical Fail!'
                    : `Out of ${sides}`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
