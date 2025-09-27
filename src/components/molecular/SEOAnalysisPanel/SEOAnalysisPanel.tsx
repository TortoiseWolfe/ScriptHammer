'use client';

import React, { useState } from 'react';
import type { BlogPost } from '@/types/blog';
import { seoAnalyzer } from '@/lib/blog/seo-analyzer';

export interface SEOAnalysisPanelProps {
  post: BlogPost;
  expanded?: boolean;
  onToggle?: () => void;
}

export default function SEOAnalysisPanel({
  post,
  expanded = false,
  onToggle,
}: SEOAnalysisPanelProps) {
  const [copied, setCopied] = useState(false);
  const analysis = seoAnalyzer.analyze(post);
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
              className="btn btn-xs sm:btn-sm btn-ghost"
              title="Copy SEO feedback"
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            <div
              className={`radial-progress text-${seoAnalyzer.getScoreColor(score.overall)}`}
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
              className={`stat-value text-sm text-${score.title >= 80 ? 'success' : score.title >= 60 ? 'warning' : 'error'}`}
            >
              {score.title}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Description</div>
            <div
              className={`stat-value text-sm text-${score.description >= 80 ? 'success' : score.description >= 60 ? 'warning' : 'error'}`}
            >
              {score.description}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Content</div>
            <div
              className={`stat-value text-sm text-${score.content >= 80 ? 'success' : score.content >= 60 ? 'warning' : 'error'}`}
            >
              {score.content}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Keywords</div>
            <div
              className={`stat-value text-sm text-${score.keywords >= 80 ? 'success' : score.keywords >= 60 ? 'warning' : 'error'}`}
            >
              {score.keywords}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Readability</div>
            <div
              className={`stat-value text-sm text-${score.readability >= 80 ? 'success' : score.readability >= 60 ? 'warning' : 'error'}`}
            >
              {score.readability}%
            </div>
          </div>
          <div className="stat bg-base-100 rounded p-2">
            <div className="stat-title text-xs">Technical</div>
            <div
              className={`stat-value text-sm text-${score.technical >= 80 ? 'success' : score.technical >= 60 ? 'warning' : 'error'}`}
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
                  <span className="text-success mt-0.5 flex-shrink-0">✓</span>
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
                  <span className="text-error mt-0.5 flex-shrink-0">✗</span>
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
                className={`alert alert-${suggestion.severity === 'error' ? 'error' : suggestion.severity === 'warning' ? 'warning' : 'info'} px-3 py-2`}
              >
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="badge badge-xs sm:badge-sm badge-outline">
                      {suggestion.category}
                    </span>
                    <span className="text-xs opacity-70">
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
            <button onClick={onToggle} className="btn btn-sm btn-ghost">
              {expanded ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
