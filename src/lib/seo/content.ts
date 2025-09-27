/**
 * Content Quality Analysis Module
 * Analyzes content depth, structure, and engagement potential
 */

export interface ContentQualityMetrics {
  wordCount: number;
  uniqueWords: number;
  lexicalDiversity: number;
  paragraphCount: number;
  sentenceCount: number;
  listCount: number;
  codeBlockCount: number;
  contentStructureScore: number;
  transitionWords: number;
  contentDepthScore: number;
  engagementScore: number;
  readingTime: number;
  questionCount: number;
}

// Common transition words and phrases
const TRANSITION_WORDS = [
  'however',
  'therefore',
  'furthermore',
  'moreover',
  'meanwhile',
  'consequently',
  'nevertheless',
  'nonetheless',
  'accordingly',
  'additionally',
  'similarly',
  'likewise',
  'in addition',
  'as a result',
  'for example',
  'for instance',
  'in fact',
  'indeed',
  'in other words',
  'on the other hand',
  'in contrast',
  'on the contrary',
  'at the same time',
  'first',
  'second',
  'third',
  'finally',
  'next',
  'then',
  'above all',
  'after all',
  'in conclusion',
  'to summarize',
];

/**
 * Calculate lexical diversity (unique words / total words)
 */
export function calculateLexicalDiversity(words: string[]): number {
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  return words.length > 0 ? (uniqueWords.size / words.length) * 100 : 0;
}

/**
 * Count transition words in content
 */
export function countTransitionWords(content: string): number {
  const lowerContent = content.toLowerCase();
  let count = 0;

  TRANSITION_WORDS.forEach((transition) => {
    const pattern = new RegExp(`\\b${transition}\\b`, 'gi');
    const matches = lowerContent.match(pattern);
    if (matches) count += matches.length;
  });

  return count;
}

/**
 * Calculate content structure score based on various elements
 */
