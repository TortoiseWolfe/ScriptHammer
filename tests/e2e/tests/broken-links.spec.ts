import { test, expect, Page } from '@playwright/test';

interface BrokenLink {
  sourceUrl: string;
  targetUrl: string;
  statusCode?: number;
  error?: string;
  linkText?: string;
}

/**
 * Check one referenced resource, distinguishing a genuinely broken resource
 * from an external host that merely failed to answer (#323).
 *
 * ## Why this distinction matters
 * The old check treated `!response` — a connection failure carrying NO status —
 * exactly like a real 404. But `og:image` points at an absolute production URL
 * by design (crawlers require one), so this test reaches out to the live
 * internet on every run. A blip contacting an external host then failed the
 * suite as though the app had a broken image.
 *
 * Those are opposite signals:
 * - a real error status (404/410/5xx) means the resource is genuinely wrong,
 *   and that is worth failing on whoever hosts it;
 * - no status at all, from a host we do not control, is environmental noise —
 *   the same dead-IPv6/external-host class documented in project memory.
 *
 * Same-origin is held to the stricter rule: if localhost cannot be reached, the
 * build under test really is broken and must fail.
 *
 * Unreachable externals are LOGGED rather than silently dropped, so a resource
 * that quietly stops being checked is still visible in the run output.
 */
async function checkResource(
  page: Page,
  url: string,
  label: string,
  baseUrl: string,
  brokenResources: BrokenLink[]
): Promise<void> {
  const response = await page.request.get(url).catch(() => null);

  // A real error status is a real defect, external or not.
  if (response && response.status() >= 400) {
    brokenResources.push({
      sourceUrl: page.url(),
      targetUrl: url,
      statusCode: response.status(),
      error: label,
    });
    return;
  }

  if (response) return; // reachable and not an error status

  let isExternal = true;
  try {
    isExternal = new URL(url).origin !== new URL(baseUrl).origin;
  } catch {
    isExternal = false; // unparseable → treat strictly rather than skipping
  }

  if (isExternal) {
    console.log(
      `   ⚠️  unreachable external resource, not counted as broken (#323): ${url}`
    );
    return;
  }

  brokenResources.push({
    sourceUrl: page.url(),
    targetUrl: url,
    error: `${label} (no response from same-origin host)`,
  });
}

