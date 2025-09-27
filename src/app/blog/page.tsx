import BlogPostCard from '@/components/molecular/BlogPostCard';
import type { BlogPost, BlogPostListResponse } from '@/types/blog';
import fs from 'fs/promises';
import path from 'path';

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
    console.error('Error fetching posts:', error);
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
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <header className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold">Blog</h1>
        <p className="text-base-content/70 text-lg">
          Thoughts, ideas, and insights from our team
        </p>
      </header>

      {/* Main Content Area */}
      {posts.length > 0 ? (
        <div>
          {/* Posts Grid */}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogPostCard
                key={post.id}
                post={post}
                className="h-full"
                showSEO={true}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-base-content/60 text-lg">
            No posts found. Check back soon!
          </p>
        </div>
      )}
    </div>
  );
}

export const metadata = {
  title: 'Blog',
  description: 'Read our latest blog posts and insights',
};
