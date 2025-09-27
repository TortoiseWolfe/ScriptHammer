/**
 * Readability Analysis Module
 * Calculates various readability metrics for blog content
 */

export interface ReadabilityMetrics {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  averageSentenceLength: number;
  averageWordLength: number;
  syllableCount: number;
  passiveVoiceCount: number;
  paragraphCount: number;
  averageParagraphLength: number;
  readabilityLevel:
    | 'very-easy'
    | 'easy'
    | 'fairly-easy'
    | 'standard'
    | 'fairly-difficult'
    | 'difficult'
    | 'very-difficult';
}

/**
 * Count syllables in a word using basic English rules
 */
export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 0;

  // Subtract silent e
  if (word.endsWith('e') && !word.endsWith('le')) {
    count--;
  }

  // Handle special endings
  if (
    word.endsWith('les') &&
    !['ales', 'bles', 'cles', 'dles'].some((end) => word.endsWith(end))
  ) {
    count++;
  }

  // Ensure at least 1 syllable
  return Math.max(1, count);
}

/**
 * Calculate Flesch Reading Ease score
 * Score interpretation:
 * 90-100: Very Easy
 * 80-89: Easy
 * 70-79: Fairly Easy
 * 60-69: Standard
 * 50-59: Fairly Difficult
 * 30-49: Difficult
 * 0-29: Very Difficult
 */
export function calculateFleschReadingEase(
  totalWords: number,
  totalSentences: number,
  totalSyllables: number
): number {
  if (totalSentences === 0 || totalWords === 0) return 0;

  const averageWordsPerSentence = totalWords / totalSentences;
  const averageSyllablesPerWord = totalSyllables / totalWords;

  const score =
    206.835 - 1.015 * averageWordsPerSentence - 84.6 * averageSyllablesPerWord;

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Flesch-Kincaid Grade Level
 * Returns the U.S. school grade level needed to understand the text
 */
export function calculateFleschKincaidGrade(
  totalWords: number,
  totalSentences: number,
  totalSyllables: number
): number {
  if (totalSentences === 0 || totalWords === 0) return 0;

  const averageWordsPerSentence = totalWords / totalSentences;
  const averageSyllablesPerWord = totalSyllables / totalWords;

  const grade =
    0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59;

  // Clamp between 0 and 18 (PhD level)
  return Math.max(0, Math.min(18, grade));
}

/**
 * Detect passive voice in text
 * Returns count of passive voice constructions
 */
export function detectPassiveVoice(text: string): number {
  // Common passive voice patterns
  const passivePatterns = [
    /\b(is|are|was|were|been|being|be)\s+\w+ed\b/gi,
    /\b(is|are|was|were|been|being|be)\s+\w+en\b/gi,
    /\b(got|gets|getting)\s+\w+ed\b/gi,
    /\bby\s+\w+ing\b/gi,
  ];

  let count = 0;
  passivePatterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) count += matches.length;
  });

  return count;
}

/**
 * Get readability level based on Flesch Reading Ease score
 */
export function getReadabilityLevel(
  score: number
): ReadabilityMetrics['readabilityLevel'] {
  if (score >= 90) return 'very-easy';
  if (score >= 80) return 'easy';
  if (score >= 70) return 'fairly-easy';
  if (score >= 60) return 'standard';
  if (score >= 50) return 'fairly-difficult';
  if (score >= 30) return 'difficult';
  return 'very-difficult';
}

/**
 * Analyze readability of content
 */
export function analyzeReadability(content: string): ReadabilityMetrics {
  // Clean and prepare text
  const cleanText = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[#*_~]/g, '') // Remove markdown formatting
    .trim();

  // Split into sentences (basic sentence detection)
  const sentences = cleanText
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0);
  const totalSentences = sentences.length;

  // Split into paragraphs
  const paragraphs = cleanText
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);
  const paragraphCount = paragraphs.length;

  // Count words and syllables
  const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;

  let totalSyllables = 0;
  let totalWordLength = 0;

  words.forEach((word) => {
    const cleanWord = word.replace(/[^a-z]/gi, '');
    if (cleanWord.length > 0) {
      totalSyllables += countSyllables(cleanWord);
      totalWordLength += cleanWord.length;
    }
  });

  // Calculate metrics
  const fleschReadingEase = calculateFleschReadingEase(
    totalWords,
    totalSentences,
    totalSyllables
  );
  const fleschKincaidGrade = calculateFleschKincaidGrade(
    totalWords,
    totalSentences,
    totalSyllables
  );
  const averageSentenceLength =
    totalSentences > 0 ? totalWords / totalSentences : 0;
  const averageWordLength = totalWords > 0 ? totalWordLength / totalWords : 0;
  const averageParagraphLength =
    paragraphCount > 0 ? totalWords / paragraphCount : 0;
  const passiveVoiceCount = detectPassiveVoice(cleanText);
  const readabilityLevel = getReadabilityLevel(fleschReadingEase);

  return {
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
    averageWordLength: Math.round(averageWordLength * 10) / 10,
    syllableCount: totalSyllables,
    passiveVoiceCount,
    paragraphCount,
    averageParagraphLength: Math.round(averageParagraphLength * 10) / 10,
    readabilityLevel,
  };
}

/**
 * Get readability suggestions based on metrics
 */
export function getReadabilitySuggestions(
  metrics: ReadabilityMetrics
): string[] {
  const suggestions: string[] = [];

  // Flesch Reading Ease suggestions
  if (metrics.fleschReadingEase < 30) {
    suggestions.push(
      'Your content is very difficult to read. Consider simplifying sentences and using shorter words.'
    );
  } else if (metrics.fleschReadingEase < 50) {
    suggestions.push(
      'Your content is fairly difficult to read. Try breaking up long sentences.'
    );
  } else if (metrics.fleschReadingEase > 90) {
    suggestions.push(
      'Your content might be too simple. Consider adding more depth and detail.'
    );
  }

  // Grade level suggestions
  if (metrics.fleschKincaidGrade > 12) {
    suggestions.push(
      `Your content requires college-level reading ability (grade ${metrics.fleschKincaidGrade.toFixed(1)}). Consider simplifying for a wider audience.`
    );
  }

  // Sentence length suggestions
  if (metrics.averageSentenceLength > 20) {
    suggestions.push(
      'Your sentences are quite long. Aim for 15-20 words per sentence for better readability.'
    );
  } else if (metrics.averageSentenceLength < 10) {
    suggestions.push(
      'Your sentences are very short. Consider combining some for better flow.'
    );
  }

  // Passive voice suggestions
  if (metrics.passiveVoiceCount > 5) {
    suggestions.push(
      `Found ${metrics.passiveVoiceCount} instances of passive voice. Consider using active voice for more engaging content.`
    );
  }

  // Paragraph length suggestions
  if (metrics.averageParagraphLength > 150) {
    suggestions.push(
      'Your paragraphs are quite long. Break them up for easier reading.'
    );
  }

  return suggestions;
}
