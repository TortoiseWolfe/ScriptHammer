/**
 * /api/blog/tags — STATIC EXPORT COMPATIBLE
 *
 * This is the only file under src/app/api/. CLAUDE.md notes that the
 * project deploys via static export to GitHub Pages and that dynamic
 * server route handlers won't run in production. This route handles
 * that constraint by setting `dynamic = 'error'`, which forces Next.js
 * to fully resolve the response at build time — the output is emitted
 * as a static JSON file that GitHub Pages can serve directly.
 *
 * If you add a new src/app/api/ route, ensure it follows the same
 * pattern OR migrate it to a Supabase Edge Function. Webhook handlers
 * (Stripe, PayPal) intentionally live under supabase/functions/, not
 * here, because they need a real server runtime.
 */

import { NextResponse } from 'next/server';
import blogData from '@/lib/blog/blog-data.json';
import { createLogger } from '@/lib/logger';

const logger = createLogger('app:route:blog-tags');

// Required for static export — `error` forces fully-resolvable build-time
// output. Removing this turns the route into a server-only handler that
// GitHub Pages can't run, producing silent 404s in production.
export const dynamic = 'error';
export const revalidate = 86400; // Revalidate once per day

export interface TagData {
  name: string;
  slug: string;
  count: number;
}

export interface TagsResponse {
  tags: TagData[];
  total: number;
}

/**
 * GET /api/blog/tags
 * Returns all unique tags with their post counts
 */
export async function GET() {
  try {
    // Use default values for static generation
    const sortBy = 'count'; // 'count' | 'name'
    const sortOrder = 'desc'; // 'asc' | 'desc'
    const minCount = 1;

    // Aggregate tags from all published posts
    const tagMap = new Map<string, number>();

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

    // Convert to array and filter by minimum count
    const tags: TagData[] = Array.from(tagMap.entries())
      .filter(([_, count]) => count >= minCount)
      .map(([name, count]) => ({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        count,
      }));

    // Sort tags by count (descending) for static generation
    tags.sort((a, b) => {
      // Always sort by count in descending order for static builds
      return b.count - a.count;
    });

    const response: TagsResponse = {
      tags,
      total: tags.length,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) {
    logger.error('Error fetching tags', { error });
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}
