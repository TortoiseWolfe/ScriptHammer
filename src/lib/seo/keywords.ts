/**
 * Keyword Analysis Module
 * Analyzes keyword usage, density, and distribution
 */

export interface KeywordMetrics {
  primaryKeyword: string;
  keywordDensity: number;
  keywordInTitle: boolean;
  keywordInFirstParagraph: boolean;
  keywordInHeadings: number;
  keywordDistribution: number[];
  keywordProminence: number;
  relatedKeywords: string[];
  lsiKeywords: string[];
  keywordStuffing: boolean;
}

/**
 * Calculate keyword density (keyword occurrences / total words * 100)
 */
export function calculateKeywordDensity(
  content: string,
  keyword: string
): { density: number; count: number; totalWords: number } {
  if (!keyword || keyword.trim().length === 0) {
    return { density: 0, count: 0, totalWords: 0 };
  }

  const cleanContent = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanContent.split(' ').filter((w) => w.length > 0);
  const totalWords = words.length;

  // Handle multi-word keywords
  const keywordLower = keyword.toLowerCase().trim();
  const keywordWords = keywordLower.split(' ').filter((w) => w.length > 0);

  let count = 0;

  if (keywordWords.length === 1) {
    // Single word keyword
    count = words.filter((w) => w === keywordLower).length;
  } else {
    // Multi-word keyword - check for phrase occurrences
    const pattern = new RegExp(
      `\\b${keywordLower.replace(/\s+/g, '\\s+')}\\b`,
      'gi'
    );
    const matches = cleanContent.match(pattern);
    count = matches ? matches.length : 0;
  }

  const density = totalWords > 0 ? (count / totalWords) * 100 : 0;

  return {
    density: Math.round(density * 100) / 100,
    count,
    totalWords,
  };
}

/**
 * Check if keyword appears in title
 */
export function checkKeywordInTitle(title: string, keyword: string): boolean {
  if (!title || !keyword) return false;
  return title.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * Check if keyword appears in first paragraph
 */
export function checkKeywordInFirstParagraph(
  content: string,
  keyword: string
): boolean {
  if (!content || !keyword) return false;

  // Extract first paragraph (before first double newline or first 200 chars)
  const paragraphs = content.split(/\n\n+/);
  const firstParagraph = paragraphs[0] || content.substring(0, 200);

  return firstParagraph.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * Count keyword occurrences in headings
 */
export function countKeywordInHeadings(
  content: string,
  keyword: string
): number {
  if (!content || !keyword) return 0;

  const headingPattern = /^#{1,6}\s+(.+)$/gm;
  let count = 0;
  let match;

  while ((match = headingPattern.exec(content)) !== null) {
    if (match[1].toLowerCase().includes(keyword.toLowerCase())) {
      count++;
    }
  }

  return count;
}

/**
 * Calculate keyword distribution throughout content
 * Returns array of keyword counts per content section
 */
export function calculateKeywordDistribution(
  content: string,
  keyword: string
): number[] {
  if (!content || !keyword) return [];

  // Split content into roughly equal sections (4 quarters)
  const words = content.split(/\s+/);
  const sectionSize = Math.ceil(words.length / 4);
  const distribution: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sectionWords = words.slice(i * sectionSize, (i + 1) * sectionSize);
    const sectionText = sectionWords.join(' ');
    const keywordPattern = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
    const matches = sectionText.toLowerCase().match(keywordPattern);
    distribution.push(matches ? matches.length : 0);
  }

  return distribution;
}

/**
 * Calculate keyword prominence (how early the keyword appears)
 * Score from 0-100, higher means keyword appears earlier
 */
export function calculateKeywordProminence(
  content: string,
  keyword: string
): number {
  if (!content || !keyword) return 0;

  const lowerContent = content.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const position = lowerContent.indexOf(lowerKeyword);

  if (position === -1) return 0;

  // Calculate prominence as percentage (100% = at start, 0% = at end)
  const prominence = ((content.length - position) / content.length) * 100;

  return Math.round(prominence);
}

/**
 * Extract potential related keywords (2-3 word phrases)
 */
export function extractRelatedKeywords(
  content: string,
  primaryKeyword: string
): string[] {
  const cleanContent = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanContent.split(' ');
  const phrases = new Map<string, number>();

  // Extract 2-word and 3-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    // 2-word phrases
    const twoWord = `${words[i]} ${words[i + 1]}`;
    if (
      !twoWord.includes(primaryKeyword.toLowerCase()) &&
      words[i].length > 2 &&
      words[i + 1].length > 2
    ) {
      phrases.set(twoWord, (phrases.get(twoWord) || 0) + 1);
    }

    // 3-word phrases
    if (i < words.length - 2) {
      const threeWord = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      if (
        !threeWord.includes(primaryKeyword.toLowerCase()) &&
        words[i].length > 2 &&
        words[i + 1].length > 2 &&
        words[i + 2].length > 2
      ) {
        phrases.set(threeWord, (phrases.get(threeWord) || 0) + 1);
      }
    }
  }

  // Sort by frequency and return top 5
  return Array.from(phrases.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);
}

/**
 * Generate LSI (Latent Semantic Indexing) keyword suggestions
 * These are contextually related terms based on the primary keyword
 */
