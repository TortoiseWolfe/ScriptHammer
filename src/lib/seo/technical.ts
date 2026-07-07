/**
 * Technical SEO Analysis Module
 * Validates technical SEO aspects like meta tags, URLs, and structured data
 */

export interface TechnicalSEOMetrics {
  titleLength: number;
  titleValid: boolean;
  metaDescriptionLength: number;
  metaDescriptionValid: boolean;
  slugOptimized: boolean;
  slugLength: number;
  headingHierarchy: {
    valid: boolean;
    h1Count: number;
    issues: string[];
  };
  imageAltTextCoverage: number;
  openGraphValid: boolean;
  structuredDataPresent: boolean;
  internalLinks: number;
  externalLinks: number;
}

/**
 * Check if title length is optimal for SEO
 * Optimal: 50-60 characters
 */
export function validateTitleLength(title: string): {
  valid: boolean;
  length: number;
  message: string;
} {
  const length = title.length;
  let valid = true;
  let message = '';

  if (length < 30) {
    valid = false;
    message = 'Title is too short. Aim for 50-60 characters.';
  } else if (length > 60) {
    valid = false;
    message = 'Title is too long. It may be truncated in search results.';
  } else if (length < 50) {
    message = 'Title could be longer for better SEO impact.';
  } else {
    message = 'Title length is optimal.';
  }

  return { valid, length, message };
}

/**
 * Validate meta description length
 * Optimal: 150-160 characters
 */
export function validateMetaDescription(description: string): {
  valid: boolean;
  length: number;
  message: string;
} {
  const length = description.length;
  let valid = true;
  let message = '';

  if (length === 0) {
    valid = false;
    message = 'Meta description is missing.';
  } else if (length < 120) {
    valid = false;
    message = 'Meta description is too short. Aim for 150-160 characters.';
  } else if (length > 160) {
    valid = false;
    message =
      'Meta description is too long. It will be truncated in search results.';
  } else if (length < 150) {
    message = 'Meta description could be slightly longer.';
  } else {
    message = 'Meta description length is optimal.';
  }

  return { valid, length, message };
}

/**
 * Check if slug is SEO-optimized
 */
export function validateSlug(slug: string): {
  optimized: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check length
  if (slug.length > 50) {
    issues.push('Slug is too long. Keep it under 50 characters.');
  }

  // Check for uppercase letters
  if (slug !== slug.toLowerCase()) {
    issues.push('Slug contains uppercase letters. Use lowercase only.');
  }

  // Check for special characters
  if (!/^[a-z0-9-]+$/.test(slug)) {
    issues.push(
      'Slug contains invalid characters. Use only lowercase letters, numbers, and hyphens.'
    );
  }

  // Check for consecutive hyphens
  if (/--+/.test(slug)) {
    issues.push('Slug contains consecutive hyphens.');
  }

  // Check for leading/trailing hyphens
  if (slug.startsWith('-') || slug.endsWith('-')) {
    issues.push('Slug should not start or end with a hyphen.');
  }

  // Check for stop words (common ones)
  const stopWords = [
    'a',
    'an',
    'the',
    'of',
    'in',
    'to',
    'for',
    'and',
    'or',
    'but',
  ];
  const slugWords = slug.split('-');
  const hasStopWords = slugWords.some((word) => stopWords.includes(word));
  if (hasStopWords) {
    issues.push('Consider removing common stop words from slug.');
  }

  return {
    optimized: issues.length === 0,
    issues,
  };
}

/**
 * Validate heading hierarchy
 */
export function validateHeadingHierarchy(content: string): {
  valid: boolean;
  h1Count: number;
  issues: string[];
} {
  const issues: string[] = [];

  // Extract headings from markdown
  const headingPattern = /^(#{1,6})\s+(.+)$/gm;
  const headings: { level: number; text: string }[] = [];

  let match;
  while ((match = headingPattern.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2],
    });
  }

  // Count H1s
  const h1Count = headings.filter((h) => h.level === 1).length;

  if (h1Count === 0) {
    issues.push('No H1 heading found. Every page should have exactly one H1.');
  } else if (h1Count > 1) {
    issues.push(`Found ${h1Count} H1 headings. Use only one H1 per page.`);
  }

  // Check hierarchy
  let previousLevel = 0;
  headings.forEach((heading) => {
    if (heading.level > previousLevel + 1 && previousLevel !== 0) {
      issues.push(
        `Heading hierarchy broken: H${heading.level} follows H${previousLevel}`
      );
    }
    previousLevel = heading.level;
  });

  // Check for empty headings
  headings.forEach((heading) => {
    if (heading.text.trim().length === 0) {
      issues.push(`Empty H${heading.level} heading found`);
    }
  });

  return {
    valid: issues.length === 0,
    h1Count,
    issues,
  };
}

/**
 * Check image alt text coverage
 */
export function checkImageAltText(content: string): {
  coverage: number;
  totalImages: number;
  imagesWithAlt: number;
  issues: string[];
} {
  const issues: string[] = [];

  // Match markdown images: ![alt text](url)
  const imagePattern = /!\[([^\]]*)\]\([^)]+\)/g;
  const images: string[] = [];

  let match;
  while ((match = imagePattern.exec(content)) !== null) {
    images.push(match[1]);
  }

  const totalImages = images.length;
  const imagesWithAlt = images.filter((alt) => alt.trim().length > 0).length;
  const coverage = totalImages > 0 ? (imagesWithAlt / totalImages) * 100 : 100;

  if (totalImages > 0 && imagesWithAlt < totalImages) {
    issues.push(
      `${totalImages - imagesWithAlt} images are missing alt text for accessibility and SEO.`
    );
  }

  images.forEach((alt, index) => {
    if (alt.trim().length > 125) {
      issues.push(
        `Image ${index + 1} has alt text that's too long (${alt.length} chars). Keep under 125 characters.`
      );
    }
  });

  return {
    coverage: Math.round(coverage),
    totalImages,
    imagesWithAlt,
    issues,
  };
}

