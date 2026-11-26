import React from 'react';
import Link from 'next/link';
import {
  SCHEDULE_HEADING,
  SCHEDULE_ZONE_NOTE,
  SCHEDULE_CHANNEL,
  SCHEDULE_CHANNEL_URL,
  DAILY_SLOTS,
  THURSDAY_EVENING,
  range,
  type ScheduleSlot,
} from '@/lib/band/schedule';

export interface BandScheduleProps {
  className?: string;
}

const TH =
  'border-b border-[#3a3f66] px-2 py-2 text-left text-base font-bold text-[#f5b335] md:px-3';
const TD =
  'border-b border-[#3a3f66] px-2 py-3 align-top text-lg leading-[1.5] md:px-3';

function SlotTable({
  caption,
  slots,
}: {
  caption: string;
  slots: readonly ScheduleSlot[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Time (ET)
            </th>
            <th scope="col" className={TH}>
              Show
            </th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.id} data-testid="schedule-slot">
              <th
                scope="row"
                className={`${TD} w-[8.5rem] font-bold text-[#f6ecd0] md:w-auto md:whitespace-nowrap`}
              >
                {range(slot)}
              </th>
              <td className={TD}>
                <strong className="block text-[#f6ecd0]">{slot.title}</strong>
                {slot.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The channel's weekly grid on /band. Plain server output: no script, no
 * request, so it stays inside the kid-safe rules of the page. The same grid is
 * on the Twitch About page's Schedule panel (src/lib/band/schedule.ts).
 */
export default function BandSchedule({ className }: BandScheduleProps) {
  return (
    <section
      id="stream-schedule"
      aria-labelledby="stream-schedule-heading"
      data-testid="band-schedule"
      className={`rounded-2xl border border-[#3a3f66] bg-[#1c1f34] p-5 text-[#f6ecd0] shadow-[0_6px_12px_-5px_rgb(0_0_0/0.6),0_2px_4px_-2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(246_236_208/0.12)] sm:p-8${className ? ` ${className}` : ''}`}
    >
      <h2
        id="stream-schedule-heading"
        className="sh-font-special-elite !mt-0 !mb-3 !text-3xl text-balance text-[#f5b335] md:!text-4xl"
      >
        {SCHEDULE_HEADING}
      </h2>
      <p className="!m-0 max-w-[68ch] text-lg leading-[1.65]">
        The channel never goes dark. {SCHEDULE_ZONE_NOTE} Watch free at{' '}
        <a
          href={SCHEDULE_CHANNEL_URL}
          rel="noopener noreferrer"
          className="font-bold [overflow-wrap:anywhere] text-[#f5b335] underline underline-offset-4 hover:text-[#f6ecd0]"
        >
          {SCHEDULE_CHANNEL}
        </a>
        .
      </p>

      <h3 className="!mt-6 !mb-2 text-xl font-bold text-balance text-[#f5b335]">
        Every day
      </h3>
      <SlotTable caption="Daily schedule in Eastern time" slots={DAILY_SLOTS} />

      <h3 className="!mt-8 !mb-2 text-xl font-bold text-balance text-[#f5b335]">
        Thursday evenings
      </h3>
      <p className="!mt-0 !mb-3 max-w-[68ch] text-lg leading-[1.65]">
        On Thursdays the band plays live. These three rows take the place of the
        evening album show and the set reruns, 6:00 to 10:00 PM.
      </p>
      <SlotTable
        caption="Thursday evening schedule in Eastern time"
        slots={THURSDAY_EVENING}
      />

      <p className="!mt-6 !mb-0 max-w-[68ch] text-lg leading-[1.65]">
        Want the band at your event?{' '}
        <Link
          href="/schedule?from=band"
          className="font-bold text-[#f5b335] underline underline-offset-4 hover:text-[#f6ecd0]"
        >
          Book the band
        </Link>
        .
      </p>
    </section>
  );
}
