import { describe, it, expect } from 'vitest';
import {
  countSyllables,
  calculateFleschReadingEase,
  calculateFleschKincaidGrade,
  detectPassiveVoice,
  getReadabilityLevel,
  analyzeReadability,
  getReadabilitySuggestions,
  type ReadabilityMetrics,
} from './readability';

describe('readability', () => {
  describe('countSyllables', () => {
    it('returns 1 for short words', () => {
      expect(countSyllables('the')).toBe(1);
      expect(countSyllables('cat')).toBe(1);
      expect(countSyllables('dog')).toBe(1);
    });

    it('counts syllables in multi-syllable words', () => {
      expect(countSyllables('hello')).toBe(2);
      expect(countSyllables('banana')).toBe(3);
      expect(countSyllables('computer')).toBe(3);
    });

    it('handles silent e', () => {
      expect(countSyllables('make')).toBe(1);
      expect(countSyllables('name')).toBe(1);
    });

    it('handles words with no vowels', () => {
      expect(countSyllables('gym')).toBe(1);
    });

    it('strips non-alpha characters', () => {
      expect(countSyllables("don't")).toBeGreaterThanOrEqual(1);
      expect(countSyllables('well-known')).toBeGreaterThanOrEqual(1);
    });

    it('returns 1 for empty/short input', () => {
      expect(countSyllables('')).toBe(1);
      expect(countSyllables('a')).toBe(1);
    });
  });

  describe('calculateFleschReadingEase', () => {
    it('returns 0 for zero sentences or words', () => {
      expect(calculateFleschReadingEase(0, 0, 0)).toBe(0);
      expect(calculateFleschReadingEase(100, 0, 150)).toBe(0);
      expect(calculateFleschReadingEase(0, 10, 0)).toBe(0);
    });

    it('returns high score for simple text', () => {
      // Short sentences, simple words: 10 words, 5 sentences, 12 syllables
      const score = calculateFleschReadingEase(10, 5, 12);
      expect(score).toBeGreaterThan(70);
    });

    it('returns low score for complex text', () => {
      // Long sentences, complex words: 100 words, 3 sentences, 250 syllables
      const score = calculateFleschReadingEase(100, 3, 250);
      expect(score).toBeLessThan(30);
    });

    it('clamps between 0 and 100', () => {
      // Extremely simple
      const high = calculateFleschReadingEase(5, 5, 5);
      expect(high).toBeLessThanOrEqual(100);
      // Extremely complex
      const low = calculateFleschReadingEase(200, 1, 600);
      expect(low).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateFleschKincaidGrade', () => {
    it('returns 0 for zero input', () => {
      expect(calculateFleschKincaidGrade(0, 0, 0)).toBe(0);
    });

    it('returns low grade for simple text', () => {
      const grade = calculateFleschKincaidGrade(10, 5, 12);
      expect(grade).toBeLessThan(5);
    });

    it('returns high grade for complex text', () => {
      const grade = calculateFleschKincaidGrade(100, 3, 250);
      expect(grade).toBeGreaterThan(10);
    });

    it('clamps between 0 and 18', () => {
      const low = calculateFleschKincaidGrade(5, 5, 5);
      expect(low).toBeGreaterThanOrEqual(0);
      const high = calculateFleschKincaidGrade(500, 1, 1500);
      expect(high).toBeLessThanOrEqual(18);
    });
  });

  describe('detectPassiveVoice', () => {
    it('detects "was done" pattern', () => {
      expect(
        detectPassiveVoice('The work was completed quickly.')
      ).toBeGreaterThan(0);
    });

    it('detects "is being" pattern', () => {
      expect(detectPassiveVoice('The house is being painted.')).toBeGreaterThan(
        0
      );
    });

    it('returns 0 for active voice', () => {
      expect(detectPassiveVoice('The dog chased the cat.')).toBe(0);
    });

    it('counts multiple passive constructions', () => {
      const text =
        'The cake was baked. The house was painted. The letter was written.';
      expect(detectPassiveVoice(text)).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getReadabilityLevel', () => {
    it('returns correct levels for score ranges', () => {
      expect(getReadabilityLevel(95)).toBe('very-easy');
      expect(getReadabilityLevel(85)).toBe('easy');
      expect(getReadabilityLevel(75)).toBe('fairly-easy');
      expect(getReadabilityLevel(65)).toBe('standard');
      expect(getReadabilityLevel(55)).toBe('fairly-difficult');
      expect(getReadabilityLevel(40)).toBe('difficult');
      expect(getReadabilityLevel(20)).toBe('very-difficult');
    });

    it('handles boundary values', () => {
      expect(getReadabilityLevel(90)).toBe('very-easy');
      expect(getReadabilityLevel(80)).toBe('easy');
      expect(getReadabilityLevel(70)).toBe('fairly-easy');
      expect(getReadabilityLevel(60)).toBe('standard');
      expect(getReadabilityLevel(50)).toBe('fairly-difficult');
      expect(getReadabilityLevel(30)).toBe('difficult');
      expect(getReadabilityLevel(29)).toBe('very-difficult');
    });
  });

  describe('analyzeReadability', () => {
    const sampleText =
      'The quick brown fox jumps over the lazy dog. ' +
      'Simple sentences are easy to read. ' +
      'Short words help too.\n\n' +
      'This is a second paragraph. It has more content.';

    it('returns all required metrics', () => {
      const result = analyzeReadability(sampleText);
      expect(result).toHaveProperty('fleschReadingEase');
      expect(result).toHaveProperty('fleschKincaidGrade');
      expect(result).toHaveProperty('averageSentenceLength');
      expect(result).toHaveProperty('averageWordLength');
      expect(result).toHaveProperty('syllableCount');
      expect(result).toHaveProperty('passiveVoiceCount');
      expect(result).toHaveProperty('paragraphCount');
      expect(result).toHaveProperty('averageParagraphLength');
      expect(result).toHaveProperty('readabilityLevel');
    });

    it('counts paragraphs correctly', () => {
      const result = analyzeReadability(sampleText);
      expect(result.paragraphCount).toBe(2);
    });

    it('calculates non-zero metrics for real text', () => {
      const result = analyzeReadability(sampleText);
      expect(result.fleschReadingEase).toBeGreaterThan(0);
      expect(result.syllableCount).toBeGreaterThan(0);
      expect(result.averageSentenceLength).toBeGreaterThan(0);
      expect(result.averageWordLength).toBeGreaterThan(0);
    });

    it('strips markdown formatting', () => {
      const markdown =
        '# Heading\n\nSome **bold** and *italic* text. A [link](http://example.com).';
      const result = analyzeReadability(markdown);
      expect(result.syllableCount).toBeGreaterThan(0);
    });

    it('strips code blocks', () => {
      const withCode =
        'Normal text here.\n\n```js\nconst x = 1;\n```\n\nMore text.';
      const result = analyzeReadability(withCode);
      expect(result.paragraphCount).toBeGreaterThanOrEqual(1);
    });

    it('handles empty content', () => {
      const result = analyzeReadability('');
      expect(result.fleschReadingEase).toBe(0);
      expect(result.syllableCount).toBe(0);
    });
  });

  describe('getReadabilitySuggestions', () => {
    it('suggests simplification for very difficult content', () => {
      const metrics: ReadabilityMetrics = {
        fleschReadingEase: 20,
        fleschKincaidGrade: 14,
        averageSentenceLength: 25,
        averageWordLength: 6,
        syllableCount: 200,
        passiveVoiceCount: 8,
        paragraphCount: 3,
        averageParagraphLength: 160,
        readabilityLevel: 'very-difficult',
      };
      const suggestions = getReadabilitySuggestions(metrics);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes('very difficult'))).toBe(true);
    });

    it('suggests more depth for very easy content', () => {
      const metrics: ReadabilityMetrics = {
        fleschReadingEase: 95,
        fleschKincaidGrade: 2,
        averageSentenceLength: 8,
        averageWordLength: 3,
        syllableCount: 50,
        passiveVoiceCount: 0,
        paragraphCount: 5,
        averageParagraphLength: 20,
        readabilityLevel: 'very-easy',
      };
      const suggestions = getReadabilitySuggestions(metrics);
      expect(suggestions.some((s) => s.includes('too simple'))).toBe(true);
    });

    it('warns about long sentences', () => {
      const metrics: ReadabilityMetrics = {
        fleschReadingEase: 65,
        fleschKincaidGrade: 8,
        averageSentenceLength: 25,
        averageWordLength: 5,
        syllableCount: 150,
        passiveVoiceCount: 0,
        paragraphCount: 3,
        averageParagraphLength: 50,
        readabilityLevel: 'standard',
      };
      const suggestions = getReadabilitySuggestions(metrics);
      expect(suggestions.some((s) => s.includes('long'))).toBe(true);
    });

    it('warns about short sentences', () => {
      const metrics: ReadabilityMetrics = {
        fleschReadingEase: 85,
        fleschKincaidGrade: 3,
        averageSentenceLength: 8,
        averageWordLength: 4,
        syllableCount: 60,
        passiveVoiceCount: 0,
        paragraphCount: 2,
        averageParagraphLength: 40,
        readabilityLevel: 'easy',
      };
      const suggestions = getReadabilitySuggestions(metrics);
      expect(suggestions.some((s) => s.includes('short'))).toBe(true);
    });

    it('warns about excessive passive voice', () => {
      const metrics: ReadabilityMetrics = {
        fleschReadingEase: 60,
        fleschKincaidGrade: 8,
        averageSentenceLength: 15,
        averageWordLength: 5,
        syllableCount: 120,
        passiveVoiceCount: 8,
        paragraphCount: 3,
        averageParagraphLength: 50,
        readabilityLevel: 'standard',
      };
      const suggestions = getReadabilitySuggestions(metrics);
      expect(suggestions.some((s) => s.includes('passive voice'))).toBe(true);
    });

    it('warns about long paragraphs', () => {
      const metrics: ReadabilityMetrics = {
        fleschReadingEase: 60,
        fleschKincaidGrade: 8,
        averageSentenceLength: 15,
        averageWordLength: 5,
        syllableCount: 120,
        passiveVoiceCount: 0,
        paragraphCount: 2,
        averageParagraphLength: 200,
        readabilityLevel: 'standard',
      };
      const suggestions = getReadabilitySuggestions(metrics);
      expect(suggestions.some((s) => s.includes('paragraphs'))).toBe(true);
    });

    it('warns about college-level grade', () => {
      const metrics: ReadabilityMetrics = {
        fleschReadingEase: 40,
        fleschKincaidGrade: 14,
        averageSentenceLength: 18,
        averageWordLength: 5,
        syllableCount: 180,
        passiveVoiceCount: 0,
        paragraphCount: 3,
        averageParagraphLength: 60,
        readabilityLevel: 'difficult',
      };
      const suggestions = getReadabilitySuggestions(metrics);
      expect(suggestions.some((s) => s.includes('college'))).toBe(true);
    });

    it('returns empty for well-balanced content', () => {
      const metrics: ReadabilityMetrics = {
        fleschReadingEase: 65,
        fleschKincaidGrade: 8,
        averageSentenceLength: 15,
        averageWordLength: 4.5,
        syllableCount: 120,
        passiveVoiceCount: 2,
        paragraphCount: 4,
        averageParagraphLength: 60,
        readabilityLevel: 'standard',
      };
      const suggestions = getReadabilitySuggestions(metrics);
      expect(suggestions.length).toBe(0);
    });
  });
});
