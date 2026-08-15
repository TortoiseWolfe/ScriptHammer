import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DOCS, SECTIONS, findDoc, neighbours } from '@/lib/docs/registry';
import { renderDoc } from '@/lib/docs/render';

// 3a (#380). The comp is a documentation ARTICLE page: nav rail as a well,
// active page as a raised pill, code in recessed panels, an "On this page"
// rail and a prev/next pager.
//
// Server component, static export — the markdown is read and rendered at
// build time, so neither remark nor the source markdown reaches the browser.

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = findDoc(slug);
  return {
    title: doc ? `${doc.title} - ScriptHammer` : 'Documentation - ScriptHammer',
    description: doc?.hint,
    // Each doc claims its own URL (#668).
    alternates: { canonical: `/docs/${slug}/` },
    openGraph: { url: `/docs/${slug}/` },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = findDoc(slug);
  if (!doc) notFound();

  const { html, headings } = await renderDoc(doc.file);
  const { prev, next } = neighbours(slug);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)_200px]">
        {/* ── Rail: a WELL, the current page lifted onto a plate ─────────── */}
        <nav
          aria-label="Documentation"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <div className="sh-well bg-base-100 rounded-box p-3">
            {SECTIONS.map((section) => {
              const items = DOCS.filter((d) => d.section === section);
              if (!items.length) return null;
              return (
                <div key={section} className="mb-3 last:mb-0">
                  <h2 className="text-base-content mb-1 px-2 font-mono text-[10.5px] tracking-[.14em] uppercase">
                    {section}
                  </h2>
                  <ul>
                    {items.map((item) => {
                      const active = item.slug === slug;
                      return (
                        <li key={item.slug}>
                          <Link
                            href={`/docs/${item.slug}`}
                            aria-current={active ? 'page' : undefined}
                            className={`text-base-content flex min-h-11 items-center rounded-full px-3 text-sm transition-colors ${
                              active ? 'sh-rail-active' : 'hover:bg-base-200'
                            }`}
                          >
                            {item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>

        {/* ── Article ────────────────────────────────────────────────────── */}
        <article className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="text-base-content flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[.12em] uppercase">
              <li>
                <Link href="/docs" className="link link-hover">
                  Docs
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>{doc.section}</li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{doc.title}</li>
            </ol>
          </nav>

          <h1 className="text-base-content font-display mb-6 text-3xl tracking-[-0.025em] sm:text-[38px]">
            {doc.title}
          </h1>

          {/* `sh-doc` (globals.css) puts code into recessed panels and gives
              tables a readable grid — the comp's "code in recessed panels"
              applied to markup this page does not author.

              dangerouslySetInnerHTML is deliberate and the threat model is
              worth stating: this HTML is built from markdown CHECKED INTO THIS
              REPO, read from disk at build time on a static export. There is
              no user input anywhere in the path — no query param, no CMS, no
              database. Anyone able to change these files can already change
              this component, so sanitising would add no security boundary
              while stripping the <details> and <img> tags several of the docs
              legitimately use. If a doc ever becomes user-supplied, this must
              gain a sanitiser first. */}
          <div
            className="sh-doc max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* ── Pager ─────────────────────────────────────────────────────── */}
          <nav
            aria-label="More documentation"
            className="border-base-300 mt-12 flex flex-wrap justify-between gap-4 border-t pt-6"
          >
            {prev ? (
              <Link
                href={`/docs/${prev.slug}`}
                className="sh-btn sh-btn-ghost !justify-start"
              >
                <span aria-hidden="true">←</span>
                {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/docs/${next.slug}`}
                className="sh-btn sh-btn-ghost !justify-end"
              >
                {next.title}
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </nav>
        </article>

        {/* ── On this page ───────────────────────────────────────────────── */}
        {headings.length > 0 && (
          <aside
            aria-labelledby="toc-heading"
            className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
          >
            <h2
              id="toc-heading"
              className="text-base-content mb-2 font-mono text-[10.5px] tracking-[.14em] uppercase"
            >
              On this page
            </h2>
            <ul className="border-base-300 border-l">
              {headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    className={`text-base-content hover:bg-base-200 flex min-h-11 items-center text-sm ${
                      h.level === 3 ? 'pl-6' : 'pl-3'
                    }`}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </main>
  );
}