/**
 * Check for Open Graph tags in frontmatter
 */
export function validateOpenGraph(
  frontmatter: Record<string, string | string[] | number | boolean | undefined>
): {
  valid: boolean;
  missingTags: string[];
} {
  const requiredTags = ['title', 'excerpt', 'ogImage'];
  const missingTags: string[] = [];

  requiredTags.forEach((tag) => {
    if (
      !frontmatter[tag] ||
      (typeof frontmatter[tag] === 'string' &&
        frontmatter[tag].trim().length === 0)
    ) {
      missingTags.push(tag);
    }
  });

  return {
    valid: missingTags.length === 0,
    missingTags,
  };
}

/**
 * Count internal and external links
 */
export function analyzeLinks(content: string): {
  internal: number;
  external: number;
  issues: string[];
} {
  const issues: string[] = [];

  // Match markdown links: [text](url)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let internalCount = 0;
  let externalCount = 0;

  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const url = match[2];

    if (url.startsWith('http://') || url.startsWith('https://')) {
      externalCount++;

      // Check if external link is HTTPS
      if (url.startsWith('http://')) {
        issues.push(`External link "${url}" should use HTTPS`);
      }
    } else if (
      url.startsWith('/') ||
      url.startsWith('#') ||
      !url.includes('://')
    ) {
      internalCount++;
    }
  }

  if (internalCount === 0) {
    issues.push(
      'No internal links found. Consider linking to related content.'
    );
  }

  if (externalCount > 10) {
    issues.push('Too many external links. This might dilute page authority.');
  }

  return {
    internal: internalCount,
    external: externalCount,
    issues,
  };
}

/**
 * Analyze technical SEO aspects
 */
export function analyzeTechnicalSEO(
  content: string,
  frontmatter: {
    title?: string;
    excerpt?: string;
    slug?: string;
    ogImage?: string;
    [key: string]: string | string[] | number | boolean | undefined;
  }
): TechnicalSEOMetrics {
  const titleValidation = validateTitleLength(frontmatter.title || '');
  const descValidation = validateMetaDescription(frontmatter.excerpt || '');
  const slugValidation = validateSlug(frontmatter.slug || '');
  const headingValidation = validateHeadingHierarchy(content);
  const imageAnalysis = checkImageAltText(content);
  const openGraphValidation = validateOpenGraph(frontmatter);
  const linkAnalysis = analyzeLinks(content);

  return {
    titleLength: titleValidation.length,
    titleValid: titleValidation.valid,
    metaDescriptionLength: descValidation.length,
    metaDescriptionValid: descValidation.valid,
    slugOptimized: slugValidation.optimized,
    slugLength: (frontmatter.slug || '').length,
    headingHierarchy: headingValidation,
    imageAltTextCoverage: imageAnalysis.coverage,
    openGraphValid: openGraphValidation.valid,
    structuredDataPresent: false, // Would need to check for JSON-LD in the page
    internalLinks: linkAnalysis.internal,
    externalLinks: linkAnalysis.external,
  };
}

/**
 * Get technical SEO suggestions
 */
export function getTechnicalSEOSuggestions(
  metrics: TechnicalSEOMetrics,
  frontmatter: Record<string, string | string[] | number | boolean | undefined>
): string[] {
  const suggestions: string[] = [];

  // Title suggestions
  if (!metrics.titleValid) {
    const titleValidation = validateTitleLength(
      String(frontmatter.title || '')
    );
    suggestions.push(titleValidation.message);
  }

  // Meta description suggestions
  if (!metrics.metaDescriptionValid) {
    const descValidation = validateMetaDescription(
      String(frontmatter.excerpt || '')
    );
    suggestions.push(descValidation.message);
  }

  // Slug suggestions
  if (!metrics.slugOptimized) {
    const slugValidation = validateSlug(String(frontmatter.slug || ''));
    slugValidation.issues.forEach((issue) => suggestions.push(issue));
  }

  // Heading hierarchy suggestions
  if (!metrics.headingHierarchy.valid) {
    metrics.headingHierarchy.issues.forEach((issue) => suggestions.push(issue));
  }

  // Image alt text suggestions
  if (metrics.imageAltTextCoverage < 100) {
    const imageAnalysis = checkImageAltText(String(frontmatter.content || ''));
    imageAnalysis.issues.forEach((issue) => suggestions.push(issue));
  }

  // Open Graph suggestions
  if (!metrics.openGraphValid) {
    const ogValidation = validateOpenGraph(frontmatter);
    if (ogValidation.missingTags.length > 0) {
      suggestions.push(
        `Missing Open Graph tags: ${ogValidation.missingTags.join(', ')}`
      );
    }
  }

  // Link suggestions
  if (metrics.internalLinks === 0) {
    suggestions.push('Add internal links to related content for better SEO.');
  }

  if (metrics.externalLinks > 10) {
    suggestions.push(
      'Consider reducing external links to maintain page authority.'
    );
  }

  return suggestions;
}
