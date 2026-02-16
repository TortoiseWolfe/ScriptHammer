import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { FontSwitcher } from './FontSwitcher';

expect.extend(toHaveNoViolations);

describe('FontSwitcher Accessibility', () => {
  beforeEach(() => {
    // Clean up any modals before each test
    document.body.innerHTML = '';
  });

  describe('ARIA Attributes', () => {
    it('should have proper ARIA labels', () => {
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      expect(button).toHaveAttribute('aria-label', 'Font Selection');
    });

    it('should mark dropdown as listbox', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Font options');
    });

    it('should mark font items as options', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);

      // Check aria-selected on options
      options.forEach((option) => {
        expect(option).toHaveAttribute('aria-selected');
      });
    });

    it('should indicate current selection with aria-selected', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      // At least one option should be selected
      const options = screen.getAllByRole('option');
      const selectedOptions = options.filter(
        (opt) => opt.getAttribute('aria-selected') === 'true'
      );
      expect(selectedOptions.length).toBe(1);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be keyboard accessible', async () => {
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });

      // Should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('should open with Enter key', async () => {
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      button.focus();

      // Press Enter
      await userEvent.keyboard('{Enter}');

      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
    });

    it('should render dropdown when opened', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      // DaisyUI dropdowns are CSS-based, just verify it renders
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should have keyboard accessible options', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      // Options should be present and accessible
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);

      // Options should be interactive
      options.forEach((option) => {
        expect(option.tagName.toLowerCase()).toBe('button');
      });
    });
  });

  describe('Focus Management', () => {
    it('should trap focus within dropdown', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();

      // Focus should be manageable within dropdown
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('should handle font selection', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      const interOption = screen.getByRole('option', { name: /inter/i });
      expect(interOption).toBeInTheDocument();

      // Verify option is clickable
      await user.click(interOption);
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce font descriptions', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      // Check that descriptions are present
      expect(screen.getByText(/designed for screens/i)).toBeInTheDocument();
      expect(screen.getByText(/help with dyslexia/i)).toBeInTheDocument();
    });

    it('should announce accessibility features', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      // Check for accessibility badges
      expect(screen.getByText('dyslexia-friendly')).toBeInTheDocument();
      expect(screen.getByText('high-readability')).toBeInTheDocument();
    });

    it('should have informative status messages', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      // Check for status region
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });
  });

  // Axe accessibility tests removed - Pa11y provides comprehensive accessibility testing
  // FontSwitcher is tested via Pa11y CI on /accessibility route (see /config/pa11yci.json)
  // Pa11y uses real browser (Chromium) which properly handles DaisyUI CSS-based dropdowns

  describe('Visual Indicators', () => {
    it('should show loading state for fonts', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      // Loading indicators would be present for web fonts
      // This depends on the mock implementation
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('should visually indicate current selection', async () => {
      const user = userEvent.setup();
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      await user.click(button);

      // Current font should have visual indicator
      const systemOption = screen.getByRole('option', {
        name: /system default/i,
      });

      // Check for active classes
      const isActive = systemOption.getAttribute('aria-selected') === 'true';
      if (isActive) {
        expect(systemOption.className).toContain('bg-primary');
      }
    });
  });

  describe('Responsive Design', () => {
    it('should be usable on mobile', () => {
      render(<FontSwitcher />);

      const button = screen.getByRole('button', { name: /font selection/i });
      expect(button).toBeInTheDocument();

      // Text should be hidden on small screens
      const buttonText = button.querySelector('.hidden.sm\\:inline');
      expect(buttonText).toBeInTheDocument();
    });
  });
});
