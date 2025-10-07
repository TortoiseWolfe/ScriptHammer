import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PasswordStrengthIndicator, {
  calculatePasswordStrength,
} from './PasswordStrengthIndicator';

describe('PasswordStrengthIndicator', () => {
  describe('calculatePasswordStrength', () => {
    it('returns weak for empty password', () => {
      expect(calculatePasswordStrength('')).toBe('weak');
    });

    it('returns weak for short simple password', () => {
      expect(calculatePasswordStrength('abc')).toBe('weak');
    });

    it('returns medium for password with good variety', () => {
      expect(calculatePasswordStrength('Password1')).toBe('medium');
    });

    it('returns strong for complex password', () => {
      expect(calculatePasswordStrength('MyP@ssw0rd123!')).toBe('strong');
    });
  });

  describe('Component rendering', () => {
    it('returns null when password is empty', () => {
      const { container } = render(<PasswordStrengthIndicator password="" />);
      expect(container.firstChild).toBeNull();
    });

    it('shows weak indicator for weak password', () => {
      render(<PasswordStrengthIndicator password="abc" />);
      expect(screen.getByText('Weak')).toBeInTheDocument();
      expect(
        screen.getByText('Add more characters, uppercase, numbers, and symbols')
      ).toBeInTheDocument();
    });

    it('shows medium indicator for medium strength password', () => {
      render(<PasswordStrengthIndicator password="Password1" />);
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(
        screen.getByText('Good! Consider adding more variety')
      ).toBeInTheDocument();
    });

    it('shows strong indicator for strong password', () => {
      render(<PasswordStrengthIndicator password="MyP@ssw0rd123!" />);
      expect(screen.getByText('Strong')).toBeInTheDocument();
      expect(screen.getByText('Excellent password!')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <PasswordStrengthIndicator password="test" className="custom-class" />
      );
      const element = container.querySelector('.password-strength-indicator');
      expect(element).toHaveClass('custom-class');
    });

    it('calls onChange callback when strength changes', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <PasswordStrengthIndicator password="abc" onChange={onChange} />
      );
      expect(onChange).toHaveBeenCalledWith('weak');

      rerender(
        <PasswordStrengthIndicator
          password="MyP@ssw0rd123!"
          onChange={onChange}
        />
      );
      expect(onChange).toHaveBeenCalledWith('strong');
    });

    it('has proper ARIA attributes', () => {
      render(<PasswordStrengthIndicator password="Password1" />);
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('aria-label', 'Password strength: Medium');
    });
  });
});
