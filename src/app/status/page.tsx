'use client';

// Status dashboard — triage UI. The verdict line answers "is anything
// not green?" before you scroll. Below, every check is a ledger row
// with a state dot. Same rules as landing + docs — no card/stats/badge/
// collapse/alert, no primary color, flat divide-y rows only.
//
// Do NOT add back from the 2562-line original: the "services operational"
// list (six hardcoded green dots, no uptime check behind any of them), the
// Lighthouse "passing/missing" strings (static marketing copy). Bug fixed:
// old page read `d.performance` but lighthouse-scores.json nests under
// .mobile/.desktop — CI scores were NEVER shown, fell back to 92/98/95/100.

import { useEffect, useState } from 'react';
import { pwaTester, type PWATestResult } from '@/utils/pwa-test';
import { onFCP, onLCP, onCLS, onTTFB, type Metric } from '@/utils/web-vitals';
import { getAssetUrl } from '@/config/project.config';
import pkg from '../../../package.json';

type State = 'pass' | 'warn' | 'fail' | 'pending';
// prettier-ignore
interface Check { group: string; label: string; value: string; state: State; detail?: string }

// prettier-ignore
const DOT: Record<State, string> = {
  pass: 'text-success', warn: 'text-warning', fail: 'text-error', pending: 'text-base-content',
};
// prettier-ignore
const SR: Record<State, string> = { pass: 'passing', warn: 'warning', fail: 'failing', pending: 'pending' };

const VITALS = ['FCP', 'LCP', 'CLS', 'TTFB'] as const;
type Vital = (typeof VITALS)[number];

// prettier-ignore
const LH: readonly (readonly [string, string])[] = [
  ['performance', 'Performance'], ['accessibility', 'Accessibility'],
  ['bestPractices', 'Best Practices'], ['seo', 'SEO'],
];

// prettier-ignore
const rateLH = (n: number): State => (n >= 90 ? 'pass' : n >= 50 ? 'warn' : 'fail');
// prettier-ignore
const fromVital = (r: Metric['rating']): State =>
  r === 'good' ? 'pass' : r === 'needs-improvement' ? 'warn' : 'fail';

/** State color on the DOT only — DaisyUI text-warning is 1.66:1 on light, so
    the value text stays base-content. Dot = "look here"; number = readable. */
// prettier-ignore
function Row({ c }: { c: Check }) {
  return (
    <li className="flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-1 py-4">
      <span aria-hidden="true" className={`font-mono ${DOT[c.state]}`}>●</span>
      <span className="sr-only">{SR[c.state]}:</span>
      <span className="text-base-content font-semibold">{c.label}</span>
      <span className="text-base-content font-mono text-sm tabular-nums">{c.value}</span>
      {c.detail && <span className="text-base-content order-last w-full text-xs sm:order-none sm:ml-auto sm:w-auto">{c.detail}</span>}
    </li>
  );
}

/**
 * One Lighthouse score as the comp's gauge (#383): a cut WELL holding a big
 * number over a recessed track with a lit fill.
 *
 * The comp's four gauges read `2,431 tests`, `Lighthouse 100/100/100/100`,
 * `deploy #1,284` and `Updated 4m ago` — all mockup. This file's own header
 * warns against exactly that ("static marketing copy"), and the last time a
 * number here was decorative it hid a real bug for months: the old page read
 * `d.performance` while the JSON nests under .mobile/.desktop, so CI scores
 * were NEVER shown and it silently fell back to 92/98/95/100.
 *
 * So the gauges render the real Lighthouse numbers or they do not render.
 */
