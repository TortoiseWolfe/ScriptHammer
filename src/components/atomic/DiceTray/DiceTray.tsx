'use client';

import { useState, useEffect } from 'react';
import DraggableDice from '../DraggableDice/DraggableDice';

interface DiceData {
  id: string;
  value: number | null;
  locked: boolean;
  position: 'tray' | 'lock-zone';
}

export interface DiceTrayProps {
  numberOfDice?: number;
  sides?: 6 | 20;
  className?: string;
}

export default function DiceTray({
  numberOfDice = 5,
  sides = 6,
  className = '',
}: DiceTrayProps) {
  const [dice, setDice] = useState<DiceData[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [, setDraggedDiceId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'tray' | 'lock' | null>(
    null
  );

  // Initialize dice
  useEffect(() => {
    const initialDice: DiceData[] = Array.from(
      { length: numberOfDice },
      (_, i) => ({
        id: `dice-${i}`,
        value: null,
        locked: false,
        position: 'tray',
      })
    );
    setDice(initialDice);
  }, [numberOfDice]);

  const rollDice = () => {
    setIsRolling(true);

    // Roll animation duration
    const duration = 1000;
    const interval = 100;
    let elapsed = 0;

    const rollInterval = setInterval(() => {
      elapsed += interval;

      setDice((prevDice) =>
        prevDice.map((die) => {
          if (die.locked) return die;
          return {
            ...die,
            value: Math.floor(Math.random() * sides) + 1,
          };
        })
      );

      if (elapsed >= duration) {
        clearInterval(rollInterval);
        setIsRolling(false);

        // Final roll
        setDice((prevDice) =>
          prevDice.map((die) => {
            if (die.locked) return die;
            return {
              ...die,
              value: Math.floor(Math.random() * sides) + 1,
            };
          })
        );
      }
    }, interval);
  };

  const calculateTotal = () => {
    return dice.reduce((sum, die) => sum + (die.value || 0), 0);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedDiceId(id);
  };

  const handleDragEnd = () => {
    setDraggedDiceId(null);
    setDragOverZone(null);
  };

  const handleDragOver = (e: React.DragEvent, zone: 'tray' | 'lock') => {
    e.preventDefault();
    setDragOverZone(zone);
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleDrop = (e: React.DragEvent, zone: 'tray' | 'lock') => {
    e.preventDefault();
    const diceId = e.dataTransfer.getData('diceId');

    setDice((prevDice) =>
      prevDice.map((die) => {
        if (die.id === diceId) {
          return {
            ...die,
            locked: zone === 'lock',
            position: zone === 'lock' ? 'lock-zone' : 'tray',
          };
        }
        return die;
      })
    );

    setDragOverZone(null);
  };

  const toggleLock = (id: string) => {
    setDice((prevDice) =>
      prevDice.map((die) => {
        if (die.id === id) {
          return {
            ...die,
            locked: !die.locked,
            position: !die.locked ? 'lock-zone' : 'tray',
          };
        }
        return die;
      })
    );
  };

  const resetAll = () => {
    setDice((prevDice) =>
      prevDice.map((die) => ({
        ...die,
        value: null,
        locked: false,
        position: 'tray',
      }))
    );
  };

  const trayDice = dice.filter((d) => d.position === 'tray');
  const lockedDice = dice.filter((d) => d.position === 'lock-zone');

  return (
    <div className={`card bg-base-100 shadow-xl ${className}`}>
      <div className="card-body">
        <h2 className="card-title">
          Dice Tray - {numberOfDice} × D{sides}
        </h2>

        {/* Control Panel */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={rollDice}
            disabled={isRolling}
            className="btn btn-primary"
          >
            {isRolling ? (
              <>
                <span className="loading loading-spinner"></span>
                Rolling...
              </>
            ) : (
              'Roll Unlocked Dice'
            )}
          </button>
          <button onClick={resetAll} className="btn btn-outline">
            Reset All
          </button>
        </div>

        {/* Total Display */}
        <div className="stats mb-6 shadow">
          <div className="stat">
            <div className="stat-title">Total</div>
            <div className="stat-value text-primary">{calculateTotal()}</div>
            <div className="stat-desc">
              {dice.filter((d) => d.locked).length} dice locked
            </div>
          </div>
        </div>

        {/* Main Tray Area */}
        <div
          className={`min-h-32 rounded-lg border-2 border-dashed p-4 ${dragOverZone === 'tray' ? 'border-primary bg-primary/10' : 'border-base-300'} transition-colors duration-200`}
          onDragOver={(e) => handleDragOver(e, 'tray')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'tray')}
        >
          <div className="text-base-content/60 mb-2 text-sm">
            Active Dice (drag to lock zone to save)
          </div>
          <div className="flex flex-wrap gap-3">
            {trayDice.map((die) => (
              <DraggableDice
                key={die.id}
                id={die.id}
                sides={sides}
                value={die.value}
                locked={false}
                isRolling={isRolling && !die.locked}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onClick={() => toggleLock(die.id)}
              />
            ))}
            {trayDice.length === 0 && (
              <div className="text-base-content/40 italic">
                No dice in tray - drag dice here to unlock
              </div>
            )}
          </div>
        </div>

        {/* Lock Zone */}
        <div
          className={`min-h-32 rounded-lg border-2 p-4 ${dragOverZone === 'lock' ? 'border-warning bg-warning/10' : 'border-warning/50 bg-warning/5'} mt-4 transition-colors duration-200`}
          onDragOver={(e) => handleDragOver(e, 'lock')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'lock')}
        >
          <div className="text-warning-content/80 mb-2 text-sm">
            🔒 Lock Zone (drag here to preserve values)
          </div>
          <div className="flex flex-wrap gap-3">
            {lockedDice.map((die) => (
              <DraggableDice
                key={die.id}
                id={die.id}
                sides={sides}
                value={die.value}
                locked={true}
                isRolling={false}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onClick={() => toggleLock(die.id)}
              />
            ))}
            {lockedDice.length === 0 && (
              <div className="text-base-content/40 italic">
                Drag dice here to lock their values
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="text-base-content/60 mt-6 text-sm">
          <p>💡 Tips:</p>
          <ul className="ml-2 list-inside list-disc">
            <li>Drag dice to the lock zone to preserve their values</li>
            <li>Click on dice to quickly toggle lock status</li>
            <li>
              Locked dice won&apos;t roll when you click &quot;Roll Unlocked
              Dice&quot;
            </li>
            <li>Drag locked dice back to the tray to unlock them</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
