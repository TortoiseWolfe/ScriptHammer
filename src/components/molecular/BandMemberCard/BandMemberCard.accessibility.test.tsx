import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BandMemberCard from './BandMemberCard';
import { ROSTER } from '@/lib/band/roster';

expect.extend(toHaveNoViolations);

describe('BandMemberCard Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<BandMemberCard member={ROSTER[0]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('describes the picture, not the person, and names the member in a heading', () => {
    const { container } = render(<BandMemberCard member={ROSTER[1]} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', ROSTER[1].alt);
    expect(img?.getAttribute('alt')?.length).toBeGreaterThan(20);
    expect(container.querySelector('h3')).toHaveTextContent(ROSTER[1].name);
  });

  it('has no focusable elements, so it adds no tab stops', () => {
    const { container } = render(<BandMemberCard member={ROSTER[2]} />);
    expect(
      container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]'
      )
    ).toHaveLength(0);
  });
});
