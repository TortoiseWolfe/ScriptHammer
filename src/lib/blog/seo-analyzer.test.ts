/**
 * Unit tests for SEOAnalyzer
 *
 * Covers all six analysis categories (title, description, content, keywords,
 * readability, technical), their scoring math, and the utility color/label
 * helpers. Each section verifies a real branching path: threshold boundaries,
 * suggestion severity mapping, strengths/weaknesses accumulation.
 */

import { describe, it, expect } from 'vitest';
import { SEOAnalyzer, seoAnalyzer } from './seo-analyzer';
import type { BlogPost } from '@/types/blog';

/**
 * Build a BlogPost with a minimal-but-valid shape. Callers override any field
 * relevant to the specific scenario under test; everything else stays at a
 * neutral baseline so individual categories can be isolated.
 */
function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    id: 'test-id',
    slug: 'test-post',
    title: 'A Good Guide to Testing with 5 Tips and Tricks', // 50 chars, has power word + number
    content:
      'This is the body.\n\nAnother paragraph here.\n\n## A Heading\n\nMore body.',
    excerpt:
      'A one hundred and fifty character description with enough room for search engines to display it correctly and meaningfully in results pages here.',
    publishedAt: '2026-04-17T00:00:00Z',
    status: 'published',
    version: 1,
    syncStatus: 'synced',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-17T00:00:00Z',
    author: { id: 'a', name: 'Author' },
    metadata: {
      tags: ['seo', 'testing', 'guide'],
      categories: ['engineering'],
      featuredImage: '/img/featured.jpg',
      featuredImageAlt: 'featured image alt',
    },
    seo: {
      keywords: ['testing', 'seo', 'guide'],
      ogTitle: 'Shared title',
      ogDescription: 'Shared description',
    },
    offline: { isOfflineDraft: false },
    ...overrides,
  };
}

describe('SEOAnalyzer title analysis', () => {
  it('rewards an optimal-length title (30–60 chars)', () => {
    const post = makePost({ title: 'The Complete Guide to Testing Systems' });
    const { score, strengths } = new SEOAnalyzer().analyze(post);
    expect(score.title).toBeGreaterThanOrEqual(90);
    expect(strengths).toContain('Title length is optimal');
  });

  it('penalises titles under 30 chars with a warning suggestion', () => {
    const post = makePost({ title: 'Short title', seo: undefined });
    const { score, suggestions, weaknesses } = new SEOAnalyzer().analyze(post);
    expect(score.title).toBeLessThan(100);
    expect(weaknesses).toContain('Title is too short');
    // Filter to the title-category suggestion (content also flags "too short"
    // at error severity for low word counts)
    const tooShortTitle = suggestions.find(
      (s) => s.category === 'title' && s.message.includes('too short')
    );
    expect(tooShortTitle?.severity).toBe('warning');
  });

  it('penalises titles over 60 chars', () => {
    const post = makePost({
      title:
        'This Ultimate Guide Is Way Too Long To Be An Effective SEO Title For A Modern Blog Post',
      seo: undefined,
    });
    const { weaknesses } = new SEOAnalyzer().analyze(post);
    expect(weaknesses).toContain('Title is too long');
  });

  it('docks points when no power words are present', () => {
    const withPower = makePost({
      title: 'A Complete Study of Modern Markdown Systems',
      seo: undefined,
    });
    const withoutPower = makePost({
      title: 'A Survey of Modern Markdown Systems Today',
      seo: undefined,
    });
    const analyzer = new SEOAnalyzer();
    expect(analyzer.analyze(withPower).score.title).toBeGreaterThan(
      analyzer.analyze(withoutPower).score.title
    );
  });

  it('docks 5 points when title has no digit', () => {
    // Identical titles except for a numeric character, both within 30–60
    // chars, both containing a power word ("guide") so only the digit check
    // differs between them.
    const withNum = makePost({
      title: 'The Essential Guide 7 Steps To Winning SEO',
      seo: undefined,
    });
    const noNum = makePost({
      title: 'The Essential Guide Some Steps To Winning SEO',
      seo: undefined,
    });
    const analyzer = new SEOAnalyzer();
    const diff =
      analyzer.analyze(withNum).score.title -
      analyzer.analyze(noNum).score.title;
    expect(diff).toBe(5);
  });

  it('prefers seo.title over post.title when both exist', () => {
    const post = makePost({
      title: 'x', // would be penalized for length
      seo: { title: 'A Good Guide To SEO With 10 Tips', keywords: ['seo'] },
    });
    const { score } = new SEOAnalyzer().analyze(post);
    expect(score.title).toBeGreaterThan(80);
  });
});

