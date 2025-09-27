import { test, expect, Page } from '@playwright/test';

interface BrokenLink {
  sourceUrl: string;
  targetUrl: string;
  statusCode?: number;
  error?: string;
  linkText?: string;
}

test.describe('Broken Links Detection', () => {
  const visitedUrls = new Set<string>();
  const brokenLinks: BrokenLink[] = [];
  const externalLinksToCheck = new Map<string, Set<string>>();
  let baseUrl: string;

  test.beforeAll(async () => {
    // Reset tracking for each test run
    visitedUrls.clear();
    brokenLinks.length = 0;
    externalLinksToCheck.clear();
  });

  test.afterAll(async () => {
    // Report all broken links found
    if (brokenLinks.length > 0) {
      console.log('\n🔴 BROKEN LINKS FOUND:');
      console.log('='.repeat(80));

      // Group by source page
      const linksBySource = new Map<string, BrokenLink[]>();
      for (const link of brokenLinks) {
        const links = linksBySource.get(link.sourceUrl) || [];
        links.push(link);
        linksBySource.set(link.sourceUrl, links);
      }

      // Print organized report
      for (const [source, links] of linksBySource) {
        console.log(`\n📄 Source: ${source}`);
        for (const link of links) {
          console.log(`   ❌ ${link.targetUrl}`);
          if (link.statusCode) {
            console.log(`      Status: ${link.statusCode}`);
          }
          if (link.error) {
            console.log(`      Error: ${link.error}`);
          }
          if (link.linkText) {
            console.log(`      Text: "${link.linkText}"`);
          }
        }
      }

      console.log('\n' + '='.repeat(80));
      console.log(`Total broken links: ${brokenLinks.length}`);
    } else {
      console.log('\n✅ No broken links found!');
    }

    // Report external links that need checking
    if (externalLinksToCheck.size > 0) {
      console.log('\n📤 External links found (need manual verification):');
      for (const [url, sources] of externalLinksToCheck) {
        console.log(`\n   ${url}`);
        console.log(`   Found on: ${Array.from(sources).join(', ')}`);
      }
    }
  });

  async function extractLinks(
    page: Page
  ): Promise<Array<{ href: string; text: string }>> {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links.map((link) => ({
        href: (link as HTMLAnchorElement).href,
        text: (link as HTMLAnchorElement).textContent?.trim() || '',
      }));
    });
  }

  async function normalizeUrl(
    url: string,
    currentPageUrl: string
  ): Promise<string> {
    // Handle relative URLs
    if (!url.startsWith('http')) {
      const base = new URL(currentPageUrl);
      return new URL(url, base.origin).href;
    }
    return url;
  }

  async function isInternalLink(url: string): Promise<boolean> {
    const testUrl = new URL(url);
    const base = new URL(baseUrl);

    // Check if same origin
    if (testUrl.origin !== base.origin) {
      return false;
    }

    // For GitHub Pages, also check if path starts with base path
    const basePath = process.env.BASE_PATH || '';
    if (basePath && !testUrl.pathname.startsWith(basePath)) {
      return false;
    }

    return true;
  }

  async function checkInternalLink(
    page: Page,
    sourceUrl: string,
    targetUrl: string,
    linkText: string
  ): Promise<void> {
    // Skip if already visited
    if (visitedUrls.has(targetUrl)) {
      return;
    }

    // Skip hash-only links
    const sourceUrlObj = new URL(sourceUrl);
    const targetUrlObj = new URL(targetUrl);
    if (
      sourceUrlObj.pathname === targetUrlObj.pathname &&
      sourceUrlObj.search === targetUrlObj.search &&
      targetUrlObj.hash
    ) {
      return;
    }

    visitedUrls.add(targetUrl);

    try {
      // Navigate to the target URL
      const response = await page.goto(targetUrl, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      if (!response) {
        brokenLinks.push({
          sourceUrl,
          targetUrl,
          error: 'No response received',
          linkText,
        });
        return;
      }

      const status = response.status();

      // Check for 404 or other error status codes
      if (status >= 400) {
        brokenLinks.push({
          sourceUrl,
          targetUrl,
          statusCode: status,
          linkText,
        });
        return;
      }

      // Check if we got redirected to a 404 page
      const pageTitle = await page.title();

      // Check for h1 heading to be more specific
      const h1Text = await page.textContent('h1').catch(() => null);

      // More specific 404 detection - check title and main heading
      const is404Page =
        pageTitle.toLowerCase() === '404' ||
        pageTitle.toLowerCase() === 'not found' ||
        pageTitle.toLowerCase() === '404 - page not found' ||
        h1Text?.toLowerCase() === '404' ||
        h1Text?.toLowerCase() === 'page not found';

      if (is404Page) {
        brokenLinks.push({
          sourceUrl,
          targetUrl,
          statusCode: 404,
          error: 'Redirected to 404 page',
          linkText,
        });
        return;
      }

      // If successful, crawl this page for more links
      await crawlPage(page, targetUrl);
    } catch (error) {
      brokenLinks.push({
        sourceUrl,
        targetUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        linkText,
      });
    }
  }

  async function crawlPage(page: Page, currentUrl: string): Promise<void> {
    try {
      const links = await extractLinks(page);

      for (const link of links) {
        const normalizedUrl = await normalizeUrl(link.href, currentUrl);

        if (await isInternalLink(normalizedUrl)) {
          await checkInternalLink(page, currentUrl, normalizedUrl, link.text);
        } else if (normalizedUrl.startsWith('http')) {
          // Track external links for reporting
          const sources = externalLinksToCheck.get(normalizedUrl) || new Set();
          sources.add(currentUrl);
          externalLinksToCheck.set(normalizedUrl, sources);
        }
      }
    } catch (error) {
      console.error(`Error crawling page ${currentUrl}:`, error);
    }
  }

  test('check all internal links for 404s', async ({ page, baseURL }) => {
    baseUrl = baseURL || 'http://localhost:3000';

    // Start from homepage
    const response = await page.goto('/', {
      waitUntil: 'networkidle',
    });

    expect(response).toBeTruthy();
    expect(response?.status()).toBeLessThan(400);

    // Start crawling from homepage
    await crawlPage(page, baseUrl);

    // Also check specific important pages that might not be linked
    const importantPages = [
      '/blog',
      '/components',
      '/themes',
      '/status',
      '/accessibility',
      '/contact',
      '/privacy',
      '/cookies',
      '/privacy-controls',
    ];

    for (const pagePath of importantPages) {
      const url = new URL(pagePath, baseUrl).href;
      if (!visitedUrls.has(url)) {
        await checkInternalLink(
          page,
          baseUrl,
          url,
          `Direct check: ${pagePath}`
        );
      }
    }

    // Assert no broken links were found
    expect(brokenLinks).toEqual([]);
  });

  test('check meta tag images and resources', async ({ page, baseURL }) => {
    baseUrl = baseURL || 'http://localhost:3000';
    const pagesToCheck = ['/', '/blog', '/blog/spec-kit-workflow'];
    const brokenResources: BrokenLink[] = [];

    for (const pagePath of pagesToCheck) {
      await page.goto(pagePath);

      // Check Open Graph images
      const ogImage = await page
        .$eval('meta[property="og:image"]', (el) => el.getAttribute('content'))
        .catch(() => null);

      if (ogImage) {
        const imageUrl = await normalizeUrl(ogImage, page.url());
        const imageResponse = await page.request
          .get(imageUrl)
          .catch(() => null);

        if (!imageResponse || imageResponse.status() >= 400) {
          brokenResources.push({
            sourceUrl: page.url(),
            targetUrl: imageUrl,
            statusCode: imageResponse?.status(),
            error: 'Open Graph image not found',
          });
        }
      }

      // Check Twitter card images
      const twitterImage = await page
        .$eval('meta[name="twitter:image"]', (el) => el.getAttribute('content'))
        .catch(() => null);

      if (twitterImage) {
        const imageUrl = await normalizeUrl(twitterImage, page.url());
        const imageResponse = await page.request
          .get(imageUrl)
          .catch(() => null);

        if (!imageResponse || imageResponse.status() >= 400) {
          brokenResources.push({
            sourceUrl: page.url(),
            targetUrl: imageUrl,
            statusCode: imageResponse?.status(),
            error: 'Twitter card image not found',
          });
        }
      }

      // Check favicon
      const favicon = await page
        .$eval('link[rel="icon"], link[rel="shortcut icon"]', (el) =>
          el.getAttribute('href')
        )
        .catch(() => null);

      if (favicon) {
        const iconUrl = await normalizeUrl(favicon, page.url());
        const iconResponse = await page.request.get(iconUrl).catch(() => null);

        if (!iconResponse || iconResponse.status() >= 400) {
          brokenResources.push({
            sourceUrl: page.url(),
            targetUrl: iconUrl,
            statusCode: iconResponse?.status(),
            error: 'Favicon not found',
          });
        }
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

    console.log(`\n📋 Checking ${sitemapUrls.length} URLs from sitemap...`);

    const brokenSitemapUrls: BrokenLink[] = [];

    for (const url of sitemapUrls) {
      try {
        const response = await page.goto(url, {
          waitUntil: 'networkidle',
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
        brokenSitemapUrls.push({
          sourceUrl: sitemapUrl,
          targetUrl: url,
          error: error instanceof Error ? error.message : 'Failed to load',
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
      { path: '/privacy', description: 'Privacy policy' },
      { path: '/cookies', description: 'Cookie policy' },
    ];

    const results: Array<{ path: string; status: string; code?: number }> = [];

    for (const link of knownProblematicLinks) {
      try {
        const response = await page.goto(link.path, {
          waitUntil: 'networkidle',
          timeout: 10000,
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
        results.push({
          path: link.path,
          status: error instanceof Error ? error.message : 'Failed',
        });
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
