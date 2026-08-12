import { expect, test, type Locator, type Page } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

const WIDTHS = [390, 500] as const;
const VIEWPORT_HEIGHT = 900;
const BLOG_CONTENT = 'article.blog-post-viewer > article';
const TABLE_SCROLLER = '[data-blog-table-scroll]';

const TABLE_POSTS = [
  {
    slug: 'reject-without-taking-over',
    headers: [
      'Approach',
      "Author's name on it?",
      "Author's agent stays in the loop?",
      'Good for',
    ],
    rowCount: 4,
    quoteCount: 3,
    firstQuote: 'A fixup commit on their branch',
    mustScroll: true,
  },
  {
    slug: 'cursor-github-identity',
    headers: ['Permission', 'Access', 'Why the agent needs it'],
    rowCount: 5,
    quoteCount: 6,
    firstQuote: 'The core idea',
    mustScroll: false,
  },
] as const;

type OverflowMeasurement = {
  document: {
    bodyClientWidth: number;
    bodyScrollWidth: number;
    htmlClientWidth: number;
    htmlScrollWidth: number;
  };
  offenders: string[];
};

/**
 * Find content whose box leaves the viewport without a reachable horizontal
 * scroller. The app shell clips the x axis, so document.scrollWidth alone can
 * stay equal to clientWidth while content is cut off. `hidden` and `clip` are
 * deliberately not excuses: they make the overflowing content unreachable.
 */
async function measureUncontainedOverflow(
  content: Locator,
  viewportWidth: number
): Promise<OverflowMeasurement> {
  return content.evaluate((root, width) => {
    const reachableOverflow = new Set(['auto', 'scroll']);
    const offenders: string[] = [];
    const elements = [root, ...Array.from(root.querySelectorAll('*'))];

    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.left >= -1 && rect.right <= width + 1) continue;

      let hasReachableScroller = false;
      for (
        let ancestor = element.parentElement;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        const overflowX = getComputedStyle(ancestor).overflowX;
        if (
          reachableOverflow.has(overflowX) &&
          ancestor.scrollWidth > ancestor.clientWidth + 1
        ) {
          hasReachableScroller = true;
          break;
        }
        if (ancestor === root) break;
      }

      if (!hasReachableScroller) {
        const className =
          typeof (element as HTMLElement).className === 'string'
            ? (element as HTMLElement).className.slice(0, 60)
            : '';
        offenders.push(
          `${element.tagName}.${className} left=${Math.round(rect.left)} ` +
            `right=${Math.round(rect.right)} width=${Math.round(rect.width)}`
        );
      }
    }

    const html = document.documentElement;
    return {
      offenders,
      document: {
        bodyClientWidth: document.body.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        htmlClientWidth: html.clientWidth,
        htmlScrollWidth: html.scrollWidth,
      },
    };
  }, viewportWidth);
}

async function installClipboardCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const captureWindow = window as typeof window & {
      __blogCopiedText?: string;
    };
    const clipboard = {
      writeText(text: string) {
        captureWindow.__blogCopiedText = text;
        return Promise.resolve();
      },
    };

    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: clipboard,
      });
    } catch {
      // Some engines expose clipboard on Navigator.prototype instead.
      try {
        Object.defineProperty(Object.getPrototypeOf(navigator), 'clipboard', {
          configurable: true,
          get: () => clipboard,
        });
      } catch {
        // The copy assertion below will fail loudly if neither surface can be
        // instrumented; do not skip it based on browser capability.
      }
    }
  });
}

async function openPost(page: Page, slug: string): Promise<Locator> {
  await page.goto(`/blog/${slug}`, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  const content = page.locator(BLOG_CONTENT);
  await expect(content).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.scrollPaddingTop)
    )
    .toBe('90px');
  return content;
}

async function assertTableAndQuoteRendering(
  page: Page,
  viewportWidth: number,
  fixture: (typeof TABLE_POSTS)[number]
): Promise<Locator> {
  const content = await openPost(page, fixture.slug);
  const scroller = content.locator(TABLE_SCROLLER);
  await expect(scroller).toHaveCount(1);
  await expect(scroller).toHaveAttribute('tabindex', '0');

  const table = scroller.getByRole('table');
  await expect(table).toHaveCount(1);
  await expect(table.getByRole('columnheader')).toHaveText([
    ...fixture.headers,
  ]);
  await expect(table.getByRole('row')).toHaveCount(fixture.rowCount);

  const quotes = content.locator('blockquote');
  await expect(quotes).toHaveCount(fixture.quoteCount);
  await expect(quotes.first()).toContainText(fixture.firstQuote);
  await expect(quotes.first().locator('strong').first()).toBeVisible();

  const layout = await scroller.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const tableElement = element.querySelector('table');
    return {
      clientWidth: element.clientWidth,
      left: rect.left,
      overflowX: getComputedStyle(element).overflowX,
      right: rect.right,
      scrollWidth: element.scrollWidth,
      tableOverflowX: tableElement
        ? getComputedStyle(tableElement).overflowX
        : null,
    };
  });

  expect(
    ['auto', 'scroll'],
    `${fixture.slug}: table wrapper must expose overflow`
  ).toContain(layout.overflowX);
  expect(
    ['auto', 'scroll'],
    `${fixture.slug}: the wrapper, not the semantic table, owns scrolling`
  ).not.toContain(layout.tableOverflowX);
  expect(
    layout.left,
    `${fixture.slug}: table wrapper crosses left edge`
  ).toBeGreaterThanOrEqual(-1);
  expect(
    layout.right,
    `${fixture.slug}: table wrapper crosses right edge at ${viewportWidth}px`
  ).toBeLessThanOrEqual(viewportWidth + 1);

  if (fixture.mustScroll) {
    expect(
      layout.scrollWidth,
      `${fixture.slug}: wide table has no reachable scroll range at ${viewportWidth}px`
    ).toBeGreaterThan(layout.clientWidth + 1);

    await scroller.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await scroller.focus();
    await expect(scroller).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
  }

  const overflow = await measureUncontainedOverflow(content, viewportWidth);
  expect(
    overflow.offenders,
    `${fixture.slug} has clipped or page-level overflow at ${viewportWidth}px:\n` +
      overflow.offenders.join('\n')
  ).toEqual([]);

  // Secondary signals only. The geometry assertion above remains load-bearing
  // because the app shell currently clips the document's x axis.
  expect(overflow.document.bodyScrollWidth).toBeLessThanOrEqual(
    overflow.document.bodyClientWidth + 1
  );
  expect(overflow.document.htmlScrollWidth).toBeLessThanOrEqual(
    overflow.document.htmlClientWidth + 1
  );

  return content;
}

