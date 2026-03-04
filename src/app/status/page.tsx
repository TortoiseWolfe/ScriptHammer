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
import pkg from '../../../package.json';

type State = 'pass' | 'warn' | 'fail' | 'pending';
// prettier-ignore
interface Check { group: string; label: string; value: string; state: State; detail?: string }

// prettier-ignore
const DOT: Record<State, string> = {
  pass: 'text-success', warn: 'text-warning', fail: 'text-error', pending: 'text-base-content/30',
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
      {c.detail && <span className="text-base-content/70 order-last w-full text-xs sm:order-none sm:ml-auto sm:w-auto">{c.detail}</span>}
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
    fetch('/docs/lighthouse-scores.json')
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

  const groups = [...new Set(checks.map((c) => c.group))];

  // prettier-ignore
  return (
    <main className="bg-base-200 min-h-full">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <h1 className="text-base-content mb-2 text-4xl font-bold tracking-tight sm:text-5xl">Status</h1>

        {/* The verdict. If this dot is green you can stop reading. */}
        <p className="text-base-content mb-12 flex items-baseline gap-3 font-mono text-lg sm:text-xl">
          <span aria-hidden="true" className={DOT[verdict.state]}>●</span>
          <span className="sr-only">{SR[verdict.state]}:</span>
          <span>{verdict.text}{!online && ' · offline'}</span>
        </p>

        {groups.map((g) => (
          <section key={g} className="mt-10 first:mt-0">
            <h2 className="text-base-content/70 mb-3 font-mono text-xs tracking-wider uppercase">{g}</h2>
            <ul className="divide-base-300 divide-y">
              {checks.filter((c) => c.group === g).map((c) => <Row key={c.label} c={c} />)}
            </ul>
          </section>
        ))}

        <p className="text-base-content/70 border-base-300 mt-16 border-t pt-8 font-mono text-xs">
          v{pkg.version} · {process.env.NODE_ENV}{lhTime && ` · CI scores from ${lhTime.slice(0, 10)}`}
        </p>
      </div>
    </main>
  );
}