describe('SEOAnalyzer description analysis', () => {
  it('flags missing description as error severity', () => {
    const post = makePost({ excerpt: undefined, seo: undefined });
    const { suggestions, weaknesses } = new SEOAnalyzer().analyze(post);
    const missing = suggestions.find((s) => s.message.includes('Missing meta'));
    expect(missing?.severity).toBe('error');
    expect(weaknesses).toContain('No meta description');
  });

  it('rewards a 120–160 char description', () => {
    const post = makePost({
      excerpt:
        'A carefully crafted description right in the sweet spot for search engines to display in full without truncation, which is perfect here.',
    });
    expect(post.excerpt!.length).toBeGreaterThanOrEqual(120);
    expect(post.excerpt!.length).toBeLessThanOrEqual(160);
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Description length is optimal');
  });

  it('penalises short descriptions (< 120 chars)', () => {
    const post = makePost({
      excerpt: 'Short description here.',
      seo: undefined,
    });
    const { weaknesses } = new SEOAnalyzer().analyze(post);
    expect(weaknesses).toContain('Description is too short');
  });

  it('penalises long descriptions (> 160 chars)', () => {
    const longDesc = 'A'.repeat(200);
    const post = makePost({ excerpt: longDesc, seo: undefined });
    const { weaknesses } = new SEOAnalyzer().analyze(post);
    expect(weaknesses).toContain('Description is too long');
  });

  it('detects call-to-action words', () => {
    const withCTA = makePost({
      excerpt:
        'Learn how to master SEO with this definitive walkthrough covering everything you need to know about optimising content for search engines.',
    });
    const withoutCTA = makePost({
      excerpt:
        'A completely neutral summary with no action prompt whatsoever here just prose about things without any instruction or call to action words used.',
    });
    const analyzer = new SEOAnalyzer();
    expect(analyzer.analyze(withCTA).strengths).toContain(
      'Description contains call-to-action'
    );
    expect(analyzer.analyze(withoutCTA).strengths).not.toContain(
      'Description contains call-to-action'
    );
  });

  it('falls back to excerpt when seo.description is absent', () => {
    const post = makePost({
      seo: { keywords: ['x'] }, // no description
      excerpt:
        'A fallback description taken from the excerpt field when the seo block does not provide one directly which the analyzer correctly uses.',
    });
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Description length is optimal');
  });
});

describe('SEOAnalyzer content analysis', () => {
  it('flags very short content (< 300 words) as error', () => {
    const post = makePost({ content: 'Only a dozen words here for the body.' });
    const { suggestions, weaknesses } = new SEOAnalyzer().analyze(post);
    const tooShort = suggestions.find((s) =>
      s.message.includes('Content is too short')
    );
    expect(tooShort?.severity).toBe('error');
    expect(weaknesses).toContain('Content is too short');
  });

  it('gives a modest warning for 300–600 word content', () => {
    const mediumContent =
      Array(400).fill('word').join(' ') +
      '\n\n## A heading\n\n' +
      Array(50).fill('more').join(' ');
    const post = makePost({
      content: mediumContent,
      metadata: { ...makePost().metadata, wordCount: 450 },
    });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const warn = suggestions.find((s) =>
      s.message.includes('Content could be longer')
    );
    expect(warn?.severity).toBe('warning');
  });

  it('rewards 1000+ word content as excellent', () => {
    const longContent =
      Array(1200).fill('word').join(' ') +
      '\n\n## H1\n\n## H2\n\n## H3\n\n![i](/x.jpg)\n\n[l](/y)';
    const post = makePost({
      content: longContent,
      metadata: { ...makePost().metadata, wordCount: 1200 },
    });
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Content length is excellent for SEO');
  });

  it('flags content with zero headings', () => {
    const content = Array(800).fill('word').join(' ');
    const post = makePost({
      content,
      metadata: { ...makePost().metadata, wordCount: 800 },
    });
    const { weaknesses } = new SEOAnalyzer().analyze(post);
    expect(weaknesses).toContain('No content structure (headings)');
  });

  it('rewards posts with 3+ headings', () => {
    const content =
      Array(800).fill('word').join(' ') +
      '\n\n## h1\n\n## h2\n\n## h3\n\n![i](/x.jpg)';
    const post = makePost({
      content,
      metadata: { ...makePost().metadata, wordCount: 800 },
    });
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Good use of headings');
  });

  it('flags content with no images and no featured image', () => {
    const post = makePost({
      content: Array(800).fill('word').join(' ') + '\n\n## h1',
      metadata: { tags: ['x'], categories: [], wordCount: 800 },
    });
    const { weaknesses } = new SEOAnalyzer().analyze(post);
    expect(weaknesses).toContain('No images');
  });

  it('accepts featured image from metadata as meeting the image requirement', () => {
    const post = makePost({
      content:
        Array(800).fill('word').join(' ') + '\n\n## h1\n\n## h2\n\n## h3',
      metadata: {
        tags: ['x'],
        categories: [],
        wordCount: 800,
        featuredImage: '/featured.jpg',
      },
    });
    const { strengths, weaknesses } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Contains images');
    expect(weaknesses).not.toContain('No images');
  });
});

