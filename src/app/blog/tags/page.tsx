import { Metadata } from 'next';
import Link from 'next/link';
import TagCloud from '@/components/molecular/TagCloud';
import blogData from '@/lib/blog/blog-data.json';
import { getProjectConfig } from '@/config/project.config';

export const metadata: Metadata = {
  // This route claims its own URL (#668).
  alternates: { canonical: '/blog/tags/' },
  title: 'Blog Tags | ScriptHammer',
  description: 'Browse all blog post tags and topics',
  openGraph: {
    url: '/blog/tags/',
    title: 'Blog Tags',
    description: 'Browse all blog post tags and topics',
    type: 'website',
  },
};

interface TagData {
  name: string;
  count: number;
}

function getTagsFromPosts(): TagData[] {
  const tagMap = new Map<string, number>();

  // Aggregate tags from all published posts
  blogData.posts
    .filter((post) => post.status === 'published')
    .forEach((post) => {
      if (post.metadata?.tags && Array.isArray(post.metadata.tags)) {
        post.metadata.tags.forEach((tag) => {
          const currentCount = tagMap.get(tag) || 0;
          tagMap.set(tag, currentCount + 1);
        });
      }
    });

  // Convert to array
  return Array.from(tagMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));
}

export default function TagsPage() {
  const tags = getTagsFromPosts();
  const totalPosts = blogData.posts.filter(
    (p) => p.status === 'published'
  ).length;
  const config = getProjectConfig();

  // Sort tags by count for display
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="font-display mb-4 !text-2xl leading-[1.05] tracking-[-0.025em] sm:!text-4xl md:!text-5xl">
          Blog Tags
        </h1>
        <p className="text-base-content text-lg">
          Explore {tags.length} topics across {totalPosts} blog posts
        </p>
      </div>

      {/* Tag Cloud */}
      <div className="mb-12">
        <TagCloud
          tags={tags}
          showCounts={true}
          sizeMethod="logarithmic"
          className="mx-auto max-w-4xl"
        />
      </div>

      {/* Popular Tags Section */}
      {sortedTags.length > 0 && (
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display mb-6 text-2xl">Popular Tags</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedTags.slice(0, 9).map((tag) => (
              <Link
                key={tag.name}
                href={`/blog/tags/${encodeURIComponent(tag.name.toLowerCase())}`}
                className="sh-plate bg-base-100 rounded-box focus-visible:ring-primary flex min-h-11 flex-col gap-1 p-4 transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:outline-none"
              >
                <h3 className="text-base-content font-display text-base leading-tight">
                  {tag.name}
                </h3>
                <p className="text-base-content font-mono text-[11px] tracking-[.14em] uppercase">
                  {tag.count} {tag.count === 1 ? 'post' : 'posts'}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Tags List */}
      <div className="mx-auto mt-12 max-w-4xl">
        <h2 className="font-display mb-6 text-2xl">All Tags</h2>
        {/* Individually grooved chips, NOT `sh-rail`. The rail is a single pill
            (border-radius 9999px) that holds ONE row of options — /blog uses it with
            eight tags. Wrapping 67 tags into it renders a giant ellipse with the
            corner chips outside the shape. Caught by looking at the render; every
            class assertion passed while it was wrong. */}
        <nav
          aria-label="All blog tags"
          className="flex flex-wrap justify-center gap-2"
        >
          {sortedTags.map((tag) => (
            <Link
              key={tag.name}
              href={`/blog/tags/${encodeURIComponent(tag.name.toLowerCase())}`}
              className="sh-groove bg-base-100 text-base-content hover:bg-base-200 focus-visible:ring-primary inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 font-mono text-[11px] tracking-[.1em] uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {tag.name}
              <span className="text-base-content">({tag.count})</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Back to Blog Link */}
      <div className="mt-12 text-center">
        <Link href="/blog" className="sh-btn sh-btn-primary">
          ← Back to Blog
        </Link>
      </div>
    </main>
  );
}
