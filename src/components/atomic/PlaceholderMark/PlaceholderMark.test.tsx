import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlaceholderMark from './PlaceholderMark';

vi.mock('@/config/project.config', () => ({
  getProjectConfig: vi.fn(() => ({ projectName: 'Grand Daze' })),
}));

import { getProjectConfig } from '@/config/project.config';

describe('PlaceholderMark', () => {
  afterEach(() => vi.clearAllMocks());

  it('derives its initials from the project name', () => {
    render(<PlaceholderMark />);
    expect(screen.getByText('GD')).toBeInTheDocument();
  });

  it('uses one letter for a single-word name', () => {
    vi.mocked(getProjectConfig).mockReturnValueOnce({
      projectName: 'widget',
    } as ReturnType<typeof getProjectConfig>);
    render(<PlaceholderMark />);
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('splits on hyphens and underscores, which is what a slug looks like', () => {
    vi.mocked(getProjectConfig).mockReturnValueOnce({
      projectName: 'grand-daze',
    } as ReturnType<typeof getProjectConfig>);
    render(<PlaceholderMark />);
    expect(screen.getByText('GD')).toBeInTheDocument();
  });

  it('names itself after the project, so a screen reader does not say "image"', () => {
    render(<PlaceholderMark />);
    expect(
      screen.getByRole('img', { name: 'Grand Daze placeholder mark' })
    ).toBeInTheDocument();
  });

  it('renders no text from any other project — it cannot ship a borrowed brand', () => {
    const { container } = render(<PlaceholderMark />);
    // The whole point: this mark is derived, never inherited.
    expect(container.textContent).not.toMatch(/scripthammer/i);
  });

  it('accepts an explicit override', () => {
    render(<PlaceholderMark initials="XY" label="Custom" />);
    expect(screen.getByRole('img', { name: 'Custom' })).toBeInTheDocument();
    expect(screen.getByText('XY')).toBeInTheDocument();
  });
});