export function generateLSIKeywords(
  primaryKeyword: string,
  content: string
): string[] {
  // This is a simplified version. In production, you might use an API or ML model
  const lsiMap: { [key: string]: string[] } = {
    seo: [
      'search engine',
      'optimization',
      'ranking',
      'keywords',
      'content',
      'google',
      'serp',
    ],
    blog: [
      'post',
      'article',
      'content',
      'writing',
      'publish',
      'readers',
      'audience',
    ],
    react: [
      'component',
      'hooks',
      'state',
      'props',
      'jsx',
      'virtual dom',
      'lifecycle',
    ],
    nextjs: ['react', 'ssr', 'static', 'routing', 'api', 'vercel', 'framework'],
    typescript: [
      'types',
      'interface',
      'generic',
      'javascript',
      'type safety',
      'compiler',
    ],
  };

  const lsiKeywords: string[] = [];
  const keywordLower = primaryKeyword.toLowerCase();

  // Check if we have predefined LSI keywords
  Object.keys(lsiMap).forEach((key) => {
    if (keywordLower.includes(key)) {
      lsiKeywords.push(...lsiMap[key]);
    }
  });

  // Extract contextual words from content (nouns and important terms)
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4); // Filter short words

  // Find frequently occurring words near the primary keyword
  const keywordPositions: number[] = [];
  words.forEach((word, index) => {
    if (word === keywordLower || primaryKeyword.toLowerCase().includes(word)) {
      keywordPositions.push(index);
    }
  });

  const contextWords = new Set<string>();
  keywordPositions.forEach((pos) => {
    // Get words within 5 positions of the keyword
    for (
      let i = Math.max(0, pos - 5);
      i < Math.min(words.length, pos + 6);
      i++
    ) {
      if (
        i !== pos &&
        words[i].length > 4 &&
        !words[i].includes(keywordLower)
      ) {
        contextWords.add(words[i]);
      }
    }
  });

  lsiKeywords.push(...Array.from(contextWords).slice(0, 5));

  // Remove duplicates and return
  return [...new Set(lsiKeywords)].slice(0, 10);
}

/**
 * Check for keyword stuffing
 */
export function checkKeywordStuffing(density: number): boolean {
  // Generally, keyword density above 3% is considered stuffing
  return density > 3;
}

/**
 * Analyze keyword usage in content
 */
export function analyzeKeywords(
  content: string,
  frontmatter: {
    title?: string;
    excerpt?: string;
    tags?: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  },
  primaryKeyword: string
): KeywordMetrics {
  // Clean keyword
  const keyword = primaryKeyword.trim();

  if (!keyword) {
    // Try to extract from tags or title
    const extractedKeyword =
      frontmatter.tags?.[0] ||
      frontmatter.title?.split(' ').slice(0, 2).join(' ') ||
      '';
    return analyzeKeywords(content, frontmatter, extractedKeyword);
  }

  const densityResult = calculateKeywordDensity(content, keyword);
  const keywordInTitle = checkKeywordInTitle(frontmatter.title || '', keyword);
  const keywordInFirstParagraph = checkKeywordInFirstParagraph(
    content,
    keyword
  );
  const keywordInHeadings = countKeywordInHeadings(content, keyword);
  const keywordDistribution = calculateKeywordDistribution(content, keyword);
  const keywordProminence = calculateKeywordProminence(content, keyword);
  const relatedKeywords = extractRelatedKeywords(content, keyword);
  const lsiKeywords = generateLSIKeywords(keyword, content);
  const keywordStuffing = checkKeywordStuffing(densityResult.density);

  return {
    primaryKeyword: keyword,
    keywordDensity: densityResult.density,
    keywordInTitle,
    keywordInFirstParagraph,
    keywordInHeadings,
    keywordDistribution,
    keywordProminence,
    relatedKeywords,
    lsiKeywords,
    keywordStuffing,
  };
}

/**
 * Get keyword optimization suggestions
 */
export function getKeywordSuggestions(metrics: KeywordMetrics): string[] {
  const suggestions: string[] = [];

  // Keyword density suggestions
  if (metrics.keywordDensity === 0) {
    suggestions.push(
      `Primary keyword "${metrics.primaryKeyword}" not found in content.`
    );
  } else if (metrics.keywordDensity < 0.5) {
    suggestions.push(
      `Keyword density is low (${metrics.keywordDensity}%). Consider using the keyword more frequently.`
    );
  } else if (metrics.keywordDensity > 3) {
    suggestions.push(
      `Keyword density is high (${metrics.keywordDensity}%). Reduce usage to avoid keyword stuffing.`
    );
  }

  // Title optimization
  if (!metrics.keywordInTitle) {
    suggestions.push('Add your primary keyword to the title for better SEO.');
  }

  // First paragraph optimization
  if (!metrics.keywordInFirstParagraph) {
    suggestions.push('Include your primary keyword in the first paragraph.');
  }

  // Heading optimization
  if (metrics.keywordInHeadings === 0) {
    suggestions.push('Add your keyword to at least one heading (H2-H6).');
  }

  // Distribution suggestions
  const hasGoodDistribution = metrics.keywordDistribution.every(
    (count) => count > 0
  );
  if (!hasGoodDistribution) {
    suggestions.push(
      'Distribute your keyword more evenly throughout the content.'
    );
  }

  // Prominence suggestions
  if (metrics.keywordProminence < 50) {
    suggestions.push(
      'Try to use your keyword earlier in the content for better prominence.'
    );
  }

  // LSI keyword suggestions
  if (metrics.lsiKeywords.length > 0) {
    suggestions.push(
      `Consider using these related terms: ${metrics.lsiKeywords.slice(0, 3).join(', ')}`
    );
  }

  // Keyword stuffing warning
  if (metrics.keywordStuffing) {
    suggestions.push(
      '⚠️ Warning: Keyword stuffing detected. This may harm your SEO.'
    );
  }

  return suggestions;
}
