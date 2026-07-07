import { describe, it, expect } from 'vitest';
import {
  calculateKeywordDensity,
  checkKeywordInTitle,
  checkKeywordInFirstParagraph,
  countKeywordInHeadings,
  calculateKeywordDistribution,
  calculateKeywordProminence,
  extractRelatedKeywords,
  generateLSIKeywords,
  checkKeywordStuffing,
  analyzeKeywords,
  getKeywordSuggestions,
  type KeywordMetrics,
} from './keywords';

describe('keywords', () => {
  describe('calculateKeywordDensity', () => {
    it('returns zero for empty keyword', () => {
      const result = calculateKeywordDensity('some content here', '');
      expect(result.density).toBe(0);
      expect(result.count).toBe(0);
    });

    it('returns zero for whitespace keyword', () => {
      const result = calculateKeywordDensity('some content here', '   ');
      expect(result.density).toBe(0);
    });

    it('calculates single-word keyword density', () => {
      const result = calculateKeywordDensity(
        'the cat sat on the mat with the cat',
        'cat'
      );
      expect(result.count).toBe(2);
      expect(result.totalWords).toBe(9);
      expect(result.density).toBeGreaterThan(0);
    });

    it('is case-insensitive', () => {
      const result = calculateKeywordDensity(
        'React is great. REACT rocks.',
        'react'
      );
      expect(result.count).toBe(2);
    });

    it('handles multi-word keywords', () => {
      const result = calculateKeywordDensity(
        'the quick brown fox jumped over the quick brown fence',
        'quick brown'
      );
      expect(result.count).toBe(2);
    });

    it('returns zero when keyword not found', () => {
      const result = calculateKeywordDensity('hello world', 'missing');
      expect(result.count).toBe(0);
      expect(result.density).toBe(0);
    });
  });

  describe('checkKeywordInTitle', () => {
    it('returns true when keyword is in title', () => {
      expect(checkKeywordInTitle('Getting Started with React', 'react')).toBe(
        true
      );
    });

    it('returns false when keyword is not in title', () => {
      expect(checkKeywordInTitle('Getting Started with Vue', 'react')).toBe(
        false
      );
    });

    it('is case-insensitive', () => {
      expect(checkKeywordInTitle('REACT Tutorial', 'react')).toBe(true);
    });

    it('returns false for empty inputs', () => {
      expect(checkKeywordInTitle('', 'react')).toBe(false);
      expect(checkKeywordInTitle('Title', '')).toBe(false);
    });
  });

  describe('checkKeywordInFirstParagraph', () => {
    it('returns true when keyword is in first paragraph', () => {
      const content = 'React is a great library.\n\nVue is also nice.';
      expect(checkKeywordInFirstParagraph(content, 'react')).toBe(true);
    });

    it('returns false when keyword is only in later paragraphs', () => {
      const content = 'This is the intro.\n\nReact is mentioned later.';
      expect(checkKeywordInFirstParagraph(content, 'react')).toBe(false);
    });

    it('returns false for empty inputs', () => {
      expect(checkKeywordInFirstParagraph('', 'keyword')).toBe(false);
      expect(checkKeywordInFirstParagraph('content', '')).toBe(false);
    });
  });

  describe('countKeywordInHeadings', () => {
    it('counts keyword in markdown headings', () => {
      const content =
        '## React Basics\n\nSome text.\n\n### Advanced React\n\nMore text.';
      expect(countKeywordInHeadings(content, 'react')).toBe(2);
    });

    it('returns 0 when no headings contain keyword', () => {
      const content = '## Getting Started\n\nReact content here.';
      expect(countKeywordInHeadings(content, 'react')).toBe(0);
    });

    it('returns 0 for empty inputs', () => {
      expect(countKeywordInHeadings('', 'keyword')).toBe(0);
      expect(countKeywordInHeadings('## Heading', '')).toBe(0);
    });
  });

  describe('calculateKeywordDistribution', () => {
    it('returns 4-element array', () => {
      const result = calculateKeywordDistribution(
        'react is great. we love react. react rocks. use react today.',
        'react'
      );
      expect(result).toHaveLength(4);
    });

    it('returns empty array for empty inputs', () => {
      expect(calculateKeywordDistribution('', 'keyword')).toEqual([]);
      expect(calculateKeywordDistribution('content', '')).toEqual([]);
    });

    it('shows keyword distribution across sections', () => {
      const words = Array(100).fill('word').join(' ');
      const content = `react ${words} react ${words} react ${words} react`;
      const result = calculateKeywordDistribution(content, 'react');
      expect(result.every((count) => count >= 0)).toBe(true);
    });
  });

  describe('calculateKeywordProminence', () => {
    it('returns high score when keyword is at start', () => {
      const result = calculateKeywordProminence(
        'react is the best framework',
        'react'
      );
      expect(result).toBeGreaterThan(90);
    });

    it('returns low score when keyword is at end', () => {
      const content = 'a '.repeat(50) + 'react';
      const result = calculateKeywordProminence(content, 'react');
      expect(result).toBeLessThan(20);
    });

    it('returns 0 when keyword is not found', () => {
      expect(calculateKeywordProminence('hello world', 'react')).toBe(0);
    });

    it('returns 0 for empty inputs', () => {
      expect(calculateKeywordProminence('', 'keyword')).toBe(0);
      expect(calculateKeywordProminence('content', '')).toBe(0);
    });
  });

  describe('extractRelatedKeywords', () => {
    it('extracts frequently occurring phrases', () => {
      const content =
        'web development is fun. web development requires practice. ' +
        'learn web development today. front end skills matter. front end skills grow.';
      const result = extractRelatedKeywords(content, 'coding');
      expect(Array.isArray(result)).toBe(true);
    });

    it('excludes the primary keyword', () => {
      const content =
        'react hooks are great. react hooks simplify code. react hooks work well.';
      const result = extractRelatedKeywords(content, 'react');
      result.forEach((phrase) => {
        expect(phrase).not.toContain('react');
      });
    });

    it('returns at most 5 results', () => {
      const content = Array(50)
        .fill('alpha beta gamma delta epsilon zeta')
        .join(' ');
      const result = extractRelatedKeywords(content, 'omega');
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('generateLSIKeywords', () => {
    it('returns predefined LSI keywords for known topics', () => {
      const result = generateLSIKeywords(
        'seo',
        'search engine optimization content'
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('extracts context words from content', () => {
      const content =
        'react component hooks state management lifecycle virtual rendering';
      const result = generateLSIKeywords('react', content);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns at most 10 results', () => {
      const content = Array(100)
        .fill('react component hooks state management')
        .join(' ');
      const result = generateLSIKeywords('react', content);
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe('checkKeywordStuffing', () => {
    it('returns false for normal density', () => {
      expect(checkKeywordStuffing(1.5)).toBe(false);
      expect(checkKeywordStuffing(2.0)).toBe(false);
      expect(checkKeywordStuffing(3.0)).toBe(false);
    });

    it('returns true for high density', () => {
      expect(checkKeywordStuffing(3.1)).toBe(true);
      expect(checkKeywordStuffing(5.0)).toBe(true);
    });
  });

  describe('analyzeKeywords', () => {
    const content =
      '## React Basics\n\n' +
      'React is a popular JavaScript library. ' +
      'Learning React helps build modern web apps. ' +
      'React uses components and hooks.\n\n' +
      '## Advanced React\n\n' +
      'React hooks simplify state management.';

    it('returns all required metrics', () => {
      const result = analyzeKeywords(
        content,
        { title: 'React Guide' },
        'react'
      );
      expect(result).toHaveProperty('primaryKeyword', 'react');
      expect(result).toHaveProperty('keywordDensity');
      expect(result).toHaveProperty('keywordInTitle');
      expect(result).toHaveProperty('keywordInFirstParagraph');
      expect(result).toHaveProperty('keywordInHeadings');
      expect(result).toHaveProperty('keywordDistribution');
      expect(result).toHaveProperty('keywordProminence');
      expect(result).toHaveProperty('relatedKeywords');
      expect(result).toHaveProperty('lsiKeywords');
      expect(result).toHaveProperty('keywordStuffing');
    });

    it('detects keyword in title', () => {
      const result = analyzeKeywords(
        content,
        { title: 'React Guide' },
        'react'
      );
      expect(result.keywordInTitle).toBe(true);
    });

    it('detects keyword in headings', () => {
      const result = analyzeKeywords(content, { title: 'Guide' }, 'react');
      expect(result.keywordInHeadings).toBeGreaterThan(0);
    });

    it('extracts keyword from tags when no keyword provided', () => {
      const result = analyzeKeywords(content, { tags: ['javascript'] }, '');
      expect(result.primaryKeyword).toBe('javascript');
    });

    it('extracts keyword from title when no keyword or tags', () => {
      const result = analyzeKeywords(content, { title: 'React Guide' }, '');
      expect(result.primaryKeyword).toBe('React Guide');
    });
  });

  describe('getKeywordSuggestions', () => {
    it('suggests adding keyword when density is 0', () => {
      const metrics: KeywordMetrics = {
        primaryKeyword: 'react',
        keywordDensity: 0,
        keywordInTitle: true,
        keywordInFirstParagraph: true,
        keywordInHeadings: 1,
        keywordDistribution: [0, 0, 0, 0],
        keywordProminence: 80,
        relatedKeywords: [],
        lsiKeywords: [],
        keywordStuffing: false,
      };
      const suggestions = getKeywordSuggestions(metrics);
      expect(suggestions.some((s) => s.includes('not found'))).toBe(true);
    });

    it('warns about low density', () => {
      const metrics: KeywordMetrics = {
        primaryKeyword: 'react',
        keywordDensity: 0.3,
        keywordInTitle: true,
        keywordInFirstParagraph: true,
        keywordInHeadings: 1,
        keywordDistribution: [1, 1, 1, 1],
        keywordProminence: 80,
        relatedKeywords: [],
        lsiKeywords: [],
        keywordStuffing: false,
      };
      const suggestions = getKeywordSuggestions(metrics);
      expect(suggestions.some((s) => s.includes('low'))).toBe(true);
    });

    it('warns about keyword stuffing', () => {
      const metrics: KeywordMetrics = {
        primaryKeyword: 'react',
        keywordDensity: 5.0,
        keywordInTitle: true,
        keywordInFirstParagraph: true,
        keywordInHeadings: 3,
        keywordDistribution: [5, 5, 5, 5],
        keywordProminence: 95,
        relatedKeywords: [],
        lsiKeywords: [],
        keywordStuffing: true,
      };
      const suggestions = getKeywordSuggestions(metrics);
      expect(suggestions.some((s) => s.includes('stuffing'))).toBe(true);
    });

    it('suggests adding keyword to title', () => {
      const metrics: KeywordMetrics = {
        primaryKeyword: 'react',
        keywordDensity: 1.5,
        keywordInTitle: false,
        keywordInFirstParagraph: true,
        keywordInHeadings: 1,
        keywordDistribution: [1, 1, 1, 1],
        keywordProminence: 80,
        relatedKeywords: [],
        lsiKeywords: [],
        keywordStuffing: false,
      };
      const suggestions = getKeywordSuggestions(metrics);
      expect(suggestions.some((s) => s.includes('title'))).toBe(true);
    });

    it('suggests adding keyword to first paragraph', () => {
      const metrics: KeywordMetrics = {
        primaryKeyword: 'react',
        keywordDensity: 1.5,
        keywordInTitle: true,
        keywordInFirstParagraph: false,
        keywordInHeadings: 1,
        keywordDistribution: [1, 1, 1, 1],
        keywordProminence: 80,
        relatedKeywords: [],
        lsiKeywords: [],
        keywordStuffing: false,
      };
      const suggestions = getKeywordSuggestions(metrics);
      expect(suggestions.some((s) => s.includes('first paragraph'))).toBe(true);
    });

    it('suggests adding keyword to headings', () => {
      const metrics: KeywordMetrics = {
        primaryKeyword: 'react',
        keywordDensity: 1.5,
        keywordInTitle: true,
        keywordInFirstParagraph: true,
        keywordInHeadings: 0,
        keywordDistribution: [1, 1, 1, 1],
        keywordProminence: 80,
        relatedKeywords: [],
        lsiKeywords: [],
        keywordStuffing: false,
      };
      const suggestions = getKeywordSuggestions(metrics);
      expect(suggestions.some((s) => s.includes('heading'))).toBe(true);
    });

    it('suggests better distribution', () => {
      const metrics: KeywordMetrics = {
        primaryKeyword: 'react',
        keywordDensity: 1.5,
        keywordInTitle: true,
        keywordInFirstParagraph: true,
        keywordInHeadings: 1,
        keywordDistribution: [3, 0, 0, 0],
        keywordProminence: 80,
        relatedKeywords: [],
        lsiKeywords: [],
        keywordStuffing: false,
      };
      const suggestions = getKeywordSuggestions(metrics);
      expect(suggestions.some((s) => s.includes('evenly'))).toBe(true);
    });

    it('suggests better prominence', () => {
      const metrics: KeywordMetrics = {
        primaryKeyword: 'react',
        keywordDensity: 1.5,
        keywordInTitle: true,
        keywordInFirstParagraph: true,
        keywordInHeadings: 1,
        keywordDistribution: [1, 1, 1, 1],
        keywordProminence: 30,
        relatedKeywords: [],
        lsiKeywords: [],
        keywordStuffing: false,
      };
      const suggestions = getKeywordSuggestions(metrics);
      expect(suggestions.some((s) => s.includes('earlier'))).toBe(true);
    });

    it('suggests LSI keywords when available', () => {
      const metrics: KeywordMetrics = {
        primaryKeyword: 'react',
        keywordDensity: 1.5,
        keywordInTitle: true,
        keywordInFirstParagraph: true,
        keywordInHeadings: 1,
        keywordDistribution: [1, 1, 1, 1],
        keywordProminence: 80,
        relatedKeywords: [],
        lsiKeywords: ['hooks', 'components', 'state'],
        keywordStuffing: false,
      };
      const suggestions = getKeywordSuggestions(metrics);
      expect(suggestions.some((s) => s.includes('related terms'))).toBe(true);
    });
  });
});
