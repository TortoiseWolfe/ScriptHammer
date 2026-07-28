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

export default async function BlogPage() {
  // For static export, we'll show all posts without pagination
  const { posts } = await getPosts(1, 100); // Get up to 100 posts

  return (
    <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8 md:py-12 lg:px-8">
      {/* Page Header - Mobile-first (PRP-017 T037)
          The h1 is new (#381). This page had NO h1 at all — only a lead
          paragraph — so the listing had no accessible name and screen-reader
          users landed on a document whose first heading was a card title.
          Verified by measurement during the #395 sweep, which reported
          `h1=null` for this route while every other page had one. */}
      <header className="mb-8 text-center sm:mb-10 md:mb-12">
        <h1 className="text-base-content mb-2 text-4xl font-bold tracking-tight sm:text-5xl">
          Build log
        </h1>
        <p className="text-base-content/85 text-base sm:text-lg md:text-xl">
          Notes from the shop floor
        </p>
      </header>

      {/* Main Content Area */}
      {posts.length > 0 ? (
        <div>
          {/* Posts Grid - Mobile-first responsive (PRP-017 T037) */}
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
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
          <p className="text-base-content/80 text-lg">
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
};