export function calculateContentStructureScore(metrics: {
  paragraphCount: number;
  listCount: number;
  codeBlockCount: number;
  wordCount: number;
  headingCount: number;
}): number {
  let score = 50; // Base score

  // Paragraph structure (ideal: 1 paragraph per 100-150 words)
  const idealParagraphs = Math.ceil(metrics.wordCount / 125);
  const paragraphDiff = Math.abs(idealParagraphs - metrics.paragraphCount);
  score += Math.max(0, 20 - paragraphDiff * 2);

  // Lists add structure
  if (metrics.listCount > 0) score += Math.min(15, metrics.listCount * 5);

  // Code blocks for technical content
  if (metrics.codeBlockCount > 0)
    score += Math.min(10, metrics.codeBlockCount * 3);

  // Headings for organization
  const idealHeadings = Math.ceil(metrics.wordCount / 300);
  if (metrics.headingCount >= idealHeadings) score += 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate content depth score
 */
export function calculateContentDepthScore(metrics: {
  wordCount: number;
  uniqueWords: number;
  sentenceCount: number;
  paragraphCount: number;
  transitionWords: number;
}): number {
  let score = 0;

  // Word count scoring (ideal: 1000-2500 words for in-depth content)
  if (metrics.wordCount >= 2500) {
    score += 30;
  } else if (metrics.wordCount >= 1500) {
    score += 25;
  } else if (metrics.wordCount >= 1000) {
    score += 20;
  } else if (metrics.wordCount >= 500) {
    score += 15;
  } else if (metrics.wordCount >= 300) {
    score += 10;
  } else {
    score += 5;
  }

  // Lexical diversity (ideal: 40-60%)
  const diversity = (metrics.uniqueWords / metrics.wordCount) * 100;
  if (diversity >= 40 && diversity <= 60) {
    score += 20;
  } else if (diversity >= 30 && diversity <= 70) {
    score += 15;
  } else {
    score += 10;
  }

  // Transition words (ideal: 1 per 50-75 words)
  const idealTransitions = Math.ceil(metrics.wordCount / 60);
  if (metrics.transitionWords >= idealTransitions) {
    score += 20;
  } else {
    score += Math.round((metrics.transitionWords / idealTransitions) * 20);
  }

  // Paragraph depth (ideal: 50-100 words per paragraph)
  const avgWordsPerParagraph = metrics.wordCount / metrics.paragraphCount;
  if (avgWordsPerParagraph >= 50 && avgWordsPerParagraph <= 100) {
    score += 15;
  } else if (avgWordsPerParagraph >= 30 && avgWordsPerParagraph <= 150) {
    score += 10;
  } else {
    score += 5;
  }

  // Sentence variety (ideal: 15-20 words per sentence)
  const avgWordsPerSentence = metrics.wordCount / metrics.sentenceCount;
  if (avgWordsPerSentence >= 15 && avgWordsPerSentence <= 20) {
    score += 15;
  } else if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) {
    score += 10;
  } else {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate engagement score based on content elements
 */
export function calculateEngagementScore(metrics: {
  questionCount: number;
  exclamationCount: number;
  listCount: number;
  codeBlockCount: number;
  imageCount: number;
  wordCount: number;
}): number {
  let score = 40; // Base score

  // Questions engage readers
  if (metrics.questionCount > 0) {
    score += Math.min(15, metrics.questionCount * 5);
  }

  // Exclamations show enthusiasm (but not too many)
  if (metrics.exclamationCount > 0 && metrics.exclamationCount <= 3) {
    score += 10;
  } else if (metrics.exclamationCount > 3) {
    score += Math.max(0, 10 - (metrics.exclamationCount - 3) * 2);
  }

  // Lists make content scannable
  if (metrics.listCount > 0) {
    score += Math.min(15, metrics.listCount * 5);
  }

  // Code blocks for technical audiences
  if (metrics.codeBlockCount > 0) {
    score += Math.min(10, metrics.codeBlockCount * 3);
  }

  // Images increase engagement
  if (metrics.imageCount > 0) {
    score += Math.min(20, metrics.imageCount * 5);
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate estimated reading time (words per minute)
 */
export function calculateReadingTime(
  wordCount: number,
  wpm: number = 200
): number {
  return Math.ceil(wordCount / wpm);
}

/**
 * Analyze content quality
 */
export function analyzeContentQuality(content: string): ContentQualityMetrics {
  // Clean content for analysis
  const cleanText = content
    .replace(/```[\s\S]*?```/g, '[CODE_BLOCK]') // Mark code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/![^\]]*\]\([^)]+\)/g, '[IMAGE]') // Mark images
    .replace(/^#{1,6}\s+/gm, '') // Remove heading markers
    .replace(/[*_~]/g, '') // Remove markdown formatting
    .trim();

  // Count various elements
  const paragraphs = cleanText
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);
  const sentences = cleanText
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0);
  const words = cleanText
    .split(/\s+/)
    .filter((w) => w.length > 0 && w !== '[CODE_BLOCK]' && w !== '[IMAGE]');

  // Count special elements in original content
  const codeBlockCount = (content.match(/```[\s\S]*?```/g) || []).length;
  const listCount =
    (content.match(/^[\s]*[-*+]\s+/gm) || []).length +
    (content.match(/^[\s]*\d+\.\s+/gm) || []).length;
  const imageCount = (content.match(/!\[([^\]]*)\]\([^)]+\)/g) || []).length;
  const headingCount = (content.match(/^#{1,6}\s+/gm) || []).length;
  const questionCount = (content.match(/\?/g) || []).length;
  const exclamationCount = (content.match(/!/g) || []).length;

  // Calculate metrics
  const wordCount = words.length;
  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  const lexicalDiversity = calculateLexicalDiversity(words);
  const transitionWords = countTransitionWords(cleanText);

  const contentStructureScore = calculateContentStructureScore({
    paragraphCount: paragraphs.length,
    listCount,
    codeBlockCount,
    wordCount,
    headingCount,
  });

  const contentDepthScore = calculateContentDepthScore({
    wordCount,
    uniqueWords,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    transitionWords,
  });

  const engagementScore = calculateEngagementScore({
    questionCount,
    exclamationCount,
    listCount,
    codeBlockCount,
    imageCount,
    wordCount,
  });

  const readingTime = calculateReadingTime(wordCount);

  return {
    wordCount,
    uniqueWords,
    lexicalDiversity: Math.round(lexicalDiversity * 10) / 10,
    paragraphCount: paragraphs.length,
    sentenceCount: sentences.length,
    listCount,
    codeBlockCount,
    contentStructureScore: Math.round(contentStructureScore),
    transitionWords,
    contentDepthScore: Math.round(contentDepthScore),
    engagementScore: Math.round(engagementScore),
    readingTime,
    questionCount,
  };
}

/**
 * Get content quality suggestions
 */
export function getContentQualitySuggestions(
  metrics: ContentQualityMetrics
): string[] {
  const suggestions: string[] = [];

  // Word count suggestions
  if (metrics.wordCount < 300) {
    suggestions.push(
      'Your content is quite short. Consider expanding to at least 300 words for better SEO.'
    );
  } else if (metrics.wordCount < 600) {
    suggestions.push(
      'Content could be more comprehensive. Aim for 600+ words for better search rankings.'
    );
  } else if (metrics.wordCount > 3000) {
    suggestions.push(
      'Consider breaking this into multiple posts for better user experience.'
    );
  }

  // Lexical diversity suggestions
  if (metrics.lexicalDiversity < 30) {
    suggestions.push(
      'Your vocabulary is repetitive. Try using more varied words and synonyms.'
    );
  } else if (metrics.lexicalDiversity > 70) {
    suggestions.push(
      'Your vocabulary might be too complex. Consider using some repeated key terms for clarity.'
    );
  }

  // Structure suggestions
  if (metrics.contentStructureScore < 50) {
    suggestions.push(
      'Improve content structure with more headings, lists, or paragraphs.'
    );
  }

  if (metrics.listCount === 0 && metrics.wordCount > 500) {
    suggestions.push(
      'Add bullet points or numbered lists to make content more scannable.'
    );
  }

  // Transition words
  if (metrics.transitionWords < Math.ceil(metrics.wordCount / 100)) {
    suggestions.push('Add more transition words to improve content flow.');
  }

  // Depth suggestions
  if (metrics.contentDepthScore < 50) {
    suggestions.push(
      'Content lacks depth. Consider adding more details, examples, or explanations.'
    );
  }

  // Engagement suggestions
  if (metrics.engagementScore < 50) {
    if (metrics.questionCount === 0) {
      suggestions.push('Consider adding questions to engage readers.');
    }
    if (metrics.listCount === 0) {
      suggestions.push('Add lists to make content more digestible.');
    }
  }

  // Reading time
  if (metrics.readingTime > 15) {
    suggestions.push(
      `Long read (${metrics.readingTime} min). Consider adding a table of contents or summary.`
    );
  }

  return suggestions;
}