describe('SEOAnalyzer keyword analysis', () => {
  it('penalises posts with no keywords', () => {
    const post = makePost({
      seo: undefined,
      metadata: { tags: [], categories: [] },
    });
    const { weaknesses } = new SEOAnalyzer().analyze(post);
    expect(weaknesses).toContain('No keywords');
  });

  it('falls back to metadata tags when seo.keywords is absent', () => {
    const post = makePost({
      seo: undefined,
      metadata: { tags: ['testing', 'guide', 'seo'], categories: [] },
      title: 'A Complete Guide to Testing and SEO',
    });
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Good keyword coverage');
  });

  it('penalises fewer than 3 keywords', () => {
    const post = makePost({
      seo: { keywords: ['only-one'] },
      metadata: { tags: [], categories: [] },
    });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const info = suggestions.find((s) => s.message.includes('Only 1 keyword'));
    expect(info?.severity).toBe('info');
  });

  it('penalises more than 7 keywords', () => {
    const tenKeywords = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const post = makePost({
      seo: { keywords: tenKeywords },
      title: 'A Guide Using a For Something',
    });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const tooMany = suggestions.find((s) => s.message.includes('Too many'));
    expect(tooMany).toBeDefined();
  });

  it('flags main keyword missing from title', () => {
    const post = makePost({
      title: 'Some Unrelated Guide To Writing',
      seo: { keywords: ['kubernetes', 'docker', 'cloud'] },
    });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const missing = suggestions.find(
      (s) =>
        s.message.includes('Main keyword') && s.message.includes('kubernetes')
    );
    expect(missing?.severity).toBe('warning');
  });

  it('rewards main keyword presence in title', () => {
    const post = makePost({
      title: 'A Complete Guide To Kubernetes Deployments',
      seo: { keywords: ['kubernetes', 'deployments', 'devops'] },
    });
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Main keyword in title');
  });
});

describe('SEOAnalyzer readability analysis', () => {
  it('flags paragraphs over 150 words', () => {
    const longParagraph = Array(200).fill('word').join(' ');
    const post = makePost({
      content: `${longParagraph}\n\nShort second paragraph.`,
    });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const longPara = suggestions.find((s) =>
      s.message.includes('paragraph(s) are too long')
    );
    expect(longPara?.severity).toBe('info');
  });

  it('rewards short average sentences (<= 20 words)', () => {
    const post = makePost({
      content:
        'Short sentence one. Short sentence two. Short sentence three. Short sentence four. Short sentence five.',
    });
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Good sentence length');
  });

  it('penalises very long average sentences', () => {
    const verbose = Array(3)
      .fill(Array(30).fill('word').join(' ') + '.')
      .join(' ');
    const post = makePost({ content: verbose });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const tooLong = suggestions.find((s) =>
      s.message.includes('Sentences are too long')
    );
    expect(tooLong).toBeDefined();
  });

  it('rewards posts that use numbered lists', () => {
    // Note: the current production regex only matches numbered-list items
    // (requires a literal "." after the bullet). Unordered "-" or "*" bullets
    // would not count. Tests here exercise what the code actually does.
    const post = makePost({
      content:
        'Short sentences here. Short. Short.\n\n1. item one\n2. item two\n3. item three',
    });
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Uses lists for readability');
  });

  it('known limitation: unordered dash bullets do not count as lists', () => {
    // Documenting a real production-code limitation via test. If the regex
    // is ever fixed to include "-" and "*", update this test to match.
    const post = makePost({
      content: 'Short sentences here. Short. Short.\n\n- item one\n- item two',
    });
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).not.toContain('Uses lists for readability');
  });
});

