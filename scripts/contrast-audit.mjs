#!/usr/bin/env node

/**
 * contrast-audit.mjs
 *
 * Playwright-based WCAG contrast audit for Storybook components.
 * Connects to a running Storybook instance, iterates every story across
 * four themes, and computes foreground/background contrast ratios for all
 * visible text elements.  Produces a JSON report at
 * /tmp/contrast-audit-report.json and prints a human-readable summary to
 * stdout.
 *
 * Usage (inside Docker):
 *   node scripts/contrast-audit.mjs
 *
 * Prerequisites:
 *   - Storybook running at http://localhost:6006
 *   - Chromium installed at /usr/bin/chromium
 */

import { chromium } from '/app/node_modules/.pnpm/playwright-core@1.55.0/node_modules/playwright-core/index.mjs';
import { writeFile } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const STORYBOOK_BASE = 'http://localhost:6006';
const INDEX_URL = `${STORYBOOK_BASE}/index.json`;
const THEMES = ['scripthammer-dark', 'scripthammer-light', 'aqua', 'cyberpunk'];
const REPORT_PATH = '/tmp/contrast-audit-report.json';
const RENDER_WAIT_MS = 1000;

const TEXT_SELECTORS = [
  'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'button', 'label', 'li', 'td', 'th',
];

// AA and AAA thresholds for normal text (WCAG 2.1).
const AA_THRESHOLD = 4.5;
const AAA_THRESHOLD = 7.0;

// ---------------------------------------------------------------------------
// WCAG colour-science helpers
// ---------------------------------------------------------------------------

/**
 * Parse a CSS colour string (rgb / rgba) into { r, g, b, a } with channels
 * in [0, 255] and alpha in [0, 1].
 */
