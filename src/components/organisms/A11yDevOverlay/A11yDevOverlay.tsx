'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { ImpactValue, Result } from 'axe-core';
import { useA11yScan } from './useA11yScan';

export interface A11yDevOverlayProps {
  /**
   * Override violations instead of running a live axe scan. When provided, the internal
   * scan hook is bypassed — used by tests and Storybook to render deterministic states.
   */
  violations?: Result[];
  /** Start in the expanded (panel) state instead of the collapsed badge. */
  defaultExpanded?: boolean;
  /** Additional CSS classes applied to the root element. */
  className?: string;
}

/** Impact levels, ordered most → least severe. Drives sort order, badge color, and worst-impact. */
const IMPACT_ORDER: Exclude<ImpactValue, null>[] = [
  'critical',
  'serious',
  'moderate',
  'minor',
];

/** Maps an axe impact level to a DaisyUI badge/alert color class. */
const IMPACT_BADGE_CLASS: Record<Exclude<ImpactValue, null>, string> = {
  critical: 'badge-error',
  serious: 'badge-error',
  moderate: 'badge-warning',
  minor: 'badge-warning',
};

/** How long (ms) a click-to-highlight outline stays on the target element. */
const HIGHLIGHT_DURATION_MS = 3000;

/** Inline outline applied to a highlighted target element. */
const HIGHLIGHT_OUTLINE = '3px solid #f43f5e';

function impactRank(impact: ImpactValue | undefined): number {
  if (!impact) return IMPACT_ORDER.length;
  const idx = IMPACT_ORDER.indexOf(impact);
  return idx === -1 ? IMPACT_ORDER.length : idx;
}

/**
 * Dev-time accessibility overlay.
 *
 * A floating badge (color-coded by worst violation impact) that expands into a panel listing
 * the current axe-core violations. Supports filtering by impact, searching by rule id, and
 * click-to-highlight of the offending element.
 *
 * Rendering is gated to development: in production the bundler strips the mount in `layout.tsx`,
 * and this component additionally returns `null` when not in development unless explicit
 * `violations` are supplied (the path tests/Storybook use).
 *
 * @category organisms
 */
