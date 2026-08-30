import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FontSizeControl, TextSettingsPanel } from './FontSizeControl';

const updateSettings = vi.fn();
const resetSettings = vi.fn();
let settings = { fontSize: 'medium', lineHeight: 'normal' };

vi.mock('@/contexts/AccessibilityContext', () => ({
  useAccessibility: () => ({ settings, updateSettings, resetSettings }),
}));

beforeEach(() => {
  updateSettings.mockClear();
  resetSettings.mockClear();
  settings = { fontSize: 'medium', lineHeight: 'normal' };
});

describe('TextSettingsPanel', () => {
  it('offers all four sizes and all three spacings', () => {
    render(<TextSettingsPanel />);
    for (const label of ['S', 'M', 'L', 'XL']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    for (const label of ['1.2', '1.5', '1.8']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('sends the token, not the visible abbreviation', async () => {
    const user = userEvent.setup();
    render(<TextSettingsPanel />);
    await user.click(screen.getByRole('button', { name: 'XL' }));
    // The button says "XL"; the setting is 'x-large'. A mismatch here would show
    // as a control that visibly does nothing.
    expect(updateSettings).toHaveBeenCalledWith({ fontSize: 'x-large' });

    await user.click(screen.getByRole('button', { name: '1.8' }));
    expect(updateSettings).toHaveBeenCalledWith({ lineHeight: 'relaxed' });
  });

  it('marks the active size and spacing', () => {
    settings = { fontSize: 'large', lineHeight: 'compact' };
    render(<TextSettingsPanel />);
    expect(screen.getByRole('button', { name: 'L' })).toHaveClass(
      'btn-primary'
    );
    expect(screen.getByRole('button', { name: 'M' })).not.toHaveClass(
      'btn-primary'
    );
    expect(screen.getByRole('button', { name: '1.2' })).toHaveClass(
      'btn-primary'
    );
  });

  it('resets through the context, not by writing storage itself', async () => {
    const user = userEvent.setup();
    render(<TextSettingsPanel />);
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(resetSettings).toHaveBeenCalledTimes(1);
  });

  it('links onward to the full accessibility page', () => {
    render(<TextSettingsPanel />);
    expect(
      screen.getByRole('link', { name: 'View all accessibility options' })
    ).toHaveAttribute('href', '/accessibility');
  });

  it('keeps every control at the 44px touch floor', () => {
    render(<TextSettingsPanel />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-11');
    }
  });
});

describe('FontSizeControl', () => {
  it('is the panel behind a trigger', () => {
    render(<FontSizeControl />);
    // Same controls, wrapped. GlobalNav imports the PANEL directly so it does not
    // nest a second dropdown inside `Display ▾`; this wrapper is the standalone form.
    expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument();
    expect(screen.getByText('Text Settings')).toBeInTheDocument();
  });

  it('constrains the popover to the viewport on a narrow screen', () => {
    const { container } = render(<FontSizeControl />);
    // Without max-w the 18rem panel overflows a 360px screen and the Reset button
    // becomes unreachable.
    expect(container.querySelector('.dropdown-content')?.className).toContain(
      'max-w-[calc(100vw-2rem)]'
    );
  });
});
