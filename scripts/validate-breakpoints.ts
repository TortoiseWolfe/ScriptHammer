#!/usr/bin/env tsx
/**
 * Breakpoint Validation Script (PRP-017: T023)
 *
 * Validates that:
 * 1. Tailwind CSS breakpoints match TypeScript configuration
 * 2. Test viewports align with defined breakpoints
 * 3. No gaps or overlaps exist in breakpoint ranges
 * 4. All critical mobile widths are covered by test viewports
 *
 * Usage:
 *   tsx scripts/validate-breakpoints.ts
 *   pnpm run validate:breakpoints
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  BREAKPOINTS,
  getBreakpointByWidth,
} from '../src/config/breakpoints.js';
import {
  TEST_VIEWPORTS,
  CRITICAL_MOBILE_WIDTHS,
} from '../src/config/test-viewports.js';
import type { BreakpointConfig } from '../src/types/mobile-first.js';

interface ValidationError {
  severity: 'error' | 'warning';
  message: string;
}

const errors: ValidationError[] = [];

/**
 * Extract breakpoint values from globals.css @theme directive
 */
function extractCSSBreakpoints(): Record<string, number> {
  const globalsPath = path.join(process.cwd(), 'src/app/globals.css');
  const content = fs.readFileSync(globalsPath, 'utf-8');

  const breakpointPattern = /--breakpoint-(xs|sm|md|lg|xl):\s*([\d.]+)rem;/g;
  const matches = content.matchAll(breakpointPattern);

  const cssBreakpoints: Record<string, number> = {};
  for (const match of matches) {
    const name = match[1];
    const remValue = parseFloat(match[2]);
    const pxValue = remValue * 16;
    cssBreakpoints[name] = pxValue;
  }

  return cssBreakpoints;
}

/**
 * Validate TypeScript breakpoints configuration
 */
function validateBreakpointConfig() {
  console.log('\n🔍 Validating breakpoint configuration...\n');

  // Check for gaps or overlaps
  for (let i = 0; i < BREAKPOINTS.length - 1; i++) {
    const current = BREAKPOINTS[i];
    const next = BREAKPOINTS[i + 1];

    if (current.maxWidth === undefined) {
      errors.push({
        severity: 'error',
        message: `Breakpoint ${current.name} has no maxWidth but is not the last breakpoint`,
      });
      continue;
    }

    // Check for gaps (next.minWidth should be current.maxWidth + 1)
    if (next.minWidth !== current.maxWidth + 1) {
      errors.push({
        severity: 'error',
        message: `Gap detected: ${current.name} ends at ${current.maxWidth}px but ${next.name} starts at ${next.minWidth}px`,
      });
    }
  }

  // Check last breakpoint has no maxWidth
  const last = BREAKPOINTS[BREAKPOINTS.length - 1];
  if (last.maxWidth !== undefined) {
    errors.push({
      severity: 'error',
      message: `Last breakpoint ${last.name} should not have maxWidth`,
    });
  }

  console.log('✅ Breakpoint configuration validated\n');
}

/**
 * Validate CSS breakpoints match TypeScript config
 */
function validateCSSSync() {
  console.log('🔍 Validating CSS @theme breakpoints...\n');

  const cssBreakpoints = extractCSSBreakpoints();

  for (const bp of BREAKPOINTS) {
    const cssValue = cssBreakpoints[bp.name];

    if (!cssValue) {
      errors.push({
        severity: 'error',
        message: `CSS breakpoint ${bp.name} not found in globals.css @theme`,
      });
      continue;
    }

    if (cssValue !== bp.minWidth) {
      errors.push({
        severity: 'error',
        message: `CSS breakpoint ${bp.name} (${cssValue}px) does not match TypeScript config (${bp.minWidth}px)`,
      });
    }
  }

  console.log('✅ CSS breakpoints validated\n');
}

/**
 * Validate test viewports align with breakpoints
 */
