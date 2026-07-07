import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

expect.extend(toHaveNoViolations);

vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({}),
}));

import ScriptTags from './ScriptTags';

describe('ScriptTags Accessibility', () => {
  it('has no a11y violations when rendered in isolation (no DOM surface)', async () => {
    const { container } = render(<ScriptTags />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
