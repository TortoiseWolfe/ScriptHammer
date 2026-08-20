import Link from 'next/link';
import { getProjectConfig } from '@/config/project.config';
import BlogPostCard from '@/components/molecular/BlogPostCard';
import type { BlogPost, BlogPostListResponse } from '@/types/blog';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '@/lib/logger';

const logger = createLogger('app:blog:page');

async function getPosts(
  page = 1,
  pageSize = 12
): Promise<BlogPostListResponse> {
  try {
    // Read directly from generated JSON for static export
    const jsonPath = path.join(process.cwd(), 'src/lib/blog/blog-data.json');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(jsonData);

    // Filter published posts
    const posts = (data.posts || []).filter(
      (p: any) => p.status === 'published'
    );

    // Calculate pagination
    const total = posts.length;
    const offset = (page - 1) * pageSize;
    const paginatedPosts = posts.slice(offset, offset + pageSize);

    // Transform to match BlogPost type
    const transformedPosts = paginatedPosts.map((p: any) => ({
      ...p,
      version: 1,
      syncStatus: 'synced',
      createdAt: p.publishedAt || new Date().toISOString(),
      offline: {
        isOfflineDraft: false,
        lastSyncedAt: new Date().toISOString(),
      },
    }));

    return {
      posts: transformedPosts,
      total,
      page,
      pageSize,
      hasMore: offset + pageSize < total,
    };
  } catch (error) {
    logger.error('Error fetching posts', { error });
    return {
      posts: [],
      total: 0,
      page: 1,
      pageSize: 12,
      hasMore: false,
    };
  }
}

/** The chip rail's destinations. Tags, not the comp's invented categories —
 *  /blog/tags/[tag] is a real route with 53 live tags, so every chip goes
 *  somewhere. Ordered by post count so the rail leads with what exists most. */
function topTags(posts: BlogPost[], limit = 4): string[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.metadata?.tags ?? []) {
      const key = tag.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export default async function BlogPage() {
  // For static export, we'll show all posts without pagination
  const { posts } = await getPosts(1, 100); // Get up to 100 posts

  // The comp leads with one post on a wide plate. `metadata.featured` marks it;
  // newest is the fallback so the slot is never empty.
  const lead =
    posts.find((post) => post.metadata?.featured) ?? posts[0] ?? null;
  const rest = lead ? posts.filter((post) => post.id !== lead.id) : posts;

  // Root-relative image paths need the basePath prefix, or they 404 under
  // /ScriptHammer. BlogPostCard.tsx:48-54 already does this; the lead post is
  // a second renderer of the same field and needs the same treatment.
  const basePath = getProjectConfig().basePath || '';
  const rawLeadImage = lead?.metadata?.featuredImage;
  const leadImage = rawLeadImage?.startsWith('/')
    ? `${basePath}${rawLeadImage}`
    : rawLeadImage;

  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
      {/* Eyebrow above, statement as the h1, chip rail opposite — the header
          row from the design source ("3b BLOG"). See #381. */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10 md:mb-12">
        <div>
          {/* Solid, not `text-accent`: the accent measured 6.44:1 on
              scripthammer-light, under the 7:1 gate (#21/#411). */}
          <p className="text-base-content mb-2 font-mono text-xs tracking-wider uppercase">
            Build log
          </p>
          <h1 className="text-base-content font-display text-4xl tracking-tight sm:text-5xl">
            Notes from the shop floor
          </h1>
        </div>

        {/* Same groove-rail-with-raised-pill as the nav (#378) — the comp uses
            one shape for "a set of options, one of them current". */}
        <nav aria-label="Filter posts by tag" className="sh-rail flex-wrap">
          <span className="sh-rail-active text-base-content inline-flex min-h-11 items-center rounded-full px-3.5 font-mono text-[11px] tracking-[.1em] uppercase">
            All
          </span>
          {topTags(posts).map((tag) => (
            <Link
              key={tag}
              href={`/blog/tags/${encodeURIComponent(tag)}`}
              className="text-base-content hover:bg-base-200 inline-flex min-h-11 items-center rounded-full px-3.5 font-mono text-[11px] tracking-[.1em] uppercase transition-colors"
            >
              {tag}
            </Link>
          ))}
        </nav>
      </header>

      {posts.length > 0 ? (
        <div>
          {/* ── Lead post: a wide plate with the thumbnail recessed into it ── */}
          {lead && (
            <Link
              href={`/blog/${lead.slug}`}
              className="sh-plate bg-base-100 focus-within:ring-primary mb-8 grid grid-cols-1 gap-6 rounded-[24px] p-[10px] focus-within:ring-2 lg:grid-cols-[520px_1fr]"
            >
              <span className="sh-well bg-base-200 flex h-56 items-center justify-center overflow-hidden rounded-[17px] lg:h-[300px]">
                {leadImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leadImage}
                    alt={lead.metadata.featuredImageAlt ?? ''}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // 11 of 12 posts have an image; the well must not collapse
                  // into an empty box for the one that does not.
                  <span className="text-base-content font-mono text-[10.5px] tracking-[.14em] uppercase">
                    {lead.slug}
                  </span>
                )}
              </span>

              <span className="flex flex-col gap-3 p-2 lg:py-5 lg:pr-6 lg:pl-0">
                <span className="text-base-content flex flex-wrap items-center gap-3 font-mono text-[11px] tracking-[.14em] uppercase">
                  {lead.metadata?.categories?.[0] && (
                    <span className="sh-groove bg-base-100 rounded-lg px-2.5 py-1.5">
                      {lead.metadata.categories[0]}
                    </span>
                  )}
                  {lead.publishedAt && (
                    <span>{DATE.format(new Date(lead.publishedAt))}</span>
                  )}
                  {lead.metadata?.readingTime && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{lead.metadata.readingTime} min</span>
                    </>
                  )}
                </span>

                <span className="text-base-content font-display text-2xl leading-[1.08] tracking-[-0.025em] sm:text-[34px]">
                  {lead.title}
                </span>

                <span className="text-base-content leading-[1.6]">
                  {lead.excerpt}
                </span>

                <span className="sh-btn sh-btn-primary mt-2 self-start">
                  Read it
                  <span aria-hidden="true">→</span>
                </span>
              </span>
            </Link>
          )}

          {/* Posts Grid - Mobile-first responsive (PRP-017 T037) */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <BlogPostCard
                key={post.id}
                post={post}
                className="h-full"
                showSEO={false}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-base-content text-lg">
            No posts found. Check back soon!
          </p>
        </div>
      )}
    </main>
  );
}

export const metadata = {
  title: 'Blog',
  description: 'Read our latest blog posts and insights',
  // This route claims its own URL (#668).
  alternates: { canonical: '/blog/' },
  openGraph: { url: '/blog/' },
};
