/**
 * SEO Analyzer for Blog Posts
 * Analyzes posts and provides scores and suggestions
 */

import type { BlogPost } from '@/types/blog';

export interface SEOScore {
  overall: number;
  title: number;
  description: number;
  content: number;
  keywords: number;
  readability: number;
  technical: number;
}

export interface SEOSuggestion {
  category:
    | 'title'
    | 'description'
    | 'content'
    | 'keywords'
    | 'readability'
    | 'technical';
  severity: 'error' | 'warning' | 'info';
  message: string;
  impact: number; // 0-10 impact on SEO
}

export interface SEOAnalysis {
  score: SEOScore;
  suggestions: SEOSuggestion[];
  strengths: string[];
  weaknesses: string[];
}

export class SEOAnalyzer {
  /**
   * Analyze a blog post for SEO
   */
  analyze(post: BlogPost): SEOAnalysis {
    const suggestions: SEOSuggestion[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Analyze title
    const titleScore = this.analyzeTitle(
      post,
      suggestions,
      strengths,
      weaknesses
    );

    // Analyze description/excerpt
    const descriptionScore = this.analyzeDescription(
      post,
      suggestions,
      strengths,
      weaknesses
    );

    // Analyze content
    const contentScore = this.analyzeContent(
      post,
      suggestions,
      strengths,
      weaknesses
    );

    // Analyze keywords
    const keywordsScore = this.analyzeKeywords(
      post,
      suggestions,
      strengths,
      weaknesses
    );

    // Analyze readability
    const readabilityScore = this.analyzeReadability(
      post,
      suggestions,
      strengths,
      weaknesses
    );

    // Analyze technical SEO
    const technicalScore = this.analyzeTechnical(
      post,
      suggestions,
      strengths,
      weaknesses
    );

    // Calculate overall score
    const overall = Math.round(
      titleScore * 0.25 +
        descriptionScore * 0.2 +
        contentScore * 0.2 +
        keywordsScore * 0.15 +
        readabilityScore * 0.1 +
        technicalScore * 0.1
    );

    return {
      score: {
        overall,
        title: titleScore,
        description: descriptionScore,
        content: contentScore,
        keywords: keywordsScore,
        readability: readabilityScore,
        technical: technicalScore,
      },
      suggestions: suggestions.sort((a, b) => b.impact - a.impact),
      strengths,
      weaknesses,
    };
  }

  private analyzeTitle(
    post: BlogPost,
    suggestions: SEOSuggestion[],
    strengths: string[],
    weaknesses: string[]
  ): number {
    let score = 100;
    const title = post.seo?.title || post.title;

    // Check title length (50-60 chars optimal)
    if (title.length < 30) {
      score -= 20;
      suggestions.push({
        category: 'title',
        severity: 'warning',
        message: `Title is too short (${title.length} chars). Aim for 50-60 characters.`,
        impact: 6,
      });
      weaknesses.push('Title is too short');
    } else if (title.length > 60) {
      score -= 15;
      suggestions.push({
        category: 'title',
        severity: 'warning',
        message: `Title is too long (${title.length} chars). Keep it under 60 characters.`,
        impact: 5,
      });
      weaknesses.push('Title is too long');
    } else {
      strengths.push('Title length is optimal');
    }

    // Check for power words
    const powerWords = [
      'ultimate',
      'essential',
      'complete',
      'guide',
      'how',
      'why',
      'best',
      'top',
    ];
    const hasPowerWord = powerWords.some((word) =>
      title.toLowerCase().includes(word)
    );
    if (!hasPowerWord) {
      score -= 10;
      suggestions.push({
        category: 'title',
        severity: 'info',
        message:
          'Consider adding power words like "Ultimate", "Essential", or "Guide" to make the title more compelling.',
        impact: 3,
      });
    } else {
      strengths.push('Title contains power words');
    }

    // Check for numbers
    if (!/\d/.test(title)) {
      score -= 5;
      suggestions.push({
        category: 'title',
        severity: 'info',
        message:
          'Consider adding numbers to make the title more specific (e.g., "5 Ways", "10 Tips").',
        impact: 2,
      });
    }

    return Math.max(0, score);
  }

  private analyzeDescription(
    post: BlogPost,
    suggestions: SEOSuggestion[],
    strengths: string[],
    weaknesses: string[]
  ): number {
    let score = 100;
    const description = post.seo?.description || post.excerpt || '';

    // Check description length (150-160 chars optimal)
    if (!description) {
      score -= 40;
      suggestions.push({
        category: 'description',
        severity: 'error',
        message: 'Missing meta description. Add an excerpt or SEO description.',
        impact: 8,
      });
      weaknesses.push('No meta description');
    } else if (description.length < 120) {
      score -= 20;
      suggestions.push({
        category: 'description',
        severity: 'warning',
        message: `Description is too short (${description.length} chars). Aim for 150-160 characters.`,
        impact: 5,
      });
      weaknesses.push('Description is too short');
    } else if (description.length > 160) {
      score -= 15;
      suggestions.push({
        category: 'description',
        severity: 'warning',
        message: `Description is too long (${description.length} chars). Keep it under 160 characters.`,
        impact: 4,
      });
      weaknesses.push('Description is too long');
    } else {
      strengths.push('Description length is optimal');
    }

    // Check for call to action
    const ctaWords = ['learn', 'discover', 'find out', 'explore', 'read'];
    const hasCTA = ctaWords.some((word) =>
      description.toLowerCase().includes(word)
    );
    if (!hasCTA && description) {
      score -= 10;
      suggestions.push({
        category: 'description',
        severity: 'info',
        message:
          'Consider adding a call-to-action in the description (e.g., "Learn how...", "Discover...").',
        impact: 2,
      });
    } else if (hasCTA) {
      strengths.push('Description contains call-to-action');
    }

    return Math.max(0, score);
  }

  private analyzeContent(
    post: BlogPost,
    suggestions: SEOSuggestion[],
    strengths: string[],
    weaknesses: string[]
  ): number {
    let score = 100;
    const content = post.content;

    // Check content length
    const wordCount = post.metadata?.wordCount || content.split(/\s+/).length;
    if (wordCount < 300) {
      score -= 30;
      suggestions.push({
        category: 'content',
        severity: 'error',
        message: `Content is too short (${wordCount} words). Aim for at least 600 words for better SEO.`,
        impact: 8,
      });
      weaknesses.push('Content is too short');
    } else if (wordCount < 600) {
      score -= 15;
      suggestions.push({
        category: 'content',
        severity: 'warning',
        message: `Content could be longer (${wordCount} words). Aim for 1000+ words for optimal SEO.`,
        impact: 5,
      });
    } else if (wordCount >= 1000) {
      strengths.push('Content length is excellent for SEO');
    } else {
      strengths.push('Content length is good');
    }

    // Check for headings
    const headings = content.match(/^#{1,6}\s+.+$/gm) || [];
    if (headings.length === 0) {
      score -= 20;
      suggestions.push({
        category: 'content',
        severity: 'warning',
        message:
          'No headings found. Add H2-H6 headings to structure your content.',
        impact: 6,
      });
      weaknesses.push('No content structure (headings)');
    } else if (headings.length < 3) {
      score -= 10;
      suggestions.push({
        category: 'content',
        severity: 'info',
        message: `Only ${headings.length} heading(s) found. Add more subheadings to improve structure.`,
        impact: 3,
      });
    } else {
      strengths.push('Good use of headings');
    }

    // Check for images (in content or featured image in metadata)
    const images = content.match(/!\[.*?\]\(.*?\)/g) || [];
    const hasFeaturedImage = !!post.metadata?.featuredImage;
    if (images.length === 0 && !hasFeaturedImage) {
      score -= 15;
      suggestions.push({
        category: 'content',
        severity: 'warning',
        message: 'No images found. Add relevant images to improve engagement.',
        impact: 4,
      });
      weaknesses.push('No images');
    } else {
      strengths.push('Contains images');
    }

    // Check for links
    const links = content.match(/\[.*?\]\(.*?\)/g) || [];
    if (links.length === 0) {
      score -= 10;
      suggestions.push({
        category: 'content',
        severity: 'info',
        message:
          'No links found. Add internal and external links to improve SEO.',
        impact: 3,
      });
    } else {
      strengths.push('Contains links');
    }

    return Math.max(0, score);
  }

  private analyzeKeywords(
    post: BlogPost,
    suggestions: SEOSuggestion[],
    strengths: string[],
    weaknesses: string[]
  ): number {
    let score = 100;
    const keywords = post.seo?.keywords || post.metadata?.tags || [];

    if (keywords.length === 0) {
      score -= 30;
      suggestions.push({
        category: 'keywords',
        severity: 'warning',
        message: 'No keywords/tags defined. Add 3-5 relevant keywords.',
        impact: 6,
      });
      weaknesses.push('No keywords');
    } else if (keywords.length < 3) {
      score -= 15;
      suggestions.push({
        category: 'keywords',
        severity: 'info',
        message: `Only ${keywords.length} keyword(s). Add more relevant keywords (3-5 recommended).`,
        impact: 3,
      });
    } else if (keywords.length > 7) {
      score -= 10;
      suggestions.push({
        category: 'keywords',
        severity: 'info',
        message: `Too many keywords (${keywords.length}). Focus on 3-5 most relevant keywords.`,
        impact: 2,
      });
    } else {
      strengths.push('Good keyword coverage');
    }

    // Check if main keyword appears in title
    if (keywords.length > 0) {
      const mainKeyword = keywords[0].toLowerCase();
      const title = (post.seo?.title || post.title).toLowerCase();
      if (!title.includes(mainKeyword)) {
        score -= 20;
        suggestions.push({
          category: 'keywords',
          severity: 'warning',
          message: `Main keyword "${keywords[0]}" doesn't appear in title.`,
          impact: 5,
        });
      } else {
        strengths.push('Main keyword in title');
      }
    }

    return Math.max(0, score);
  }

  private analyzeReadability(
    post: BlogPost,
    suggestions: SEOSuggestion[],
    strengths: string[],
    weaknesses: string[]
  ): number {
    let score = 100;
    const content = post.content;

    // Check paragraph length
    const paragraphs = content.split('\n\n').filter((p) => p.trim().length > 0);
    const longParagraphs = paragraphs.filter(
      (p) => p.split(/\s+/).length > 150
    );

    if (longParagraphs.length > 0) {
      score -= 15;
      suggestions.push({
        category: 'readability',
        severity: 'info',
        message: `${longParagraphs.length} paragraph(s) are too long. Break them into shorter paragraphs.`,
        impact: 3,
      });
    }

    // Check sentence length (rough estimate)
    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const avgWordsPerSentence = content.split(/\s+/).length / sentences.length;

    if (avgWordsPerSentence > 20) {
      score -= 10;
      suggestions.push({
        category: 'readability',
        severity: 'info',
        message:
          'Sentences are too long on average. Use shorter sentences for better readability.',
        impact: 2,
      });
    } else {
      strengths.push('Good sentence length');
    }

    // Check for lists
    const lists = content.match(/^[\*\-\+\d]\.\s+.+$/gm) || [];
    if (lists.length === 0) {
      score -= 10;
      suggestions.push({
        category: 'readability',
        severity: 'info',
        message:
          'No lists found. Use bullet points or numbered lists to improve readability.',
        impact: 2,
      });
    } else {
      strengths.push('Uses lists for readability');
    }

    return Math.max(0, score);
  }

  private analyzeTechnical(
    post: BlogPost,
    suggestions: SEOSuggestion[],
    strengths: string[],
    weaknesses: string[]
  ): number {
    let score = 100;

    // Check for slug optimization
    if (post.slug) {
      if (post.slug.length > 50) {
        score -= 10;
        suggestions.push({
          category: 'technical',
          severity: 'info',
          message: 'URL slug is too long. Keep it concise.',
          impact: 2,
        });
      } else {
        strengths.push('Optimized URL slug');
      }
    }

    // Check for featured image
    if (!post.metadata?.featuredImage) {
      score -= 15;
      suggestions.push({
        category: 'technical',
        severity: 'warning',
        message:
          'No featured image set. Add a featured image for social sharing.',
        impact: 4,
      });
      weaknesses.push('No featured image');
    } else {
      strengths.push('Has featured image');

      // Check for alt text
      if (!post.metadata?.featuredImageAlt) {
        score -= 10;
        suggestions.push({
          category: 'technical',
          severity: 'warning',
          message:
            'Featured image missing alt text. Add alt text for accessibility and SEO.',
          impact: 3,
        });
      }
    }

    // Check for Open Graph metadata
    if (!post.seo?.ogTitle && !post.seo?.ogDescription) {
      score -= 10;
      suggestions.push({
        category: 'technical',
        severity: 'info',
        message:
          'No Open Graph metadata. Add OG tags for better social sharing.',
        impact: 3,
      });
    } else {
      strengths.push('Has Open Graph metadata');
    }

    // Check publication date
    if (!post.publishedAt) {
      score -= 5;
      suggestions.push({
        category: 'technical',
        severity: 'info',
        message: 'No publication date set.',
        impact: 1,
      });
    }

    return Math.max(0, score);
  }

  /**
   * Get SEO score color based on score value
   */
  getScoreColor(score: number): string {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  }

  /**
   * Get SEO score label based on score value
   */
  getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 60) return 'Needs Improvement';
    return 'Poor';
  }
}

export const seoAnalyzer = new SEOAnalyzer();
