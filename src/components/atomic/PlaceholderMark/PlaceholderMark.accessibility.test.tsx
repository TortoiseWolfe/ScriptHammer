import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import PlaceholderMark from './PlaceholderMark';

vi.mock('@/config/project.config', () => ({
  getProjectConfig: vi.fn(() => ({ projectName: 'Grand Daze' })),
}));

describe('PlaceholderMark accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<PlaceholderMark />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('exposes a name rather than an unlabelled graphic', async () => {
    const { getByRole } = render(<PlaceholderMark />);
    expect(getByRole('img')).toHaveAccessibleName(
      'Grand Daze placeholder mark'
    );
  });
});