function parseCssColor(raw) {
  if (!raw || raw === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const rgbaMatch = raw.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (rgbaMatch) {
    return {
      r: parseFloat(rgbaMatch[1]),
      g: parseFloat(rgbaMatch[2]),
      b: parseFloat(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // Fallback: treat as opaque black so downstream maths never crashes.
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Linearise a single sRGB channel value (0-255) according to the IEC 61966-2-1
 * standard (used by WCAG 2.x relative-luminance definition).
 */
function linearize(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance per WCAG 2.x.
 */
function relativeLuminance({ r, g, b }) {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * WCAG contrast ratio between two { r, g, b } colours.
 */
function contrastRatio(fg, bg) {
  const lFg = relativeLuminance(fg);
  const lBg = relativeLuminance(bg);
  const lighter = Math.max(lFg, lBg);
  const darker = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Alpha-composite a foreground colour (with alpha) over an opaque background.
 * Returns an opaque { r, g, b } colour.
 */
function alphaComposite(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
  };
}

// ---------------------------------------------------------------------------
// In-page evaluation helpers (serialised into the browser context)
// ---------------------------------------------------------------------------

/**
 * Evaluate inside the page: for every matching text element, resolve the
 * effective foreground and background colours and return the raw data.
 *
 * We walk up the DOM to find the first ancestor with a non-transparent
 * computed background colour to use as the effective background.
 */
function collectElementData(selectors) {
  /** Parse a CSS colour string in the page context (duplicated because this
   *  function is serialised into the browser). */
  function _parse(raw) {
    if (!raw || raw === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const m = raw.match(
      /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
    );
    if (m) {
      return {
        r: parseFloat(m[1]),
        g: parseFloat(m[2]),
        b: parseFloat(m[3]),
        a: m[4] !== undefined ? parseFloat(m[4]) : 1,
      };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  /** Walk up the tree to find an ancestor with an opaque-ish background. */
  function _effectiveBg(el) {
    let node = el;
    // Accumulate semi-transparent layers so we can composite them.
    const layers = [];

    while (node && node !== document.documentElement) {
      const style = window.getComputedStyle(node);
      const bg = _parse(style.backgroundColor);
      if (bg.a > 0) {
        layers.unshift(bg); // bottom layer first
      }
      if (bg.a >= 1) break; // fully opaque -- no need to go further
      node = node.parentElement;
    }

    // If we never found a fully opaque layer, assume white as the page
    // backdrop (matches WCAG recommendation).
    let base = { r: 255, g: 255, b: 255 };

    for (const layer of layers) {
      const a = layer.a;
      base = {
        r: layer.r * a + base.r * (1 - a),
        g: layer.g * a + base.g * (1 - a),
        b: layer.b * a + base.b * (1 - a),
      };
    }
    return base;
  }

  /** Check whether an element or any ancestor has aria-hidden="true". */
  function _isAriaHidden(el) {
    let node = el;
    while (node) {
      if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  /** Get the direct (non-child-element) text of a node. */
  function _ownText(el) {
    let text = '';
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      }
    }
    return text.trim();
  }

  // Build the combined selector for all tag names, plus divs with direct text.
  const elements = [];

  // Query tag-based selectors.
  const allTagEls = document.querySelectorAll(selectors.join(','));
  for (const el of allTagEls) {
    elements.push(el);
  }

  // Also grab divs that contain direct text content.
  const divs = document.querySelectorAll('div');
  for (const div of divs) {
    if (_ownText(div).length > 0) {
      elements.push(div);
    }
  }

  // De-duplicate (a div could also match another selector if wrapped).
  const seen = new Set();
  const results = [];

  for (const el of elements) {
    if (seen.has(el)) continue;
    seen.add(el);

    // Skip aria-hidden elements.
    if (_isAriaHidden(el)) continue;

    // Determine the text to report.
    const text = _ownText(el) || (el.textContent || '').trim();
    if (!text) continue;

    // Skip invisible / zero-size elements.
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      continue;
    }

    const fgRaw = _parse(style.color);
    const bgResolved = _effectiveBg(el);

    // Alpha-composite the foreground colour over the resolved background.
    const fgComposited = {
      r: fgRaw.r * fgRaw.a + bgResolved.r * (1 - fgRaw.a),
      g: fgRaw.g * fgRaw.a + bgResolved.g * (1 - fgRaw.a),
      b: fgRaw.b * fgRaw.a + bgResolved.b * (1 - fgRaw.a),
    };

    results.push({
      tag: el.tagName.toLowerCase(),
      text: text.substring(0, 120), // truncate for readability
      fg: fgComposited,
      bg: bgResolved,
      fgRaw: { r: fgRaw.r, g: fgRaw.g, b: fgRaw.b, a: fgRaw.a },
      bgRaw: bgResolved,
      selector: el.tagName.toLowerCase() + (el.className ? '.' + [...el.classList].join('.') : ''),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main audit logic
// ---------------------------------------------------------------------------

async function fetchStoryIds() {
  const res = await fetch(INDEX_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Storybook index: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  // The v4 index format stores stories under `entries` (Storybook 7+) or
  // `stories` (older versions).  Accept either.
  const entries = data.entries || data.stories || {};
  const storyIds = Object.keys(entries).filter((id) => {
    const entry = entries[id];
    // Only include actual stories (type "story") -- skip docs pages.
    return !entry.type || entry.type === 'story';
  });

  return storyIds;
}

function storyUrl(storyId, theme) {
  return `${STORYBOOK_BASE}/iframe.html?id=${encodeURIComponent(storyId)}&globals=theme:${encodeURIComponent(theme)}`;
}

async function auditPage(page, storyId, theme) {
  const url = storyUrl(storyId, theme);
  const failures = [];

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
  } catch (err) {
    return { error: `Navigation failed: ${err.message}`, failures, elementsChecked: 0 };
  }

  // Allow time for theme styles & animations to settle.
  await page.waitForTimeout(RENDER_WAIT_MS);

  let elements;
  try {
    elements = await page.evaluate(collectElementData, TEXT_SELECTORS);
  } catch (err) {
    return { error: `Evaluate failed: ${err.message}`, failures, elementsChecked: 0 };
  }

  for (const el of elements) {
    const ratio = contrastRatio(el.fg, el.bg);
    const roundedRatio = Math.round(ratio * 100) / 100;

    const aaPass = ratio >= AA_THRESHOLD;
    const aaaPass = ratio >= AAA_THRESHOLD;

    if (!aaPass || !aaaPass) {
      failures.push({
        storyId,
        theme,
        tag: el.tag,
        text: el.text,
        selector: el.selector,
        foreground: `rgb(${Math.round(el.fg.r)}, ${Math.round(el.fg.g)}, ${Math.round(el.fg.b)})`,
        background: `rgb(${Math.round(el.bg.r)}, ${Math.round(el.bg.g)}, ${Math.round(el.bg.b)})`,
        contrastRatio: roundedRatio,
        aaPass,
        aaaPass,
        level: aaPass ? 'AAA-fail' : 'AA-fail',
      });
    }
  }

  return { error: null, failures, elementsChecked: elements.length };
}

async function main() {
  const startTime = Date.now();

  console.log('='.repeat(70));
  console.log('  WCAG Contrast Audit');
  console.log('='.repeat(70));
  console.log();

  // ------------------------------------------------------------------
  // 1. Fetch story IDs
  // ------------------------------------------------------------------
  console.log(`Fetching story index from ${INDEX_URL} ...`);
  let storyIds;
  try {
    storyIds = await fetchStoryIds();
  } catch (err) {
    console.error(`ERROR: Could not fetch story index: ${err.message}`);
    console.error('Make sure Storybook is running at', STORYBOOK_BASE);
    process.exit(1);
  }
  console.log(`Found ${storyIds.length} stories.\n`);

  if (storyIds.length === 0) {
    console.warn('No stories found -- nothing to audit.');
    process.exit(0);
  }

  // ------------------------------------------------------------------
  // 2. Launch browser
  // ------------------------------------------------------------------
  console.log('Launching Chromium ...');
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox'],
    });
  } catch (err) {
    console.error(`ERROR: Failed to launch Chromium: ${err.message}`);
    process.exit(1);
  }

  const context = await browser.newContext({
    colorScheme: 'dark',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  // ------------------------------------------------------------------
  // 3. Audit every story x theme combination
  // ------------------------------------------------------------------
  const allFailures = [];
  let totalElementsChecked = 0;
  let totalAAFails = 0;
  let totalAAAFails = 0;
  const errors = [];
  const totalCombinations = storyIds.length * THEMES.length;
  let completed = 0;

  for (const storyId of storyIds) {
    for (const theme of THEMES) {
      completed++;
      const pct = ((completed / totalCombinations) * 100).toFixed(1);
      process.stdout.write(
        `\r  [${completed}/${totalCombinations}] (${pct}%) Auditing: ${storyId} @ ${theme}` +
          ' '.repeat(20),
      );

      const result = await auditPage(page, storyId, theme);

      totalElementsChecked += result.elementsChecked;

      if (result.error) {
        errors.push({ storyId, theme, error: result.error });
      }

      for (const f of result.failures) {
        allFailures.push(f);
        if (!f.aaPass) totalAAFails++;
        if (!f.aaaPass) totalAAAFails++;
      }
    }
  }

  // Clear the progress line.
  process.stdout.write('\r' + ' '.repeat(100) + '\r');

  // ------------------------------------------------------------------
  // 4. Tear down
  // ------------------------------------------------------------------
  await context.close();
  await browser.close();

  // ------------------------------------------------------------------
  // 5. Build and write report
  // ------------------------------------------------------------------
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      storybookUrl: STORYBOOK_BASE,
      storiesCount: storyIds.length,
      themesAudited: THEMES,
      elapsedSeconds: parseFloat(elapsed),
    },
    summary: {
      totalElementsChecked,
      totalAAFailures: totalAAFails,
      totalAAAFailures: totalAAAFails,
      totalFailures: allFailures.length,
    },
    failures: allFailures,
    errors,
  };

  try {
    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`Report written to ${REPORT_PATH}`);
  } catch (err) {
    console.error(`ERROR: Could not write report: ${err.message}`);
  }

  // ------------------------------------------------------------------
  // 6. Console summary
  // ------------------------------------------------------------------
  console.log();
  console.log('='.repeat(70));
  console.log('  Audit Summary');
  console.log('='.repeat(70));
  console.log();
  console.log(`  Stories audited       : ${storyIds.length}`);
  console.log(`  Themes                : ${THEMES.join(', ')}`);
  console.log(`  Total combinations    : ${totalCombinations}`);
  console.log(`  Total elements checked: ${totalElementsChecked}`);
  console.log();
  console.log(`  AA  failures (ratio < ${AA_THRESHOLD}) : ${totalAAFails}`);
  console.log(`  AAA failures (ratio < ${AAA_THRESHOLD}) : ${totalAAAFails}`);
  console.log(`  Total failure entries  : ${allFailures.length}`);
  console.log();

  if (errors.length > 0) {
    console.log(`  Errors encountered: ${errors.length}`);
    for (const e of errors) {
      console.log(`    - ${e.storyId} @ ${e.theme}: ${e.error}`);
    }
    console.log();
  }

  if (allFailures.length > 0) {
    // Show the worst offenders (lowest contrast ratio first).
    const sorted = [...allFailures].sort((a, b) => a.contrastRatio - b.contrastRatio);
    const top = sorted.slice(0, 15);
    console.log('  Worst offenders (up to 15):');
    console.log('  ' + '-'.repeat(68));
    for (const f of top) {
      console.log(
        `    ${f.contrastRatio.toFixed(2).padStart(5)}:1  [${f.level.padEnd(8)}]  ` +
          `${f.storyId} @ ${f.theme}`,
      );
      console.log(
        `             <${f.tag}> "${f.text.substring(0, 50)}"  ` +
          `fg=${f.foreground}  bg=${f.background}`,
      );
    }
    console.log();
  }

  console.log(`  Completed in ${elapsed}s.`);
  console.log('='.repeat(70));

  // Exit with non-zero status if there are AA failures (useful for CI).
  if (totalAAFails > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(2);
});