export default function A11yDevOverlay({
  violations: violationsProp,
  defaultExpanded = false,
  className = '',
}: A11yDevOverlayProps) {
  const scan = useA11yScan();
  const isControlled = violationsProp !== undefined;
  const violations = isControlled ? violationsProp : scan.violations;

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeImpacts, setActiveImpacts] = useState<
    Set<Exclude<ImpactValue, null>>
  >(new Set());
  const [search, setSearch] = useState('');

  // Tracks the currently highlighted element + its cleanup timer so re-clicks don't leak outlines.
  const highlightRef = useRef<{
    el: HTMLElement;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  const worstImpact = useMemo<ImpactValue>(
    () =>
      violations.reduce<ImpactValue>(
        (worst, v) =>
          impactRank(v.impact) < impactRank(worst)
            ? (v.impact ?? worst)
            : worst,
        null
      ),
    [violations]
  );

  const visibleViolations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...violations]
      .filter((v) => {
        if (activeImpacts.size > 0) {
          if (!v.impact || !activeImpacts.has(v.impact)) return false;
        }
        if (query && !v.id.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => impactRank(a.impact) - impactRank(b.impact));
  }, [violations, activeImpacts, search]);

  // Don't render anything in non-dev environments unless violations are explicitly supplied.
  // Placed after all hooks so the Rules of Hooks are never violated.
  if (!isControlled && process.env.NODE_ENV !== 'development') {
    return null;
  }

  const toggleImpact = (impact: Exclude<ImpactValue, null>) => {
    setActiveImpacts((prev) => {
      const next = new Set(prev);
      if (next.has(impact)) next.delete(impact);
      else next.add(impact);
      return next;
    });
  };

  const clearHighlight = () => {
    const current = highlightRef.current;
    if (current) {
      clearTimeout(current.timer);
      current.el.style.outline = '';
      current.el.style.outlineOffset = '';
      highlightRef.current = null;
    }
  };

  const highlightViolation = (violation: Result) => {
    const node = violation.nodes[0];
    // axe `target` is an array of selectors; >1 entry means the node lives inside nested iframes,
    // which we can't reach via a single `querySelector`. Handle the common single-selector case.
    const selector =
      node && node.target.length === 1 && typeof node.target[0] === 'string'
        ? node.target[0]
        : null;
    if (!selector) return;

    let el: HTMLElement | null = null;
    try {
      el = document.querySelector<HTMLElement>(selector);
    } catch {
      el = null;
    }
    if (!el) return;

    clearHighlight();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.outline = HIGHLIGHT_OUTLINE;
    el.style.outlineOffset = '2px';
    const timer = setTimeout(clearHighlight, HIGHLIGHT_DURATION_MS);
    highlightRef.current = { el, timer };
  };

  const badgeColor = worstImpact
    ? IMPACT_BADGE_CLASS[worstImpact]
    : 'badge-success';

  // Collapsed badge — a floating button showing the violation count.
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Accessibility violations: ${violations.length}. Open panel.`}
        className={`badge ${badgeColor} fixed right-4 bottom-20 z-[90] flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full px-3 shadow-lg ${className}`}
      >
        <span role="img" aria-hidden="true">
          ♿
        </span>
        <span className="font-mono font-bold">{violations.length}</span>
      </button>
    );
  }

  // Expanded panel.
  return (
    <section
      role="region"
      aria-label="Accessibility violations panel"
      className={`bg-base-100 border-base-300 text-base-content fixed right-4 bottom-20 z-[90] flex max-h-[70vh] w-80 flex-col rounded-lg border shadow-lg ${className}`}
    >
      <header className="border-base-300 flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span role="img" aria-hidden="true">
            ♿
          </span>
          A11y
          <span className={`badge badge-sm ${badgeColor}`}>
            {violations.length}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scan.rescan()}
            disabled={isControlled || scan.isScanning}
            aria-label="Re-scan page for accessibility violations"
            className="btn btn-ghost btn-xs min-h-11 min-w-11"
          >
            {scan.isScanning ? '…' : '↻'}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Collapse accessibility panel"
            className="btn btn-ghost btn-xs min-h-11 min-w-11"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="border-base-300 flex flex-col gap-2 border-b px-3 py-2">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Filter by impact"
        >
          {IMPACT_ORDER.map((impact) => (
            <button
              key={impact}
              type="button"
              onClick={() => toggleImpact(impact)}
              aria-pressed={activeImpacts.has(impact)}
              className={`badge badge-sm cursor-pointer ${
                activeImpacts.has(impact)
                  ? IMPACT_BADGE_CLASS[impact]
                  : 'badge-ghost'
              }`}
            >
              {impact}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by rule id…"
          aria-label="Search violations by rule id"
          className="input input-bordered input-xs w-full"
        />
      </div>

      <ul className="flex-1 overflow-y-auto" aria-live="polite">
        {visibleViolations.length === 0 ? (
          <li className="text-base-content/60 p-4 text-center text-sm">
            {violations.length === 0
              ? 'No accessibility violations 🎉'
              : 'No violations match the current filters.'}
          </li>
        ) : (
          visibleViolations.map((violation) => (
            <li
              key={violation.id}
              className="border-base-300 border-b px-3 py-2 text-sm last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-bold">{violation.id}</code>
                {violation.impact && (
                  <span
                    className={`badge badge-xs ${IMPACT_BADGE_CLASS[violation.impact]}`}
                  >
                    {violation.impact}
                  </span>
                )}
              </div>
              <p className="text-base-content/80 mt-1 text-xs">
                {violation.help}
              </p>
              {violation.nodes[0]?.target[0] && (
                <button
                  type="button"
                  onClick={() => highlightViolation(violation)}
                  aria-label={`Highlight element for ${violation.id}`}
                  className="mt-1 block w-full truncate text-left"
                >
                  <code className="link link-primary text-xs">
                    {String(violation.nodes[0].target[0])}
                  </code>
                </button>
              )}
              <a
                href={violation.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="link link-secondary mt-1 inline-block text-xs"
              >
                Learn more →
              </a>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
