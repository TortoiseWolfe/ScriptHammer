#!/usr/bin/env node
/**
 * Phase 4 Visual Audit — Screenshots all atomic component stories in both custom themes.
 *
 * Usage:
 *   # 1. Build storybook (if not already built)
 *   docker compose exec scripthammer npx storybook build -o /tmp/storybook-static
 *
 *   # 2. Start static server in background
 *   docker compose exec -d scripthammer npx http-server /tmp/storybook-static -p 9009 -s
 *
 *   # 3. Run the audit
 *   docker compose exec scripthammer node scripts/theme-audit.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { get } from 'http';

const STORYBOOK_DIR = '/tmp/storybook-static';
const OUTPUT_DIR = '/tmp/theme-audit';
const THEMES = ['scripthammer-dark', 'scripthammer-light'];
const PORT = 9009;
const BASE_URL = `http://localhost:${PORT}`;

function getStoryIds() {
  const indexPath = join(STORYBOOK_DIR, 'index.json');
  const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  return Object.values(index.entries || index.stories || {})
    .filter(s => s.type === 'story')
    .map(s => ({ id: s.id, title: s.title, name: s.name }));
}

function checkServer() {
  return new Promise((resolve) => {
    get(`${BASE_URL}/index.json`, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function main() {
  // Verify server is running
  const serverReady = await checkServer();
  if (!serverReady) {
    console.error(`Server not running on port ${PORT}. Start it first:`);
    console.error(`  docker compose exec -d scripthammer npx http-server /tmp/storybook-static -p ${PORT} -s`);
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const stories = getStoryIds();
  const atomicStories = stories.filter(s => s.title.includes('/Atomic/'));
  const total = atomicStories.length * THEMES.length;
  console.log(`Auditing ${atomicStories.length} atomic stories × ${THEMES.length} themes = ${total} screenshots`);

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const issues = [];
  let successCount = 0;

  for (const theme of THEMES) {
    const themeDir = join(OUTPUT_DIR, theme);
    mkdirSync(themeDir, { recursive: true });

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    for (const story of atomicStories) {
      const url = `${BASE_URL}/iframe.html?id=${story.id}&viewMode=story`;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.waitForTimeout(300);

        // innerText returns only visible text (textContent includes hidden fallback elements)
        const hasNoPreview = await page.evaluate(() =>
          document.body.innerText?.includes('No Preview') ?? false
        );

        const filename = `${story.title.replace(/\//g, '--')}--${story.name}.png`;
        await page.screenshot({ path: join(themeDir, filename), fullPage: true });

        if (hasNoPreview) {
          issues.push({ theme, story: story.id, error: 'No Preview rendered' });
          console.log(`  ? ${theme} | ${story.title} > ${story.name} — No Preview`);
        } else {
          const a11yIssues = await page.evaluate(() => {
            const problems = [];
            document.querySelectorAll('button, a, span, p, h1, h2, h3, label').forEach(el => {
              const style = window.getComputedStyle(el);
              const color = style.color;
              const bg = style.backgroundColor;
              if (color === bg && color !== 'rgba(0, 0, 0, 0)') {
                problems.push({ tag: el.tagName, text: el.textContent?.slice(0, 30), color, bg });
              }
            });
            return problems;
          });

          if (a11yIssues.length > 0) {
            issues.push({ theme, story: story.id, issues: a11yIssues });
          }
          successCount++;
          console.log(`  ✓ ${theme} | ${story.title} > ${story.name}`);
        }
      } catch (err) {
        console.log(`  ✗ ${theme} | ${story.title} > ${story.name} — ${err.message}`);
        issues.push({ theme, story: story.id, error: err.message });
      }
    }
    await context.close();
  }

  await browser.close();

  // Summary
  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Screenshots: ${OUTPUT_DIR}/`);
  console.log(`Rendered: ${successCount}/${total}`);
  console.log(`Issues: ${issues.length}`);

  if (issues.length > 0) {
    console.log('\nISSUES:');
    issues.forEach(i => console.log(` - ${i.theme} | ${i.story}: ${JSON.stringify(i.issues || i.error)}`));
  }

  const report = {
    date: new Date().toISOString(),
    themes: THEMES,
    storiesAudited: atomicStories.length,
    totalScreenshots: total,
    successfulRenders: successCount,
    issues,
  };
  writeFileSync(join(OUTPUT_DIR, 'audit-report.json'), JSON.stringify(report, null, 2));
  console.log(`\nReport: ${OUTPUT_DIR}/audit-report.json`);

  for (const theme of THEMES) {
    const dir = join(OUTPUT_DIR, theme);
    const files = readdirSync(dir);
    console.log(`\n${theme}/ (${files.length} screenshots):`);
    files.forEach(f => console.log(`  ${f}`));
  }
}

main().catch(console.error);
