import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

expect.extend(toHaveNoViolations);

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
}));

import Controls from './Controls';

describe('Controls Accessibility', () => {
  it('has no a11y violations when rendered in isolation (no DOM surface)', async () => {
    const { container } = render(<Controls />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