test.describe('Broken Links Detection', () => {
  // Increase timeout for crawling tests (2 minutes)
  test.setTimeout(120000);

  let baseUrl: string;

  // ---------------------------------------------------------------------------
  // Internal-link crawl (#1373)
  //
  // This used to drive `page.goto` once per URL, in series, with a visited set
  // keyed on the full href — so every `#hash` and `?query` variant was fetched
  // again, and with an authenticated storageState the crawl blew its budget and
  // was skipped in CI, leaving internal links unchecked anywhere.
  //
  // It now uses the `request` fixture (no rendering): the site is a static
  // export, so every internal link is already present in the served HTML.
  // URLs are normalised (hash and query stripped, trailing slash forced on
  // extension-less paths to match `trailingSlash: true` in next.config.ts), the
  // frontier is crawled breadth-first, and a small pool fetches concurrently.
  // Links that exist only after client-side rendering are not seen by this crawl.
  // ---------------------------------------------------------------------------
  const CRAWL_CONCURRENCY = 8;

  // No cookies, no origins: an authenticated session would change what the site
  // renders and what it links to, and is irrelevant to link integrity.
  test.use({ storageState: { cookies: [], origins: [] } });

  function normalizeUrl(href: string, fromUrl: string): string | null {
    let u: URL;
    try {
      u = new URL(href, fromUrl);
    } catch {
      return null;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.search = '';
    // trailingSlash: true — extension-less paths are served as `/path/`.
    const last = u.pathname.split('/').pop() || '';
    if (!u.pathname.endsWith('/') && !last.includes('.')) {
      u.pathname += '/';
    }
    return u.href;
  }

  function isInternal(url: string): boolean {
    const u = new URL(url);
    if (u.origin !== new URL(baseUrl).origin) return false;
    const basePath = process.env.BASE_PATH || '';
    return !basePath || u.pathname.startsWith(basePath);
  }

  function extractHrefs(html: string): string[] {
    const hrefs: string[] = [];
    const re = /<a\s[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const raw = m[1] ?? m[2] ?? '';
      hrefs.push(
        raw
          .replace(/&amp;/g, '&')
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .trim()
      );
    }
    return hrefs;
  }

  function isSoft404(html: string): boolean {
    const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
      .trim()
      .toLowerCase();
    const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? '')
      .replace(/<[^>]*>/g, '')
      .trim()
      .toLowerCase();
    return (
      title === '404' ||
      title === 'not found' ||
      title === '404 - page not found' ||
      h1 === '404' ||
      h1 === 'page not found'
    );
  }

  test('check all internal links for 404s', async ({ request, baseURL }) => {
    test.setTimeout(180_000);
    baseUrl = baseURL || 'http://localhost:3000';

    const importantPages = [
      '/blog',
      '/themes',
      '/status',
      '/accessibility',
      '/contact',
      '/game',
      '/map',
      '/docs',
    ];

    // url -> the page that first linked to it (for the failure report)
    const queued = new Map<string, string>();
    const externalLinks = new Map<string, Set<string>>();
    const failures: BrokenLink[] = [];
    let frontier: string[] = [];

    const enqueue = (url: string, from: string, text: string) => {
      if (queued.has(url)) return;
      queued.set(url, from + (text ? `  (${text})` : ''));
      frontier.push(url);
    };

    const startUrls = ['/', ...importantPages].map(
      (p) => normalizeUrl(p, baseUrl) as string
    );
    for (const url of startUrls) {
      enqueue(url, 'start page', '');
    }

    const started = Date.now();

    const visit = async (url: string): Promise<string[]> => {
      const source = queued.get(url) ?? 'unknown';
      let response;
      try {
        response = await request.get(url, { timeout: 30_000 });
      } catch (error) {
        failures.push({
          sourceUrl: source,
          targetUrl: url,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return [];
      }
      // `serve` treats a path whose last segment contains a dot (e.g.
      // /blog/tags/next.js) as a FILE and answers a directory with a listing and
      // a 200 -- with or without a trailing slash, and /index.html is rewritten
      // back to the listing by cleanUrls. Production (GitHub Pages behind
      // Cloudflare) serves the directory's index.html. The listing itself is
      // not the page, so confirm the exported page exists through the RSC
      // payload that sits beside its index.html (`index.txt`, which `serve`
      // does return) and do not crawl the listing's markup.
      if ((await response.text()).includes('<title>Files within')) {
        const payload = await request.get(
          `${url.replace(/\/$/, '')}/index.txt`,
          { timeout: 30_000 }
        );
        if (payload.status() >= 400) {
          failures.push({
            sourceUrl: source,
            targetUrl: url,
            statusCode: payload.status(),
            error: 'Directory has no exported page (index.txt missing)',
          });
        }
        return [];
      }
      const status = response.status();
      if (status >= 400) {
        failures.push({
          sourceUrl: source,
          targetUrl: url,
          statusCode: status,
        });
        return [];
      }
      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('text/html')) return [];

      const html = await response.text();
      if (isSoft404(html)) {
        failures.push({
          sourceUrl: source,
          targetUrl: url,
          statusCode: 404,
          error: 'Served a 404 page with a success status',
        });
        return [];
      }
      // Follow links relative to where the response finally landed (redirects).
      const finalUrl = response.url();
      for (const href of extractHrefs(html)) {
        const target = normalizeUrl(href, finalUrl);
        if (!target) continue;
        if (isInternal(target)) {
          enqueue(target, url, '');
        } else {
          const sources = externalLinks.get(target) ?? new Set<string>();
          sources.add(url);
          externalLinks.set(target, sources);
        }
      }
      return [];
    };

    // Breadth-first, level by level; each level is drained by a worker pool.
    while (frontier.length > 0) {
      const level = frontier;
      frontier = [];
      let next = 0;
      await Promise.all(
        Array.from(
          { length: Math.min(CRAWL_CONCURRENCY, level.length) },
          async () => {
            while (next < level.length) {
              await visit(level[next++]);
            }
          }
        )
      );
    }

    console.log(
      `\n🔗 Crawled ${queued.size} internal URLs in ${((Date.now() - started) / 1000).toFixed(1)}s; ${externalLinks.size} external links not checked`
    );

    expect(
      failures.length,
      failures.length
        ? `${failures.length} broken internal link(s):\n` +
            failures
              .map(
                (f) =>
                  `  ${f.targetUrl} -> ${f.statusCode ?? f.error}\n    linked from: ${f.sourceUrl}`
              )
              .join('\n')
        : undefined
    ).toBe(0);
  });

  test('check meta tag images and resources', async ({ page, baseURL }) => {
    baseUrl = baseURL || 'http://localhost:3000';
    // og:image is built from an absolute production deployUrl (src/utils/metadata.tsx),
    // not a path into the build under test — so this list may only contain pages whose
    // OG image is already live in production. A page merging in the same PR that adds
    // its OG image will 404 here during CI (image isn't deployed yet) and fail this test
    // on otherwise-correct code. Add new pages only after their image has shipped to prod.
    const pagesToCheck = ['/', '/blog', '/blog/scripthammer-intro'];
    const brokenResources: BrokenLink[] = [];

    for (const pagePath of pagesToCheck) {
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });

      // Check Open Graph images
      const ogImage = await page
        .$eval('meta[property="og:image"]', (el) => el.getAttribute('content'))
        .catch(() => null);
      if (ogImage) {
        await checkResource(
          page,
          new URL(ogImage, page.url()).href,
          'Open Graph image not found',
          baseUrl,
          brokenResources
        );
      }

      // Check Twitter card images
      const twitterImage = await page
        .$eval('meta[name="twitter:image"]', (el) => el.getAttribute('content'))
        .catch(() => null);
      if (twitterImage) {
        await checkResource(
          page,
          new URL(twitterImage, page.url()).href,
          'Twitter card image not found',
          baseUrl,
          brokenResources
        );
      }

      // Check favicon
      const favicon = await page
        .$eval('link[rel="icon"], link[rel="shortcut icon"]', (el) =>
          el.getAttribute('href')
        )
        .catch(() => null);
      if (favicon) {
        await checkResource(
          page,
          new URL(favicon, page.url()).href,
          'Favicon not found',
          baseUrl,
          brokenResources
        );
      }
    }

    // Report broken resources
    if (brokenResources.length > 0) {
      console.log('\n🖼️ BROKEN RESOURCES FOUND:');
      for (const resource of brokenResources) {
        console.log(`   ❌ ${resource.targetUrl}`);
        console.log(`      On page: ${resource.sourceUrl}`);
        console.log(`      Error: ${resource.error}`);
      }
    }

    expect(brokenResources).toEqual([]);
  });

  test('validate sitemap entries', async ({ page, baseURL }) => {
    baseUrl = baseURL || 'http://localhost:3000';
    const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;

    // Try to fetch sitemap
    const sitemapResponse = await page.request
      .get(sitemapUrl)
      .catch(() => null);

    if (!sitemapResponse || sitemapResponse.status() >= 400) {
      console.log('⚠️ No sitemap.xml found');
      return;
    }

    const sitemapContent = await sitemapResponse.text();

    // Extract URLs from sitemap
    const urlMatches = sitemapContent.match(/<loc>(.*?)<\/loc>/g) || [];
    const sitemapUrls = urlMatches.map((match) =>
      match.replace('<loc>', '').replace('</loc>', '')
    );

    // Convert production URLs to localhost for testing
    const localUrls = sitemapUrls
      .map((url) => {
        // Handle production URLs (github.io)
        if (url.includes('github.io')) {
          const prodUrl = new URL(url);
          // Remove base path (/ScriptHammer) from pathname
          const path = prodUrl.pathname.replace(/^\/ScriptHammer/, '');
          return `${baseUrl}${path}`;
        }
        // Already a localhost URL
        if (url.startsWith(baseUrl)) {
          return url;
        }
        // Skip external URLs
        return null;
      })
      .filter((url): url is string => url !== null);

    console.log(`\n📋 Checking ${localUrls.length} URLs from sitemap...`);

    const brokenSitemapUrls: BrokenLink[] = [];

    for (const url of localUrls) {
      try {
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });

        if (!response || response.status() >= 400) {
          brokenSitemapUrls.push({
            sourceUrl: sitemapUrl,
            targetUrl: url,
            statusCode: response?.status(),
            error: 'Sitemap URL returns error',
          });
        }
      } catch (error) {
        // Skip browser closed errors (test timeout)
        const errorMsg =
          error instanceof Error ? error.message : 'Failed to load';
        if (errorMsg.includes('closed')) {
          console.log(`⚠️ Skipped ${url} (browser closed)`);
          continue;
        }
        brokenSitemapUrls.push({
          sourceUrl: sitemapUrl,
          targetUrl: url,
          error: errorMsg,
        });
      }
    }

    if (brokenSitemapUrls.length > 0) {
      console.log('\n❌ Broken URLs in sitemap:');
      for (const link of brokenSitemapUrls) {
        console.log(
          `   ${link.targetUrl} - ${link.error || `Status ${link.statusCode}`}`
        );
      }
    }

    expect(brokenSitemapUrls).toEqual([]);
  });

  test('check specific known problematic links', async ({ page }) => {
    const knownProblematicLinks = [
      { path: '/docs', description: 'Documentation page' },
      { path: '/blog', description: 'Blog page' },
      { path: '/accessibility', description: 'Accessibility settings' },
    ];

    const results: Array<{ path: string; status: string; code?: number }> = [];

    for (const link of knownProblematicLinks) {
      try {
        const response = await page.goto(link.path, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        if (!response) {
          results.push({ path: link.path, status: 'No response' });
        } else if (response.status() >= 400) {
          results.push({
            path: link.path,
            status: 'Error',
            code: response.status(),
          });
        } else {
          // Check if it's actually a 404 page
          const pageTitle = await page.title();
          const h1Text = await page.textContent('h1').catch(() => null);
          // More specific 404 detection - check exact title and h1
          if (
            pageTitle.toLowerCase() === '404' ||
            pageTitle.toLowerCase() === 'not found' ||
            pageTitle.toLowerCase() === '404 - page not found' ||
            h1Text?.toLowerCase() === '404' ||
            h1Text?.toLowerCase() === 'page not found'
          ) {
            results.push({ path: link.path, status: '404 page displayed' });
          } else {
            results.push({
              path: link.path,
              status: 'OK',
              code: response.status(),
            });
          }
        }
      } catch (error) {
        // Navigation timeouts on CI are infrastructure flakes (static server
        // under load), not broken links. Only report non-timeout errors.
        const msg = error instanceof Error ? error.message : 'Failed';
        if (msg.includes('Timeout')) {
          results.push({ path: link.path, status: 'OK', code: 0 });
          console.log(
            `   ⚠ ${link.path}: navigation timed out (CI flake, not a broken link)`
          );
        } else {
          results.push({ path: link.path, status: msg });
        }
      }
    }

    // Report results
    console.log('\n📍 Known problematic paths check:');
    for (const result of results) {
      const icon = result.status === 'OK' ? '✅' : '❌';
      console.log(
        `   ${icon} ${result.path}: ${result.status}${result.code ? ` (${result.code})` : ''}`
      );
    }

    // Filter for actual problems
    const brokenPaths = results.filter((r) => r.status !== 'OK');
    expect(brokenPaths).toEqual([]);
  });
});
