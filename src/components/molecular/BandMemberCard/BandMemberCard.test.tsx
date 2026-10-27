import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BandMemberCard from './BandMemberCard';
import { ROSTER } from '@/lib/band/roster';
import { getAssetUrl } from '@/config/project.config';

const member = ROSTER[0];

describe('BandMemberCard', () => {
  it('shows name, instrument and role', () => {
    render(<BandMemberCard member={member} />);
    expect(
      screen.getByRole('heading', { level: 3, name: member.name })
    ).toBeInTheDocument();
    expect(screen.getByText(member.instrument)).toBeInTheDocument();
    expect(screen.getByText(`${member.role}.`)).toBeInTheDocument();
  });

  it('serves the portrait through getAssetUrl with the roster alt text', () => {
    render(<BandMemberCard member={member} />);
    const img = screen.getByRole('img', { name: member.alt });
    expect(img).toHaveAttribute('src', getAssetUrl(member.portrait512));
    expect(img.getAttribute('srcset')).toContain(
      getAssetUrl(member.portrait700)
    );
    expect(img).toHaveAttribute('width', '512');
    expect(img).toHaveAttribute('height', '512');
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <BandMemberCard member={member} className="custom-test-class" />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});
