import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BandMemberCard from './BandMemberCard';
import { ROSTER, PICTURED_ROSTER } from '@/lib/band/roster';
import { getAssetUrl } from '@/config/project.config';

const member = PICTURED_ROSTER[0];

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

  it('shows a member with no portrait as text only, with no broken picture', () => {
    const timber = ROSTER.find((m) => m.slug === 'timber')!;
    render(<BandMemberCard member={timber} />);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Timber' })
    ).toBeInTheDocument();
    expect(screen.getByText(timber.instrument)).toBeInTheDocument();
    expect(screen.getByText(`${timber.role}.`)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <BandMemberCard member={member} className="custom-test-class" />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});
