import { describe, it, expect } from 'vitest';
import {
  calculateLexicalDiversity,
  countTransitionWords,
  calculateContentStructureScore,
  calculateContentDepthScore,
  calculateEngagementScore,
  calculateReadingTime,
  analyzeContentQuality,
  getContentQualitySuggestions,
} from './content';

describe('content', () => {
  describe('calculateLexicalDiversity', () => {
    it('returns 0 for empty array', () => {
      expect(calculateLexicalDiversity([])).toBe(0);
    });

    it('returns 100 for all unique words', () => {
      expect(calculateLexicalDiversity(['the', 'cat', 'sat'])).toBe(100);
    });

    it('returns lower score for repeated words', () => {
      const result = calculateLexicalDiversity(['the', 'the', 'the', 'cat']);
      expect(result).toBeLessThan(100);
      expect(result).toBe(50); // 2 unique / 4 total * 100
    });
  });

  describe('countTransitionWords', () => {
    it('counts common transition words', () => {
      const text =
        'However, this is important. Furthermore, we should note that. Therefore, it follows.';
      expect(countTransitionWords(text)).toBe(3);
    });

    it('counts multi-word transitions', () => {
      const text =
        'For example, this works. In addition, it helps. On the other hand, we should consider.';
      expect(countTransitionWords(text)).toBeGreaterThanOrEqual(2);
    });

    it('returns 0 for text without transitions', () => {
      expect(countTransitionWords('The cat sat on the mat.')).toBe(0);
    });

    it('is case-insensitive', () => {
      expect(countTransitionWords('HOWEVER, this matters.')).toBe(1);
    });
  });

  describe('calculateContentStructureScore', () => {
    it('returns base score for minimal content', () => {
      const score = calculateContentStructureScore({
        paragraphCount: 1,
        listCount: 0,
        codeBlockCount: 0,
        wordCount: 100,
        headingCount: 0,
      });
      expect(score).toBeGreaterThanOrEqual(50);
    });

    it('gives higher score for well-structured content', () => {
      const structured = calculateContentStructureScore({
        paragraphCount: 5,
        listCount: 3,
        codeBlockCount: 2,
        wordCount: 600,
        headingCount: 3,
      });
      const minimal = calculateContentStructureScore({
        paragraphCount: 1,
        listCount: 0,
        codeBlockCount: 0,
        wordCount: 600,
        headingCount: 0,
      });
      expect(structured).toBeGreaterThan(minimal);
    });

    it('clamps between 0 and 100', () => {
      const score = calculateContentStructureScore({
        paragraphCount: 50,
        listCount: 20,
        codeBlockCount: 10,
        wordCount: 100,
        headingCount: 20,
      });
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateContentDepthScore', () => {
    it('gives higher score for longer content', () => {
      const long = calculateContentDepthScore({
        wordCount: 2500,
        uniqueWords: 1000,
        sentenceCount: 125,
        paragraphCount: 25,
        transitionWords: 40,
      });
      const short = calculateContentDepthScore({
        wordCount: 200,
        uniqueWords: 100,
        sentenceCount: 15,
        paragraphCount: 3,
        transitionWords: 2,
      });
      expect(long).toBeGreaterThan(short);
    });

    it('rewards ideal lexical diversity (40-60%)', () => {
      const ideal = calculateContentDepthScore({
        wordCount: 1000,
        uniqueWords: 500, // 50% diversity
        sentenceCount: 60,
        paragraphCount: 12,
        transitionWords: 15,
      });
      expect(ideal).toBeGreaterThan(50);
    });

    it('clamps between 0 and 100', () => {
      const score = calculateContentDepthScore({
        wordCount: 5000,
        uniqueWords: 2500,
        sentenceCount: 250,
        paragraphCount: 50,
        transitionWords: 100,
      });
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateEngagementScore', () => {
    it('starts with base score of 40', () => {
      const score = calculateEngagementScore({
        questionCount: 0,
        exclamationCount: 0,
        listCount: 0,
        codeBlockCount: 0,
        imageCount: 0,
        wordCount: 100,
      });
      expect(score).toBe(40);
    });

    it('increases with questions', () => {
      const withQuestions = calculateEngagementScore({
        questionCount: 3,
        exclamationCount: 0,
        listCount: 0,
        codeBlockCount: 0,
        imageCount: 0,
        wordCount: 100,
      });
      expect(withQuestions).toBeGreaterThan(40);
    });

    it('increases with moderate exclamations', () => {
      const moderate = calculateEngagementScore({
        questionCount: 0,
        exclamationCount: 2,
        listCount: 0,
        codeBlockCount: 0,
        imageCount: 0,
        wordCount: 100,
      });
      expect(moderate).toBeGreaterThan(40);
    });

    it('penalizes excessive exclamations', () => {
      const moderate = calculateEngagementScore({
        questionCount: 0,
        exclamationCount: 2,
        listCount: 0,
        codeBlockCount: 0,
        imageCount: 0,
        wordCount: 100,
      });
      const excessive = calculateEngagementScore({
        questionCount: 0,
        exclamationCount: 10,
        listCount: 0,
        codeBlockCount: 0,
        imageCount: 0,
        wordCount: 100,
      });
      expect(moderate).toBeGreaterThanOrEqual(excessive);
    });

    it('increases with lists, code blocks, and images', () => {
      const rich = calculateEngagementScore({
        questionCount: 2,
        exclamationCount: 1,
        listCount: 3,
        codeBlockCount: 2,
        imageCount: 3,
        wordCount: 500,
      });
      expect(rich).toBeGreaterThan(60);
    });

    it('clamps at 100', () => {
      const score = calculateEngagementScore({
        questionCount: 10,
        exclamationCount: 3,
        listCount: 10,
        codeBlockCount: 10,
        imageCount: 10,
        wordCount: 100,
      });
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateReadingTime', () => {
    it('returns 1 minute for short content', () => {
      expect(calculateReadingTime(100)).toBe(1);
    });

    it('calculates at 200 WPM by default', () => {
      expect(calculateReadingTime(400)).toBe(2);
      expect(calculateReadingTime(1000)).toBe(5);
    });

    it('accepts custom WPM', () => {
      expect(calculateReadingTime(300, 100)).toBe(3);
    });

    it('rounds up', () => {
      expect(calculateReadingTime(201)).toBe(2);
    });
  });

  describe('analyzeContentQuality', () => {
    const sampleContent =
      '## Introduction\n\n' +
      'This is a comprehensive guide about web development. ' +
      'However, there are many things to consider. ' +
      'Furthermore, the landscape is always changing.\n\n' +
      '## Main Section\n\n' +
      'Web development involves HTML, CSS, and JavaScript. ' +
      'For example, you can build interactive websites. ' +
      'Additionally, frameworks like React help simplify the process.\n\n' +
      '- First item\n- Second item\n- Third item\n\n' +
      '```js\nconst app = express();\n```\n\n' +
      'What are the best practices? We should always test our code.';

    it('returns all required metrics', () => {
      const result = analyzeContentQuality(sampleContent);
      expect(result).toHaveProperty('wordCount');
      expect(result).toHaveProperty('uniqueWords');
      expect(result).toHaveProperty('lexicalDiversity');
      expect(result).toHaveProperty('paragraphCount');
      expect(result).toHaveProperty('sentenceCount');
      expect(result).toHaveProperty('listCount');
      expect(result).toHaveProperty('codeBlockCount');
      expect(result).toHaveProperty('contentStructureScore');
      expect(result).toHaveProperty('transitionWords');
      expect(result).toHaveProperty('contentDepthScore');
      expect(result).toHaveProperty('engagementScore');
      expect(result).toHaveProperty('readingTime');
      expect(result).toHaveProperty('questionCount');
    });

    it('counts words', () => {
      const result = analyzeContentQuality(sampleContent);
      expect(result.wordCount).toBeGreaterThan(30);
    });

    it('detects code blocks', () => {
      const result = analyzeContentQuality(sampleContent);
      expect(result.codeBlockCount).toBe(1);
    });

    it('detects list items', () => {
      const result = analyzeContentQuality(sampleContent);
      expect(result.listCount).toBe(3);
    });

    it('detects questions', () => {
      const result = analyzeContentQuality(sampleContent);
      expect(result.questionCount).toBeGreaterThanOrEqual(1);
    });

    it('counts transition words', () => {
      const result = analyzeContentQuality(sampleContent);
      expect(result.transitionWords).toBeGreaterThan(0);
    });

    it('handles empty content', () => {
      const result = analyzeContentQuality('');
      expect(result.wordCount).toBe(0);
      expect(result.readingTime).toBe(0);
    });
  });

  describe('getContentQualitySuggestions', () => {
    it('suggests expanding short content', () => {
      const metrics = analyzeContentQuality('Short post.');
      const suggestions = getContentQualitySuggestions(metrics);
      expect(suggestions.some((s) => s.includes('short'))).toBe(true);
    });

    it('suggests breaking up very long content', () => {
      const longContent = Array(3100).fill('word').join(' ') + '.';
      const metrics = analyzeContentQuality(longContent);
      const suggestions = getContentQualitySuggestions(metrics);
      expect(
        suggestions.some(
          (s) => s.includes('breaking') || s.includes('multiple')
        )
      ).toBe(true);
    });

    it('suggests lists for long content without them', () => {
      const content = Array(100).fill('This is a sentence.').join(' ');
      const metrics = analyzeContentQuality(content);
      const suggestions = getContentQualitySuggestions(metrics);
      if (metrics.wordCount > 500 && metrics.listCount === 0) {
        expect(suggestions.some((s) => s.includes('list'))).toBe(true);
      }
    });

    it('suggests transition words when lacking', () => {
      const content = Array(200).fill('Simple sentence.').join(' ');
      const metrics = analyzeContentQuality(content);
      const suggestions = getContentQualitySuggestions(metrics);
      expect(suggestions.some((s) => s.includes('transition'))).toBe(true);
    });

    it('warns about long reading time', () => {
      const longContent = Array(4000).fill('word').join(' ') + '.';
      const metrics = analyzeContentQuality(longContent);
      const suggestions = getContentQualitySuggestions(metrics);
      if (metrics.readingTime > 15) {
        expect(suggestions.some((s) => s.includes('Long read'))).toBe(true);
      }
    });
  });
});