function validateTestViewports() {
  console.log('🔍 Validating test viewports...\n');

  const beforeViewports = errors.length;

  for (const viewport of TEST_VIEWPORTS) {
    const breakpoint = getBreakpointByWidth(viewport.width);

    // Skip landscape orientation mismatches (expected per NFR-001a)
    const isLandscape = viewport.name.toLowerCase().includes('landscape');
    const isOrientationMismatch =
      isLandscape && breakpoint.category !== viewport.category;

    if (breakpoint.category !== viewport.category && !isOrientationMismatch) {
      // Left as a WARNING deliberately: a viewport whose declared category
      // disagrees with the breakpoint it lands in is a naming inconsistency, not
      // lost coverage. The width is still tested.
      errors.push({
        severity: 'warning',
        message: `Test viewport "${viewport.name}" (${viewport.width}px) has category "${viewport.category}" but falls into breakpoint "${breakpoint.name}" with category "${breakpoint.category}"`,
      });
    }
  }

  if (errors.length === beforeViewports) {
    console.log('✅ Test viewports validated\n');
  }
}

/**
 * Validate critical mobile widths are covered
 */
function validateCriticalWidthsCoverage() {
  console.log('🔍 Validating critical mobile widths coverage...\n');

  const before = errors.length;
  const testWidths = TEST_VIEWPORTS.filter((v) => v.category === 'mobile').map(
    (v) => v.width
  );

  for (const criticalWidth of CRITICAL_MOBILE_WIDTHS) {
    if (!testWidths.includes(criticalWidth)) {
      // ERROR, not warning (#396). This is a COVERAGE FLOOR: if a critical width
      // stops being tested, every mobile gate silently measures less than it
      // claims to, and nothing else notices. `errorCount > 0` is what sets the
      // exit code, so as a warning this check ran in CI and could not fail —
      // which is the exact pattern #396 catalogues. Measured before the change:
      // pointing CRITICAL_MOBILE_WIDTHS at an uncovered 999px still exited 0.
      errors.push({
        severity: 'error',
        message: `Critical mobile width ${criticalWidth}px is not covered by test viewports`,
      });
    }
  }

  // Only claim success if this check actually found nothing. It used to print the
  // tick unconditionally, so a run that had just recorded an uncovered width still
  // showed "✅ Critical widths coverage validated" in the log directly above the
  // warning it had raised.
  if (errors.length === before) {
    console.log('✅ Critical widths coverage validated\n');
  }
}

/**
 * Print validation summary
 */
function printSummary() {
  console.log('═'.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('═'.repeat(60));
  console.log();

  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;

  if (errors.length === 0) {
    console.log('✅ All breakpoint validations passed!');
    console.log();
    console.log('Breakpoints:');
    for (const bp of BREAKPOINTS) {
      const range = bp.maxWidth
        ? `${bp.minWidth}px - ${bp.maxWidth}px`
        : `${bp.minWidth}px+`;
      console.log(
        `  • ${bp.name.padEnd(4)} (${bp.category.padEnd(7)}): ${range}`
      );
    }
    console.log();
    console.log(`Test Viewports: ${TEST_VIEWPORTS.length}`);
    console.log(
      `  • Mobile: ${TEST_VIEWPORTS.filter((v) => v.category === 'mobile').length}`
    );
    console.log(
      `  • Tablet: ${TEST_VIEWPORTS.filter((v) => v.category === 'tablet').length}`
    );
    console.log(
      `  • Desktop: ${TEST_VIEWPORTS.filter((v) => v.category === 'desktop').length}`
    );
    console.log();
    return 0;
  }

  console.log(`❌ ${errorCount} error(s) found`);
  console.log(`⚠️  ${warningCount} warning(s) found`);
  console.log();

  // Group errors by severity
  const errorList = errors.filter((e) => e.severity === 'error');
  const warningList = errors.filter((e) => e.severity === 'warning');

  if (errorList.length > 0) {
    console.log('ERRORS:');
    errorList.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message}`);
    });
    console.log();
  }

  if (warningList.length > 0) {
    console.log('WARNINGS:');
    warningList.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message}`);
    });
    console.log();
  }

  return errorCount > 0 ? 1 : 0;
}

/**
 * Main validation runner
 */
function main() {
  console.log('═'.repeat(60));
  console.log('BREAKPOINT VALIDATION (PRP-017)');
  console.log('═'.repeat(60));

  validateBreakpointConfig();
  validateCSSSync();
  validateTestViewports();
  validateCriticalWidthsCoverage();

  const exitCode = printSummary();
  process.exit(exitCode);
}

main();
