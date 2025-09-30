import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BlogPostCard from '@/components/molecular/BlogPostCard';
import TagBadge from '@/components/atomic/TagBadge';
import blogData from '@/lib/blog/blog-data.json';
import type { BlogPost } from '@/types/blog';

interface PageProps {
  params: Promise<{
    tag: string;
  }>;
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);

  // Find the proper case version of the tag
  const allTags = new Set<string>();
  blogData.posts.forEach((post) => {
    post.metadata?.tags?.forEach((tag) => allTags.add(tag));
  });

  const properTag =
    Array.from(allTags).find(
      (t) => t.toLowerCase() === decodedTag.toLowerCase()
    ) || decodedTag;

  return {
    title: `Posts tagged "${properTag}" | ScriptHammer Blog`,
    description: `Browse all blog posts tagged with ${properTag}`,
    openGraph: {
      title: `Posts tagged "${properTag}"`,
      description: `Browse all blog posts tagged with ${properTag}`,
      type: 'website',
    },
  };
}

// Generate static params for all tags
export async function generateStaticParams() {
  const tags = new Set<string>();

  blogData.posts
    .filter((post) => post.status === 'published')
    .forEach((post) => {
      post.metadata?.tags?.forEach((tag) => {
        tags.add(tag.toLowerCase());
      });
    });

  return Array.from(tags).map((tag) => ({
    tag: encodeURIComponent(tag),
  }));
}

function getPostsByTag(tag: string): any[] {
  const decodedTag = decodeURIComponent(tag).toLowerCase();

  return blogData.posts.filter((post) => {
    if (post.status !== 'published') return false;
    if (!post.metadata?.tags) return false;

    return post.metadata.tags.some(
      (postTag) => postTag.toLowerCase() === decodedTag
    );
  });
}

function getRelatedTags(currentTag: string, posts: any[]): string[] {
  const tagCounts = new Map<string, number>();
  const currentTagLower = currentTag.toLowerCase();

  posts.forEach((post) => {
    post.metadata?.tags?.forEach((tag: string) => {
      if (tag.toLowerCase() !== currentTagLower) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    });
  });

  // Sort by count and return top 10
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);
}

export default async function TagPage({ params }: PageProps) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);
  const posts = getPostsByTag(tag);

  // If no posts found, show 404
  if (posts.length === 0) {
    notFound();
  }

  // Find the proper case version of the tag
  const allTags = new Set<string>();
  blogData.posts.forEach((post) => {
    post.metadata?.tags?.forEach((tag) => allTags.add(tag));
  });

  const properTag =
    Array.from(allTags).find(
      (t) => t.toLowerCase() === decodedTag.toLowerCase()
    ) || decodedTag;

  const relatedTags = getRelatedTags(properTag, posts);

  // Sort posts by date (newest first)
  const sortedPosts = [...posts].sort((a, b) => {
    const dateA = new Date(a.publishedAt || a.updatedAt).getTime();
    const dateB = new Date(b.publishedAt || b.updatedAt).getTime();
    return dateB - dateA;
  });

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <h1 className="text-3xl font-bold">Posts tagged</h1>
          <TagBadge
            tag={properTag}
            size="lg"
            variant="primary"
            clickable={false}
          />
        </div>
        <p className="text-base-content/70 text-lg">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'} found
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Main Content - Posts */}
        <div className="lg:col-span-3">
          {sortedPosts.length > 0 ? (
            <div className="grid gap-6">
              {sortedPosts.map((post) => (
                <BlogPostCard key={post.id} post={post} showSEO={false} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-base-content/70 text-xl">
                No posts found with this tag.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          {/* Related Tags */}
          {relatedTags.length > 0 && (
            <div className="card bg-base-200 mb-6">
              <div className="card-body">
                <h2 className="card-title text-lg">Related Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {relatedTags.map((tag) => (
                    <TagBadge key={tag} tag={tag} size="sm" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Browse All Tags */}
          <div className="card bg-base-200 mb-6">
            <div className="card-body">
              <h2 className="card-title text-lg">Browse Tags</h2>
              <Link href="/blog/tags" className="btn btn-sm btn-primary">
                View All Tags
              </Link>
            </div>
          </div>

          {/* Back to Blog */}
          <div className="card bg-base-200">
            <div className="card-body">
              <Link href="/blog" className="btn btn-sm btn-outline">
                ← Back to Blog
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
