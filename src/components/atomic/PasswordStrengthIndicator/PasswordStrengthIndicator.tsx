import React, { useMemo } from 'react';

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface PasswordStrengthIndicatorProps {
  /** Password to evaluate */
  password: string;
  /** Callback when strength changes */
  onChange?: (strength: PasswordStrength) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Calculate password strength based on multiple criteria
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password || password.length === 0) {
    return 'weak';
  }

  let score = 0;

  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1; // Lowercase
  if (/[A-Z]/.test(password)) score += 1; // Uppercase
  if (/[0-9]/.test(password)) score += 1; // Numbers
  if (/[^a-zA-Z0-9]/.test(password)) score += 1; // Special characters

  // Determine strength based on score
  if (score <= 2) return 'weak';
  if (score <= 5) return 'medium';
  return 'strong';
}

/**
 * PasswordStrengthIndicator component
 * Visual indicator showing password strength with color-coded bar
 *
 * @category atomic
 */
export default function PasswordStrengthIndicator({
  password,
  onChange,
  className = '',
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => {
    const calculated = calculatePasswordStrength(password);
    if (onChange) {
      onChange(calculated);
    }
    return calculated;
  }, [password, onChange]);

  // Strength configuration
  const strengthConfig = {
    weak: {
      label: 'Weak',
      color: 'bg-error',
      textColor: 'text-error',
      width: '33%',
      description: 'Add more characters, uppercase, numbers, and symbols',
    },
    medium: {
      label: 'Medium',
      color: 'bg-warning',
      textColor: 'text-warning',
      width: '66%',
      description: 'Good! Consider adding more variety',
    },
    strong: {
      label: 'Strong',
      color: 'bg-success',
      textColor: 'text-success',
      width: '100%',
      description: 'Excellent password!',
    },
  };

  const config = strengthConfig[strength];

  // Don't show indicator if password is empty
  if (!password || password.length === 0) {
    return null;
  }

  return (
    <div
      className={`password-strength-indicator${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Password strength: ${config.label}`}
    >
      {/* Strength bar */}
      <div className="bg-base-300 h-2 w-full overflow-hidden rounded-full">
        <div
          className={`h-full ${config.color} transition-all duration-300 ease-in-out`}
          style={{ width: config.width }}
        />
      </div>

      {/* Strength label and description */}
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-sm font-medium ${config.textColor}`}>
          {config.label}
        </span>
        <span className="text-base-content/70 text-xs">
          {config.description}
        </span>
      </div>
    </div>
  );
}
