import React from 'react';
import BandMemberCard from '@/components/molecular/BandMemberCard';
import { ROSTER, type BandMember } from '@/lib/band/roster';

export interface BandRosterProps {
  /** Members to show. Defaults to the whole band. */
  members?: readonly BandMember[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * BandRoster component
 *
 * The whole band as a list of member cards.
 *
 * @category molecular
 */
export default function BandRoster({
  members = ROSTER,
  className = '',
}: BandRosterProps) {
  return (
    <ul
      aria-label="Band members"
      className={`band-roster m-0 flex list-none flex-wrap justify-center gap-6 p-0${className ? ` ${className}` : ''}`}
    >
      {members.map((member) => (
        <li
          key={member.slug}
          className="m-0 w-full p-0 sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] xl:w-[calc(25%-1.125rem)]"
        >
          <BandMemberCard member={member} />
        </li>
      ))}
    </ul>
  );
}
