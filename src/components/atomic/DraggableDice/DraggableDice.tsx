'use client';

import { useState } from 'react';

export interface DraggableDiceProps {
  id: string;
  sides?: 6 | 20;
  value: number | null;
  locked?: boolean;
  isRolling?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onClick?: () => void;
  className?: string;
}

export default function DraggableDice({
  id,
  sides = 6,
  value,
  locked = false,
  isRolling = false,
  onDragStart,
  onDragEnd,
  onClick,
  className = '',
}: DraggableDiceProps) {
  const [isDragging, setIsDragging] = useState(false);

  const getDiceIcon = () => {
    if (!value) return '?';
    if (sides === 6) {
      const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      return faces[value - 1];
    }
    return value.toString();
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (locked) {
      e.preventDefault();
      return;
    }
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('diceId', id);
    onDragStart?.(e, id);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    onDragEnd?.(e);
  };

  return (
    <div
      draggable={!locked}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      className={`relative cursor-move select-none ${locked ? 'cursor-not-allowed' : ''} ${isDragging ? 'opacity-50' : ''} ${className} `}
      role="button"
      tabIndex={0}
      aria-label={`${sides}-sided dice showing ${value || 'no value'}${locked ? ', locked' : ''}`}
    >
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-lg shadow-lg transition-all duration-200 ${locked ? 'bg-warning ring-warning-content ring-2' : 'bg-base-100'} ${isRolling ? 'animate-spin' : ''} ${!locked && !isDragging ? 'hover:scale-110 hover:shadow-xl' : ''} `}
      >
        {sides === 6 ? (
          <span
            className={`text-3xl ${locked ? 'text-warning-content' : 'text-base-content'}`}
          >
            {getDiceIcon()}
          </span>
        ) : (
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${locked ? 'bg-warning-content text-warning' : 'bg-primary text-primary-content'} text-xl font-bold`}
          >
            {value || '?'}
          </div>
        )}
      </div>
      {locked && (
        <div className="absolute -top-1 -right-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="text-warning-content h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
