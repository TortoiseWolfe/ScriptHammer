'use client';

import React from 'react';

export type DeliveryStatus = 'sent' | 'delivered' | 'read';

export interface ReadReceiptProps {
  /** Delivery status of the message */
  status: DeliveryStatus;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ReadReceipt component
 * Task: T111
 *
 * Displays delivery/read status indicators for messages.
 * Shows checkmark icons with appropriate colors and ARIA labels.
 *
 * States:
 * - sent: Single gray checkmark
 * - delivered: Double gray checkmarks
 * - read: Double blue checkmarks
 *
 * @category atomic
 */
export default function ReadReceipt({
  status,
  className = '',
}: ReadReceiptProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'sent':
        return (
          <svg
            className="text-base-content/40 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case 'delivered':
        return (
          <div className="relative h-4 w-5">
            <svg
              className="text-base-content/40 absolute left-0 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <svg
              className="text-base-content/40 absolute left-1 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case 'read':
        return (
          <div className="relative h-4 w-5">
            <svg
              className="text-primary absolute left-0 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <svg
              className="text-primary absolute left-1 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
    }
  };

  return (
    <div
      className={`inline-flex items-center${className ? ` ${className}` : ''}`}
      data-testid="read-receipt"
      role="img"
      aria-label={`Message ${status}`}
    >
      {getStatusIcon()}
    </div>
  );
}
