import React from 'react';
import { getAssetUrl } from '@/config/project.config';
import type { BandMember } from '@/lib/band/roster';

export interface BandMemberCardProps {
  /** The band member to show. */
  member: BandMember;
  /** Additional CSS classes */
  className?: string;
}

/**
 * BandMemberCard component
 *
 * One member of ScriptHammer, the house band: portrait, name, instrument, role.
 * Sits on the fixed night-stage colours of /band, so its contrast does not
 * depend on the visitor's theme.
 *
 * @category molecular
 */
export default function BandMemberCard({
  member,
  className = '',
}: BandMemberCardProps) {
  return (
    <article
      data-testid="band-member-card"
      className={`band-member-card flex h-full flex-col overflow-hidden rounded-2xl border border-[#f5b335]/30 bg-[#1c1f34] text-[#f6ecd0] shadow-[0_6px_12px_-5px_rgb(0_0_0/0.6),0_2px_4px_-2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(246_236_208/0.12)]${className ? ` ${className}` : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAssetUrl(member.portrait512)}
        srcSet={`${getAssetUrl(member.portrait512)} 512w, ${getAssetUrl(member.portrait700)} 700w`}
        sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
        width={512}
        height={512}
        alt={member.alt}
        loading="lazy"
        decoding="async"
        className="aspect-[5/4] w-full bg-[#14172b] object-cover object-top sm:aspect-square"
      />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="sh-font-special-elite !m-0 !text-2xl text-[#f5b335]">
          {member.name}
        </h3>
        <p className="!m-0 text-lg font-semibold tracking-wide text-[#f6ecd0] uppercase">
          {member.instrument}
        </p>
        <p className="!m-0 text-lg text-[#f6ecd0]">
          <span className="font-semibold text-[#f5b335]">{member.role}.</span>{' '}
          {member.blurb}
        </p>
      </div>
    </article>
  );
}
