import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import { rehype } from 'rehype';
import rehypeSlug from 'rehype-slug';
import { DOCS } from '@/lib/docs/registry';
import { getInternalUrl, projectConfig } from '@/config/project.config';

/**
 * Markdown → HTML for `/docs` (#380).
 *
 * NOT `src/lib/blog/markdown-processor.ts`. That used to be a hand-rolled regex
 * processor that rendered neither tables nor blockquotes; it now delegates to
 * `src/lib/blog/render.ts` (remark-gfm → rehype-sanitize, #1265), but it is
 * shaped for BLOG posts — heading nonces, a sanitizer schema, Prism classes —
 * and the seven documents behind this route are trusted repo files that want
 * plain GFM with their **194 table rows** intact.
 *
 * `remark-gfm` supplies tables. The whole unified stack was already a direct
 * dependency of this repo with no importer, so this adds no package — only a
 * first consumer.
 *
 * Two passes, because the markdown→rehype bridge (`remark-rehype`) is NOT a
 * declared dependency here. Importing it, or `rehype-parse` directly, would
 * reach into pnpm's strict node_modules for something this package.json does
 * not own — the same trap `color-contrast.spec.ts` documents for `axe-core`.
 * The `rehype` preset bundles its own parser and stringifier, so:
 *
 *   1. remark: markdown → HTML (with GFM tables)
 *   2. rehype: HTML → HTML, adding stable heading ids
 *
 * Both run at BUILD time inside a server component on a static export, so
 * neither remark, rehype nor the raw markdown reaches the browser. The
 * first-load budget gate (#291) is untouched.
 */
const toHtml = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // These documents are OURS, checked into the repo, and several use inline
  // HTML (<details>, <img>). This is not user input — nothing here is
  // reachable by anyone who cannot already open a pull request.
  .use(remarkHtml, { sanitize: false });

export interface RenderedDoc {
  html: string;
  headings: { id: string; text: string; level: number }[];
}

/** Read a repo-relative markdown file and render it. */
export async function renderDoc(file: string): Promise<RenderedDoc> {
  const raw = await readFile(join(process.cwd(), file), 'utf8');
  const bare = String(await toHtml.process(raw));

  // rehype-slug generates the ids the "On this page" rail links to.
  const withIds = String(
    await rehype()
      .data('settings', { fragment: true })
      .use(rehypeSlug)
      .process(bare)
  );

  const html = rewriteRepoLinks(withIds, file);
  return { html, headings: headingsFrom(html) };
}

/**
 * Pull h2/h3 back out of the RENDERED html rather than the markdown.
 *
 * Deliberate: rehype-slug generates the ids, so reading them from its output
 * guarantees the rail's anchors match the article's. Deriving them separately
 * from the markdown would be a second implementation of the same slug rules,
 * free to drift — the failure removed from the theme list in #408.
 */
function headingsFrom(html: string): RenderedDoc['headings'] {
  const out: RenderedDoc['headings'] = [];
  // [\s\S] rather than the `s` flag, which needs an es2018+ target.
  const re = /<h([23])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = m[3].replace(/<[^>]+>/g, '').trim();
    if (text) out.push({ level: Number(m[1]), id: m[2], text });
  }
  return out;
}

/**
 * Make the markdown's repo-relative links resolve on the SITE (#1373).
 *
 * These documents are written to be read on GitHub, where `docs/FORKING.md`
 * and `architecture-detailed.png` are files. Rendered into `/docs/<slug>/` the
 * same strings become paths under the page, which do not exist — the crawl in
 * `tests/e2e/tests/broken-links.spec.ts` found 24 of them. The markdown stays
 * correct for GitHub readers; the rewrite happens here, at build time:
 *
 *   - a link to another document in the registry becomes that document's page;
 *   - any other repo file becomes its page on GitHub (`blob`), or for an image
 *     `src`, the raw file (`raw`), so the image still renders.
 *
 * Absolute (`/...`), `#fragment`, `?query` and scheme-qualified (`https:`,
 * `mailto:`) targets are left alone.
 */
export function rewriteRepoLinks(html: string, file: string): string {
  const dir = posix.dirname(file);
  return html.replace(
    /\b(href|src)="([^"]*)"/g,
    (whole, attr: string, value: string) => {
      if (
        value === '' ||
        value.startsWith('#') ||
        value.startsWith('/') ||
        value.startsWith('?') ||
        /^[a-z][a-z0-9+.-]*:/i.test(value)
      ) {
        return whole;
      }
      const [pathPart, ...rest] = value.split(/(?=[?#])/);
      const suffix = rest.join('');
      const repoPath = posix.normalize(posix.join(dir, pathPart));
      if (repoPath.startsWith('..')) return whole;

      const doc = DOCS.find((d) => d.file === repoPath);
      if (doc && attr === 'href') {
        const hash = suffix.includes('#')
          ? suffix.slice(suffix.indexOf('#'))
          : '';
        return `href="${getInternalUrl(`/docs/${doc.slug}/`)}${hash}"`;
      }
      const kind = attr === 'src' ? 'raw' : 'blob';
      return `${attr}="${projectConfig.projectUrl}/${kind}/main/${repoPath}${suffix}"`;
    }
  );
}