async function assertExistingBlogBehaviors(
  page: Page,
  content: Locator
): Promise<void> {
  const viewer = page.locator('article.blog-post-viewer');

  // The page template owns the only h1. A body h1 is conditionally demoted, as
  // are its child headings, without changing the established slug algorithm.
  await expect(viewer.locator('h1')).toHaveCount(1);
  await expect(
    content.getByRole('heading', {
      level: 2,
      name: /A Token Is an Identity: Let Cursor Commit as Themselves/,
    })
  ).toBeVisible();
  const anchoredHeading = content.locator(
    'h3#fine-grained-tokens-and-least-privilege'
  );
  await expect(anchoredHeading).toContainText(
    'Fine-Grained Tokens and Least Privilege'
  );

  const tocDetails = viewer
    .locator('details')
    .filter({ hasText: 'TOC' })
    .first();
  const tocSummary = tocDetails.locator('summary');
  await expect(tocSummary).toBeVisible();
  await tocSummary.click();

  const tocLink = tocDetails.locator(
    'a[href="#fine-grained-tokens-and-least-privilege"]'
  );
  await expect(tocLink).toBeVisible();
  await tocLink.click();
  await expect
    .poll(() =>
      tocLink.evaluate((element) => {
        const weight = getComputedStyle(element).fontWeight;
        return weight === 'bold' ? 700 : Number.parseInt(weight, 10);
      })
    )
    .toBeGreaterThanOrEqual(700);

  const externalLink = content
    .getByRole('link', { name: 'Cursor', exact: true })
    .first();
  await expect(externalLink).toHaveAttribute('href', 'https://cursor.com/');
  await expect(externalLink).toHaveAttribute('target', '_blank');
  await expect(externalLink).toHaveAttribute('rel', /\bnoopener\b/);
  await expect(externalLink).toHaveAttribute('rel', /\bnoreferrer\b/);

  const firstCodePanel = content.locator('.mockup-code').first();
  const bashCode = firstCodePanel.locator('code.language-bash');
  await expect(bashCode).toContainText('gh auth status');
  await expect(bashCode.locator('.token.comment').first()).toBeVisible();

  const copyButton = firstCodePanel.getByRole('button', {
    name: 'Copy code',
  });
  await expect(copyButton).toHaveAttribute('title', 'Copy code');
  await copyButton.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __blogCopiedText?: string })
            .__blogCopiedText ?? ''
      )
    )
    .toContain('gh auth status');
}

async function assertSafeAuthoredHtml(page: Page): Promise<void> {
  const content = await openPost(page, 'countdown-timer-tutorial');
  const details = content
    .locator('details')
    .filter({ hasText: 'CLI Arguments for Automation' });
  await expect(details).toHaveCount(1);

  const summary = details.locator('summary');
  await expect(summary).toContainText('CLI Arguments for Automation');
  await summary.click();
  await expect
    .poll(() =>
      details.evaluate((element) => (element as HTMLDetailsElement).open)
    )
    .toBe(true);
  await expect(
    details.locator('strong').filter({
      hasText: 'For scripting and automation:',
    })
  ).toHaveCount(1);
  await expect(
    details.locator('.mockup-code code.language-bash')
  ).toContainText('--name CountdownBanner');
}

test.describe('Blog markdown rendering', () => {
  for (const width of WIDTHS) {
    test(`${width}px preserves semantic rich content and existing behavior`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await installClipboardCapture(page);

      for (const fixture of TABLE_POSTS) {
        await test.step(`${fixture.slug}: tables, quotes, and overflow`, async () => {
          await assertTableAndQuoteRendering(page, width, fixture);
        });
      }

      // cursor-github-identity is intentionally the final table fixture so the
      // compatibility checks can continue against the page already in view.
      const compatibilityContent = page.locator(BLOG_CONTENT);
      await expect(compatibilityContent).toBeVisible();
      await test.step('anchors, TOC, external links, Prism, and copy', async () => {
        await assertExistingBlogBehaviors(page, compatibilityContent);
      });
      await test.step('safe authored HTML remains interactive', async () => {
        await assertSafeAuthoredHtml(page);
      });
    });
  }
});
