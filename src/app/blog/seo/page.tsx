import fs from 'fs/promises';
import path from 'path';
import { seoAnalyzer } from '@/lib/blog/seo-analyzer';
import SEOAnalysisPanel from '@/components/molecular/SEOAnalysisPanel';
import { createLogger } from '@/lib/logger';

const logger = createLogger('app:blog:seo:page');

async function getAllPosts() {
  try {
    const jsonPath = path.join(process.cwd(), 'src/lib/blog/blog-data.json');
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(jsonData);

    // Transform posts and analyze SEO
    const postsWithSEO = (data.posts || []).map((p: any) => {
      const post = {
        ...p,
        version: 1,
        syncStatus: 'synced',
        createdAt: p.publishedAt || new Date().toISOString(),
        offline: {
          isOfflineDraft: false,
          lastSyncedAt: new Date().toISOString(),
        },
      };

      const analysis = seoAnalyzer.analyze(post);

      return {
        post,
        analysis,
      };
    });

    // Sort by SEO score (lowest first to show what needs work)
    return postsWithSEO.sort(
      (a: any, b: any) => a.analysis.score.overall - b.analysis.score.overall
    );
  } catch (error) {
    logger.error('Error loading posts', { error });
    return [];
  }
}

export default async function SEODashboardPage() {
  const postsWithSEO = await getAllPosts();

  // Calculate average scores
  const avgScores =
    postsWithSEO.length > 0
      ? {
          overall: Math.round(
            postsWithSEO.reduce(
              (acc: number, p: any) => acc + p.analysis.score.overall,
              0
            ) / postsWithSEO.length
          ),
          title: Math.round(
            postsWithSEO.reduce(
              (acc: number, p: any) => acc + p.analysis.score.title,
              0
            ) / postsWithSEO.length
          ),
          description: Math.round(
            postsWithSEO.reduce(
              (acc: number, p: any) => acc + p.analysis.score.description,
              0
            ) / postsWithSEO.length
          ),
          content: Math.round(
            postsWithSEO.reduce(
              (acc: number, p: any) => acc + p.analysis.score.content,
              0
            ) / postsWithSEO.length
          ),
          keywords: Math.round(
            postsWithSEO.reduce(
              (acc: number, p: any) => acc + p.analysis.score.keywords,
              0
            ) / postsWithSEO.length
          ),
          readability: Math.round(
            postsWithSEO.reduce(
              (acc: number, p: any) => acc + p.analysis.score.readability,
              0
            ) / postsWithSEO.length
          ),
          technical: Math.round(
            postsWithSEO.reduce(
              (acc: number, p: any) => acc + p.analysis.score.technical,
              0
            ) / postsWithSEO.length
          ),
        }
      : null;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-4 text-3xl font-bold">SEO Dashboard</h1>
        <p className="text-base-content/70">
          Analyze and improve the SEO performance of your blog posts
        </p>
      </div>

      {/* Overall Stats */}
      {avgScores && (
        <div className="card bg-base-200 mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Overall Blog SEO Performance</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
              <div className="stat bg-base-100 rounded">
                <div className="stat-title text-xs">Overall</div>
                <div
                  className={`stat-value text-lg text-${seoAnalyzer.getScoreColor(avgScores.overall)}`}
                >
                  {avgScores.overall}%
                </div>
                <div className="stat-desc text-xs">
                  {seoAnalyzer.getScoreLabel(avgScores.overall)}
                </div>
              </div>
              <div className="stat bg-base-100 rounded">
                <div className="stat-title text-xs">Titles</div>
                <div
                  className={`stat-value text-lg text-${avgScores.title >= 80 ? 'success' : avgScores.title >= 60 ? 'warning' : 'error'}`}
                >
                  {avgScores.title}%
                </div>
              </div>
              <div className="stat bg-base-100 rounded">
                <div className="stat-title text-xs">Descriptions</div>
                <div
                  className={`stat-value text-lg text-${avgScores.description >= 80 ? 'success' : avgScores.description >= 60 ? 'warning' : 'error'}`}
                >
                  {avgScores.description}%
                </div>
              </div>
              <div className="stat bg-base-100 rounded">
                <div className="stat-title text-xs">Content</div>
                <div
                  className={`stat-value text-lg text-${avgScores.content >= 80 ? 'success' : avgScores.content >= 60 ? 'warning' : 'error'}`}
                >
                  {avgScores.content}%
                </div>
              </div>
              <div className="stat bg-base-100 rounded">
                <div className="stat-title text-xs">Keywords</div>
                <div
                  className={`stat-value text-lg text-${avgScores.keywords >= 80 ? 'success' : avgScores.keywords >= 60 ? 'warning' : 'error'}`}
                >
                  {avgScores.keywords}%
                </div>
              </div>
              <div className="stat bg-base-100 rounded">
                <div className="stat-title text-xs">Readability</div>
                <div
                  className={`stat-value text-lg text-${avgScores.readability >= 80 ? 'success' : avgScores.readability >= 60 ? 'warning' : 'error'}`}
                >
                  {avgScores.readability}%
                </div>
              </div>
              <div className="stat bg-base-100 rounded">
                <div className="stat-title text-xs">Technical</div>
                <div
                  className={`stat-value text-lg text-${avgScores.technical >= 80 ? 'success' : avgScores.technical >= 60 ? 'warning' : 'error'}`}
                >
                  {avgScores.technical}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts SEO Analysis */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Posts Needing SEO Improvement</h2>
        {postsWithSEO.length > 0 ? (
          <div className="grid gap-6">
            {postsWithSEO.map(({ post, analysis }: any) => (
              <div key={post.id} className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="mb-2 text-xl font-semibold">
                        <a
                          href={`/blog/${post.slug}`}
                          className="hover:text-primary"
                        >
                          {post.title}
                        </a>
                      </h3>
                      <p className="text-base-content/70 text-sm">
                        {post.excerpt}
                      </p>
                    </div>
                    <div
                      className={`badge badge-lg badge-${seoAnalyzer.getScoreColor(analysis.score.overall)}`}
                    >
                      SEO: {analysis.score.overall}%
                    </div>
                  </div>

                  <SEOAnalysisPanel post={post} expanded={true} />

                  <div className="card-actions mt-4 justify-end">
                    <a
                      href={`/blog/${post.slug}`}
                      className="btn btn-ghost btn-sm"
                    >
                      View Post
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-base-content/60 text-lg">No posts found.</p>
          </div>
        )}
      </div>

      {/* SEO Best Practices */}
      <div className="card bg-base-200 mt-12">
        <div className="card-body">
          <h2 className="card-title mb-4">SEO Best Practices Checklist</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-primary mb-2 font-semibold">
                Content Guidelines
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>Write 600-1000+ words for optimal SEO value</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>Use H2-H6 headings to structure your content</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>Include relevant images with descriptive alt text</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>Add internal links to related posts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>Include external links to authoritative sources</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-primary mb-2 font-semibold">
                Technical Optimization
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>Title length: 50-60 characters</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>Meta description: 150-160 characters</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>URL slug: concise and keyword-rich</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>3-5 relevant tags/keywords per post</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-1">✓</span>
                  <span>Featured image for social media sharing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'SEO Dashboard - Blog',
  description: 'Analyze and improve SEO performance of your blog posts',
};
