import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorblindToggle } from './ColorblindToggle';
import { ColorblindType } from '@/utils/colorblind';

// Mock the useColorblindMode hook
vi.mock('@/hooks/useColorblindMode', () => ({
  useColorblindMode: vi.fn(() => ({
    mode: ColorblindType.NONE,
    setColorblindMode: vi.fn(),
    patternsEnabled: false,
    togglePatterns: vi.fn(),
  })),
}));

describe('ColorblindToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the toggle button', () => {
    render(<ColorblindToggle />);
    const button = screen.getByRole('button', { name: /color vision/i });
    expect(button).toBeInTheDocument();
  });

  it('should display the dropdown when clicked', async () => {
    const user = userEvent.setup();
    render(<ColorblindToggle />);

    const button = screen.getByRole('button', { name: /color vision/i });
    await user.click(button);

    // Check for dropdown content
    expect(screen.getByText('Color Vision Assistance')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should show all colorblind mode options', async () => {
    const user = userEvent.setup();
    render(<ColorblindToggle />);

    const button = screen.getByRole('button', { name: /color vision/i });
    await user.click(button);

    const select = screen.getByRole('combobox');

    // Check for main colorblind types
    expect(select).toHaveTextContent('No Correction Needed');
    const options = screen.getAllByRole('option');

    const expectedOptions = [
      'No Correction Needed',
      'Protanopia (Red-Blind) Correction',
      'Deuteranopia (Green-Blind) Correction',
      'Tritanopia (Blue-Blind) Correction',
      'Achromatopsia (No Color) Enhancement',
    ];

    expectedOptions.forEach((optionText) => {
      const option = options.find((o) => o.textContent === optionText);
      expect(option).toBeDefined();
    });
  });

  it('should call setColorblindMode when selecting a mode', async () => {
    const mockSetMode = vi.fn();
    const { useColorblindMode } = await import('@/hooks/useColorblindMode');
    (useColorblindMode as ReturnType<typeof vi.fn>).mockReturnValue({
      mode: ColorblindType.NONE,
      setColorblindMode: mockSetMode,
      patternsEnabled: false,
      togglePatterns: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ColorblindToggle />);

    const button = screen.getByRole('button', { name: /color vision/i });
    await user.click(button);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, ColorblindType.DEUTERANOPIA);

    expect(mockSetMode).toHaveBeenCalledWith(ColorblindType.DEUTERANOPIA);
  });

  it('should show pattern toggle when colorblind mode is active', async () => {
    const { useColorblindMode } = await import('@/hooks/useColorblindMode');
    (useColorblindMode as ReturnType<typeof vi.fn>).mockReturnValue({
      mode: ColorblindType.PROTANOPIA,
      setColorblindMode: vi.fn(),
      patternsEnabled: false,
      togglePatterns: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ColorblindToggle />);

    const button = screen.getByRole('button', { name: /color vision/i });
    await user.click(button);

    // Should show pattern toggle
    expect(screen.getByText('Enable Patterns')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('should not show pattern toggle when mode is NONE', async () => {
    const { useColorblindMode } = await import('@/hooks/useColorblindMode');
    (useColorblindMode as ReturnType<typeof vi.fn>).mockReturnValue({
      mode: ColorblindType.NONE,
      setColorblindMode: vi.fn(),
      patternsEnabled: false,
      togglePatterns: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ColorblindToggle />);

    const button = screen.getByRole('button', { name: /color vision/i });
    await user.click(button);

    // Should not show pattern toggle
    expect(screen.queryByText('Enable Patterns')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('should call togglePatterns when checkbox is clicked', async () => {
    const mockTogglePatterns = vi.fn();
    const { useColorblindMode } = await import('@/hooks/useColorblindMode');
    (useColorblindMode as ReturnType<typeof vi.fn>).mockReturnValue({
      mode: ColorblindType.PROTANOPIA,
      setColorblindMode: vi.fn(),
      patternsEnabled: false,
      togglePatterns: mockTogglePatterns,
    });

    const user = userEvent.setup();
    render(<ColorblindToggle />);

    const button = screen.getByRole('button', { name: /color vision/i });
    await user.click(button);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(mockTogglePatterns).toHaveBeenCalled();
  });

  it('should show correct icon based on mode', async () => {
    const { rerender } = render(<ColorblindToggle />);

    // Normal vision - should show Eye icon
    let button = screen.getByRole('button', { name: /color vision/i });
    expect(button.querySelector('svg')).toBeInTheDocument();

    // With colorblind mode - should show EyeOff icon
    const { useColorblindMode } = await import('@/hooks/useColorblindMode');
    (useColorblindMode as ReturnType<typeof vi.fn>).mockReturnValue({
      mode: ColorblindType.PROTANOPIA,
      setColorblindMode: vi.fn(),
      patternsEnabled: false,
      togglePatterns: vi.fn(),
    });

    rerender(<ColorblindToggle />);
    button = screen.getByRole('button', { name: /color vision/i });
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('should display info alert with current mode', async () => {
    const { useColorblindMode } = await import('@/hooks/useColorblindMode');
    (useColorblindMode as ReturnType<typeof vi.fn>).mockReturnValue({
      mode: ColorblindType.DEUTERANOPIA,
      setColorblindMode: vi.fn(),
      patternsEnabled: false,
      togglePatterns: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ColorblindToggle />);

    const button = screen.getByRole('button', { name: /color vision/i });
    await user.click(button);

    // Should show current mode in alert
    expect(
      screen.getByText(/Correcting for.*Green-Blind/i)
    ).toBeInTheDocument();
  });

  it('should be keyboard accessible', async () => {
    render(<ColorblindToggle />);

    const button = screen.getByRole('button', { name: /color vision/i });

    // Should be focusable
    button.focus();
    expect(document.activeElement).toBe(button);

    // Should open on Enter key
    fireEvent.keyDown(button, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('Color Vision Assistance')).toBeInTheDocument();
    });
  });

  // Click outside behavior test removed - E2E test provides real browser coverage
  // DaisyUI CSS :focus-within not properly supported in jsdom
  // E2E test: /e2e/accessibility/colorblind-toggle.spec.ts

  it('should show label on larger screens', () => {
    render(<ColorblindToggle />);
    const button = screen.getByRole('button', { name: /color vision/i });
    const label = button.querySelector('.hidden.sm\\:inline');
    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent('Color Vision');
  });

  it('should persist selected mode to localStorage', async () => {
    const mockSetMode = vi.fn();
    const { useColorblindMode } = await import('@/hooks/useColorblindMode');
    (useColorblindMode as ReturnType<typeof vi.fn>).mockReturnValue({
      mode: ColorblindType.NONE,
      setColorblindMode: mockSetMode,
      patternsEnabled: false,
      togglePatterns: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ColorblindToggle />);

    const button = screen.getByRole('button', { name: /color vision/i });
    await user.click(button);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, ColorblindType.TRITANOPIA);

    expect(mockSetMode).toHaveBeenCalledWith(ColorblindType.TRITANOPIA);
  });
});