describe('SEOAnalyzer technical analysis', () => {
  it('flags missing featured image', () => {
    const post = makePost({
      metadata: { tags: ['x'], categories: [] },
    });
    const { weaknesses } = new SEOAnalyzer().analyze(post);
    expect(weaknesses).toContain('No featured image');
  });

  it('flags featured image without alt text', () => {
    const post = makePost({
      metadata: {
        tags: ['x'],
        categories: [],
        featuredImage: '/pic.jpg',
      },
    });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const noAlt = suggestions.find((s) =>
      s.message.includes('missing alt text')
    );
    expect(noAlt?.severity).toBe('warning');
  });

  it('penalises overly long slugs (> 50 chars)', () => {
    const post = makePost({
      slug: 'this-is-an-extremely-long-slug-that-is-way-too-many-characters-for-seo',
    });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const longSlug = suggestions.find((s) =>
      s.message.includes('URL slug is too long')
    );
    expect(longSlug).toBeDefined();
  });

  it('flags missing Open Graph metadata', () => {
    const post = makePost({
      seo: { keywords: ['x', 'y', 'z'] }, // no ogTitle / ogDescription
    });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const noOg = suggestions.find((s) =>
      s.message.includes('No Open Graph metadata')
    );
    expect(noOg).toBeDefined();
  });

  it('rewards Open Graph metadata presence', () => {
    const post = makePost({
      seo: {
        keywords: ['x', 'y', 'z'],
        ogTitle: 'Social title',
        ogDescription: 'Social description',
      },
    });
    const { strengths } = new SEOAnalyzer().analyze(post);
    expect(strengths).toContain('Has Open Graph metadata');
  });

  it('flags missing publication date', () => {
    const post = makePost({ publishedAt: undefined });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    const noDate = suggestions.find(
      (s) => s.message === 'No publication date set.'
    );
    expect(noDate).toBeDefined();
  });
});

describe('SEOAnalyzer overall score aggregation', () => {
  it('weights overall score as a rounded combination of the six categories', () => {
    const post = makePost();
    const { score } = new SEOAnalyzer().analyze(post);

    const expectedOverall = Math.round(
      score.title * 0.25 +
        score.description * 0.2 +
        score.content * 0.2 +
        score.keywords * 0.15 +
        score.readability * 0.1 +
        score.technical * 0.1
    );
    expect(score.overall).toBe(expectedOverall);
  });

  it('clamps category scores at zero (never negative)', () => {
    // Bare-minimum post that will fail every check
    const post = makePost({
      title: 'x',
      content: 'a',
      excerpt: undefined,
      seo: undefined,
      metadata: { tags: [], categories: [] },
      publishedAt: undefined,
      slug: '',
    });
    const { score } = new SEOAnalyzer().analyze(post);
    expect(score.title).toBeGreaterThanOrEqual(0);
    expect(score.description).toBeGreaterThanOrEqual(0);
    expect(score.content).toBeGreaterThanOrEqual(0);
    expect(score.keywords).toBeGreaterThanOrEqual(0);
    expect(score.readability).toBeGreaterThanOrEqual(0);
    expect(score.technical).toBeGreaterThanOrEqual(0);
  });

  it('sorts suggestions by descending impact', () => {
    const post = makePost({
      title: 'x',
      excerpt: undefined,
      seo: undefined,
      content: 'a',
      metadata: { tags: [], categories: [] },
    });
    const { suggestions } = new SEOAnalyzer().analyze(post);
    for (let i = 0; i < suggestions.length - 1; i++) {
      expect(suggestions[i].impact).toBeGreaterThanOrEqual(
        suggestions[i + 1].impact
      );
    }
  });
});

describe('SEOAnalyzer.getScoreColor', () => {
  it('returns success for 80+', () => {
    expect(new SEOAnalyzer().getScoreColor(80)).toBe('success');
    expect(new SEOAnalyzer().getScoreColor(100)).toBe('success');
  });

  it('returns warning for 60–79', () => {
    expect(new SEOAnalyzer().getScoreColor(60)).toBe('warning');
    expect(new SEOAnalyzer().getScoreColor(79)).toBe('warning');
  });

  it('returns error for under 60', () => {
    expect(new SEOAnalyzer().getScoreColor(59)).toBe('error');
    expect(new SEOAnalyzer().getScoreColor(0)).toBe('error');
  });
});

describe('SEOAnalyzer.getScoreLabel', () => {
  it('maps scores to expected labels at each threshold', () => {
    const a = new SEOAnalyzer();
    expect(a.getScoreLabel(95)).toBe('Excellent');
    expect(a.getScoreLabel(80)).toBe('Good');
    expect(a.getScoreLabel(70)).toBe('Fair');
    expect(a.getScoreLabel(60)).toBe('Needs Improvement');
    expect(a.getScoreLabel(45)).toBe('Poor');
  });
});

describe('SEOAnalyzer singleton', () => {
  it('exposes a usable default instance', () => {
    const { score } = seoAnalyzer.analyze(makePost());
    expect(typeof score.overall).toBe('number');
  });
});
