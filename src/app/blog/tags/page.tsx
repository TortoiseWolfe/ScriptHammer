import { Metadata } from 'next';
import Link from 'next/link';
import TagCloud from '@/components/atomic/TagCloud';
import blogData from '@/lib/blog/blog-data.json';
import { getProjectConfig } from '@/config/project.config';

export const metadata: Metadata = {
  title: 'Blog Tags | ScriptHammer',
  description: 'Browse all blog post tags and topics',
  openGraph: {
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
    <main className="container mx-auto px-4 py-6 sm:py-8 md:py-12">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="mb-4 !text-2xl font-bold sm:!text-4xl md:!text-5xl">
          Blog Tags
        </h1>
        <p className="text-base-content/70 text-lg">
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
          <h2 className="mb-6 text-2xl font-semibold">Popular Tags</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedTags.slice(0, 9).map((tag) => (
              <Link
                key={tag.name}
                href={`/blog/tags/${encodeURIComponent(tag.name.toLowerCase())}`}
                className="card bg-base-200 hover:bg-base-300 transition-colors"
              >
                <div className="card-body p-4">
                  <h3 className="card-title text-base">{tag.name}</h3>
                  <p className="text-base-content/70 text-sm">
                    {tag.count} {tag.count === 1 ? 'post' : 'posts'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Tags List */}
      <div className="mx-auto mt-12 max-w-4xl">
        <h2 className="mb-6 text-2xl font-semibold">All Tags</h2>
        <div className="flex flex-wrap gap-2">
          {sortedTags.map((tag) => (
            <Link
              key={tag.name}
              href={`/blog/tags/${encodeURIComponent(tag.name.toLowerCase())}`}
              className="badge badge-lg badge-outline hover:badge-primary transition-colors"
            >
              {tag.name}
              <span className="ml-1 opacity-70">({tag.count})</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Back to Blog Link */}
      <div className="mt-12 text-center">
        <Link href="/blog" className="btn btn-primary">
          ← Back to Blog
        </Link>
      </div>
    </main>
  );
}
