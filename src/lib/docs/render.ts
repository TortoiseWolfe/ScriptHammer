import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import { rehype } from 'rehype';
import rehypeSlug from 'rehype-slug';

/**
 * Markdown → HTML for `/docs` (#380).
 *
 * NOT `src/lib/blog/markdown-processor.ts`. That is a hand-rolled regex
 * processor and, measured, it renders neither tables nor blockquotes — a table
 * comes out as `<p>| Col A | Col B | | --- | --- |</p>`. The seven documents
 * behind this route carry **194 table rows** between them, and tables are most
 * of what makes reference docs useful.
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

  return { html: withIds, headings: headingsFrom(withIds) };
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
