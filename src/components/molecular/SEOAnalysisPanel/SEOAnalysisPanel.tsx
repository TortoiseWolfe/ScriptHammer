'use client';

import React, { useState, useMemo } from 'react';
import type { BlogPost } from '@/types/blog';
import { seoAnalyzer } from '@/lib/blog/seo-analyzer';
import Icon from '@/components/atomic/Icon';

export interface SEOAnalysisPanelProps {
  post: BlogPost;
  expanded?: boolean;
  onToggle?: () => void;
}

const scoreColorClass = (value: number) =>
  value >= 80 ? 'text-success' : value >= 60 ? 'text-warning' : 'text-error';

const alertSeverityClass = (severity: string) =>
  severity === 'error'
    ? 'alert-error'
    : severity === 'warning'
      ? 'alert-warning'
      : 'alert-info';

export default function SEOAnalysisPanel({
  post,
  expanded = false,
  onToggle,
}: SEOAnalysisPanelProps) {
  const [copied, setCopied] = useState(false);
  // analyze() runs regex/split over the full post body — memoize so it doesn't
  // re-run on unrelated re-renders (e.g. the copied-toggle).
  const analysis = useMemo(() => seoAnalyzer.analyze(post), [post]);
  const { score, suggestions, strengths, weaknesses } = analysis;

  const copyFeedback = () => {
    // Format the SEO analysis as plain text
    const feedback = [
      `SEO Analysis for: ${post.title}`,
      `Overall Score: ${score.overall}%`,
      '',
      `Weaknesses (${weaknesses.length})`,
      ...weaknesses.map((w) => `✗ ${w}`),
      '',
      `Suggestions for Improvement (${suggestions.length})`,
      ...suggestions.map(
        (s) => `${s.category}\nImpact: ${s.impact}/10\n${s.message}\n`
      ),
    ].join('\n');

    navigator.clipboard.writeText(feedback).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="card bg-base-200 shadow-lg">
      <div className="card-body p-4 sm:p-6">
        {/* Header with Overall Score and Copy Button */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="card-title text-base sm:text-lg">SEO Analysis</h3>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              onClick={copyFeedback}
              className="sh-btn sh-btn-ghost !px-4 !text-[11px]"
              title="Copy SEO feedback"
            >
              {/* Decorative (#385): the word beside it changes too. */}
              <Icon name={copied ? 'check' : 'copy'} decorative />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <div
              className={`radial-progress ${scoreColorClass(score.overall)}`}
              style={
                {
                  '--value': score.overall,
                  '--size': '2.5rem',
                  '--thickness': '3px',
                } as React.CSSProperties
              }
            >
              {score.overall}%
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Title</div>
            <div
              className={`stat-value text-sm ${scoreColorClass(score.title)}`}
            >
              {score.title}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Description</div>
            <div
              className={`stat-value text-sm ${scoreColorClass(score.description)}`}
            >
              {score.description}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Content</div>
            <div
              className={`stat-value text-sm ${scoreColorClass(score.content)}`}
            >
              {score.content}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Keywords</div>
            <div
              className={`stat-value text-sm ${scoreColorClass(score.keywords)}`}
            >
              {score.keywords}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Readability</div>
            <div
              className={`stat-value text-sm ${scoreColorClass(score.readability)}`}
            >
              {score.readability}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Technical</div>
            <div
              className={`stat-value text-sm ${scoreColorClass(score.technical)}`}
            >
              {score.technical}%
            </div>
          </div>
        </div>

        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="mb-4">
            <h4 className="text-success mb-2 text-xs font-semibold sm:text-sm">
              Strengths ({strengths.length})
            </h4>
            <ul className="space-y-1">
              {strengths.map((strength, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs sm:text-sm"
                >
                  {/* Decorative: the <h4> above reads "Strengths (N)", so
                      the marker is not the only non-colour signal (#385). */}
                  <span className="text-success mt-0.5 flex-shrink-0">
                    <Icon name="check" decorative />
                  </span>
                  <span className="break-words">{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {weaknesses.length > 0 && (
          <div className="mb-4">
            <h4 className="text-error mb-2 text-xs font-semibold sm:text-sm">
              Weaknesses ({weaknesses.length})
            </h4>
            <ul className="space-y-1">
              {weaknesses.map((weakness, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs sm:text-sm"
                >
                  {/* Decorative: the <h4> above reads "Weaknesses (N)". */}
                  <span className="text-error mt-0.5 flex-shrink-0">
                    <Icon name="close" decorative />
                  </span>
                  <span className="break-words">{weakness}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Detailed Suggestions */}
        <div>
          <h4 className="mb-2 text-xs font-semibold sm:text-sm">
            Suggestions for Improvement ({suggestions.length})
          </h4>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {suggestions.map((suggestion, i) => (
              <div
                key={i}
                className={`alert ${alertSeverityClass(suggestion.severity)} px-3 py-2`}
              >
                {/* THE ALERT OWNS THE TEXT COLOUR HERE (#459).
                    `.alert-warning` paints a dark amber in the LIGHT theme and
                    sets a matching content colour. Two children fought it: this
                    span carried `text-base-content`, and `.badge` sets a
                    `base-content` of its own — both dark, on dark amber,
                    measuring 1.66:1 against a 7:1 requirement. The sibling <p>
                    below never overrode anything, which is exactly why it
                    passed while these did not.

                    `text-current` makes the badge inherit. The /85 opacity is
                    REMOVED rather than reduced: dimming text on a coloured
                    surface is the same trap globals.css documents for DaisyUI's
                    .label, and it is what put this below AAA in the first
                    place. */}
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="badge badge-xs sm:badge-sm badge-outline !text-current">
                      {suggestion.category}
                    </span>
                    <span className="text-xs">
                      Impact: {suggestion.impact}/10
                    </span>
                  </div>
                  <p className="text-xs break-words sm:text-sm">
                    {suggestion.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Toggle Button if provided */}
        {onToggle && (
          <div className="card-actions mt-4 justify-end">
            <button
              onClick={onToggle}
              className="sh-btn sh-btn-ghost !px-4 !text-[11px]"
            >
              {expanded ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