// prettier-ignore
function Gauge({ label, score }: { label: string; score: number | null }) {
  const state: State = score === null ? 'pending' : rateLH(score);
  const fill = score === null ? 0 : Math.max(0, Math.min(100, score));
  // Bar colour tracks the rating, so the gauge cannot look healthy while
  // reading badly. Decorative — the number beside it carries the meaning.
  const bar = state === 'pass' ? 'bg-success' : state === 'warn' ? 'bg-warning' : state === 'fail' ? 'bg-error' : 'bg-base-300';
  return (
    <li className="sh-well bg-base-100 rounded-box flex flex-col gap-3 p-5">
      <span className="text-base-content font-mono text-[11px] tracking-[.14em] uppercase">{label}</span>
      <span className="text-base-content font-display text-[40px] leading-none tabular-nums">
        {score === null ? '—' : score}
      </span>
      <span aria-hidden="true" className="sh-groove bg-base-100 h-2 w-full overflow-hidden rounded-full">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${fill}%` }} />
      </span>
      <span className="text-base-content font-mono text-[11px]">
        <span className="sr-only">{SR[state]}: </span>
        {score === null ? 'no CI score yet' : `${SR[state]} · ${score}/100`}
      </span>
    </li>
  );
}

export default function StatusPage() {
  const [vitals, setVitals] = useState<Partial<Record<Vital, Metric>>>({});
  const [pwa, setPwa] = useState<PWATestResult[]>([]);
  const [lh, setLh] = useState<Record<string, number | null> | null>(null);
  const [lhTime, setLhTime] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  // prettier-ignore
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    onFCP((m) => setVitals((p) => ({ ...p, FCP: m })));
    onLCP((m) => setVitals((p) => ({ ...p, LCP: m })));
    onCLS((m) => setVitals((p) => ({ ...p, CLS: m })));
    onTTFB((m) => setVitals((p) => ({ ...p, TTFB: m })));
    pwaTester.runAllTests().then(setPwa).catch(() => setPwa([]));
    fetch(getAssetUrl('/docs/lighthouse-scores.json'))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setLh(d.mobile ?? d); setLhTime(d.timestamp ?? null); })
      .catch(() => {});
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Normalize three sources → one Check[]. Rendering just maps it.
  // prettier-ignore
  const checks: Check[] = [
    ...LH.map(([k, label]): Check => {
      const n = lh?.[k];
      return typeof n !== 'number'
        ? { group: 'Lighthouse · mobile · CI', label, value: '—', state: 'pending' }
        : { group: 'Lighthouse · mobile · CI', label, value: String(n), state: rateLH(n) };
    }),
    ...VITALS.map((k): Check => {
      const m = vitals[k];
      return m == null
        ? { group: 'Web Vitals · this page load', label: k, value: '—', state: 'pending' }
        : { group: 'Web Vitals · this page load', label: k,
            value: k === 'CLS' ? m.value.toFixed(3) : `${Math.round(m.value)} ms`,
            state: fromVital(m.rating) };
    }),
    ...pwa.map((r): Check => ({
      group: 'PWA · live probe', label: r.feature, value: r.status,
      state: r.status === 'pass' ? 'pass' : r.status === 'warning' ? 'warn' : 'fail',
      detail: r.message,
    })),
  ];

  const settled = checks.filter((c) => c.state !== 'pending');
  const bad = settled.filter((c) => c.state !== 'pass');
  // prettier-ignore
  const verdict: { state: State; text: string } =
    settled.length === 0 ? { state: 'pending', text: 'Running checks…' }
    : bad.length === 0   ? { state: 'pass',    text: `All ${settled.length} checks passing` }
    : { state: bad.some((c) => c.state === 'fail') ? 'fail' : 'warn',
        text: `${bad.length} of ${settled.length} need attention` };

  // The gauge wall above IS the Lighthouse presentation once scores load, so
  // the ledger drops that group rather than printing the same four numbers a
  // second time. They stay in the ledger while pending, so a missing CI score
  // is still visible somewhere.
  const LH_GROUP = 'Lighthouse · mobile · CI';
  const groups = [...new Set(checks.map((c) => c.group))].filter(
    (g) => !(lh && g === LH_GROUP)
  );

  // prettier-ignore
  return (
    <main className="bg-base-200 min-h-full">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Verdict pill beside the title, recessed — the composition and the
            depth in the design source (`docs/design/2a/ScriptHammer-Site.dc.html`,
            "3d STATUS"). It shipped as a raised plate; the design cuts it in,
            like every other reading on the page. See #383. */}
        <div className="mb-12 flex flex-wrap items-center gap-4">
          <p className="text-base-content sh-groove bg-base-100 flex items-center gap-2 rounded-full px-5 py-3 font-mono text-xs tracking-wider uppercase">
            <span aria-hidden="true" className={DOT[verdict.state]}>●</span>
            <span className="sr-only">{SR[verdict.state]}:</span>
            <span>{verdict.text}{!online && ' · offline'}</span>
          </p>
          <h1 className="text-base-content text-4xl tracking-tight sm:text-5xl">Status</h1>
        </div>

        {/* The gauge wall. Only renders once real CI scores have loaded — an
            empty wall is better than four invented hundreds. */}
        {lh && (
          <section aria-labelledby="lh-heading" className="mb-12">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="lh-heading" className="text-base-content font-mono text-xs tracking-wider uppercase">Lighthouse · CI</h2>
              {lhTime && (
                <p className="text-base-content font-mono text-[11px] tracking-[.12em] uppercase">
                  measured {lhTime.slice(0, 10)}
                </p>
              )}
            </div>
            <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {LH.map(([key, label]) => (
                <Gauge key={key} label={label} score={lh[key] ?? null} />
              ))}
            </ul>
          </section>
        )}

        {/* "Every well is a live reading" — each group of measurements is a
            cut WELL. Rows stay flat inside them; the depth is the container's
            job, not the row's. Same discipline as /docs (#380): no card, no
            badge, no page-local shadow values. */}
        {groups.map((g) => (
          <section key={g} className="mt-10 first:mt-0">
            <h2 className="text-base-content mb-3 font-mono text-xs tracking-wider uppercase">{g}</h2>
            <div className="sh-well bg-base-100 rounded-box px-4 py-2 sm:px-6">
              <ul className="divide-base-300 divide-y">
                {checks.filter((c) => c.group === g).map((c) => <Row key={c.label} c={c} />)}
              </ul>
            </div>
          </section>
        ))}

        <p className="text-base-content border-base-300 mt-16 border-t pt-8 font-mono text-xs">
          v{pkg.version} · {process.env.NODE_ENV}{lhTime && ` · CI scores from ${lhTime.slice(0, 10)}`}
        </p>
      </div>
    </main>
  );
}
