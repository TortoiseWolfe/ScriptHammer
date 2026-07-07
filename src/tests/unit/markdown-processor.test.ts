import { describe, it, expect, beforeEach, vi } from 'vitest';

interface ProcessedContent {
  html: string;
  metadata: ContentMetadata;
  hash: string;
  cached: boolean;
}

interface TocItem {
  level: number;
  text: string;
  id: string;
  children: TocItem[];
}

interface ContentMetadata {
  headings: Array<{ level: number; text: string }>;
  wordCount: number;
  readingTime: number;
}

// Mock markdown processor implementation
class MockMarkdownProcessor {
  private cache: Map<string, ProcessedContent> = new Map();

  async process(
    content: string,
    options?: { useCache?: boolean; [key: string]: unknown }
  ) {
    const hash = this.generateHash(content);

    if (this.cache.has(hash) && options?.useCache) {
      return { ...this.cache.get(hash), cached: true };
    }

    const result = {
      html: this.convertToHtml(content),
      metadata: this.extractMetadata(content),
      hash,
      cached: false,
    };

    if (options?.useCache) {
      this.cache.set(hash, result);
    }

    return result;
  }

  private generateHash(content: string): string {
    return Buffer.from(content).toString('base64').substring(0, 16);
  }

  private convertToHtml(content: string): string {
    // Simple markdown to HTML conversion
    return content
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<)(.+)$/gm, '<p>$1</p>');
  }

  private extractMetadata(content: string): ContentMetadata {
    const lines = content.split('\n');
    const headings = lines
      .filter((line) => line.startsWith('#'))
      .map((line) => ({
        level: line.match(/^#+/)?.[0].length || 0,
        text: line.replace(/^#+\s*/, ''),
      }));

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      headings,
      wordCount,
      readingTime,
    };
  }

  clearCache() {
    this.cache.clear();
  }
}

describe('Markdown Processor Unit Tests', () => {
  let processor: MockMarkdownProcessor;

  beforeEach(() => {
    processor = new MockMarkdownProcessor();
    vi.clearAllMocks();
  });

  describe('Basic Markdown Processing', () => {
    it('should convert headings to HTML', async () => {
      const markdown = `# Heading 1
## Heading 2
### Heading 3`;

      const result = await processor.process(markdown);

      expect(result.html).toContain('<h1>Heading 1</h1>');
      expect(result.html).toContain('<h2>Heading 2</h2>');
    });

    it('should convert emphasis and strong text', async () => {
      const markdown = 'This is **bold** and this is *italic* text.';

      const result = await processor.process(markdown);

      expect(result.html).toContain('<strong>bold</strong>');
      expect(result.html).toContain('<em>italic</em>');
    });

    it('should convert links to HTML', async () => {
      const markdown = 'Check out [my blog](https://example.com/blog)!';

      const result = await processor.process(markdown);

      expect(result.html).toContain(
        '<a href="https://example.com/blog">my blog</a>'
      );
    });

    it('should handle paragraphs', async () => {
      const markdown = `First paragraph.

Second paragraph.

Third paragraph.`;

      const result = await processor.process(markdown);

      expect(result.html).toContain('<p>');
      expect(result.html).toContain('</p>');
    });
  });

  describe('Frontmatter Extraction', () => {
    it('should extract YAML frontmatter', () => {
      const content = `---
title: Test Post
author: John Doe
date: 2025-01-15
tags: [blog, test]
---

# Content`;

      const extractFrontmatter = (text: string) => {
        const match = text.match(/^---\n([\s\S]*?)\n---/);
        if (!match) return null;

        const frontmatter: Record<string, unknown> = {};
        const lines = match[1].split('\n');

        lines.forEach((line) => {
          const [key, ...valueParts] = line.split(':');
          if (key && valueParts.length) {
            const value = valueParts.join(':').trim();
            try {
              if (value.startsWith('[') && value.endsWith(']')) {
                // Parse array-like values
                const arrayContent = value.slice(1, -1).trim();
                frontmatter[key.trim()] = arrayContent
                  .split(',')
                  .map((item) => item.trim());
              } else {
                frontmatter[key.trim()] = value;
              }
            } catch {
              frontmatter[key.trim()] = value;
            }
          }
        });

        return frontmatter;
      };

      const frontmatter = extractFrontmatter(content);

      expect(frontmatter).toHaveProperty('title', 'Test Post');
      expect(frontmatter).toHaveProperty('author', 'John Doe');
      expect((frontmatter as Record<string, unknown>)?.tags).toEqual([
        'blog',
        'test',
      ]);
    });

    it('should handle content without frontmatter', () => {
      const content = '# Just a heading\n\nAnd some content.';

      const hasFrontmatter = content.startsWith('---');

      expect(hasFrontmatter).toBe(false);
    });

    it('should validate frontmatter structure', () => {
      const validateFrontmatter = (fm: unknown) => {
        const required = ['title', 'author'];
        const errors = [];

        for (const field of required) {
          if (!fm || !(fm as Record<string, unknown>)[field]) {
            errors.push(`Missing required field: ${field}`);
          }
        }

        return { valid: errors.length === 0, errors };
      };

      const invalidFm = { title: 'Test' }; // Missing author
      const validFm = { title: 'Test', author: 'John' };

      expect(validateFrontmatter(invalidFm).valid).toBe(false);
      expect(validateFrontmatter(validFm).valid).toBe(true);
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract headings from content', async () => {
      const markdown = `# Main Title
## Section 1
### Subsection
## Section 2`;

      const result = await processor.process(markdown);

      expect(result.metadata?.headings).toHaveLength(4);
      expect(result.metadata?.headings[0]).toEqual({
        level: 1,
        text: 'Main Title',
      });
      expect(result.metadata?.headings[2]).toEqual({
        level: 3,
        text: 'Subsection',
      });
    });

    it('should calculate word count', async () => {
      const markdown = 'This is a test post with exactly ten words here.';

      const result = await processor.process(markdown);

      expect(result.metadata?.wordCount).toBe(10);
    });

    it('should estimate reading time', async () => {
      const shortPost = 'Short post.'; // 2 words = 1 min
      const longPost = Array(600).fill('word').join(' '); // 600 words = 3 min

      const shortResult = await processor.process(shortPost);
      const longResult = await processor.process(longPost);

      expect(shortResult.metadata?.readingTime).toBe(1);
      expect(longResult.metadata?.readingTime).toBe(3);
    });

    it('should extract code blocks', () => {
      const content = `
Text before.

\`\`\`javascript
const x = 1;
\`\`\`

Text between.

\`\`\`python
print("Hello")
\`\`\`

Text after.`;

      const extractCodeBlocks = (text: string) => {
        const regex = /```(\w+)?\n([\s\S]*?)```/g;
        const blocks = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
          blocks.push({
            language: match[1] || 'plaintext',
            code: match[2].trim(),
          });
        }

        return blocks;
      };

      const codeBlocks = extractCodeBlocks(content);

      expect(codeBlocks).toHaveLength(2);
      expect(codeBlocks[0].language).toBe('javascript');
      expect(codeBlocks[1].language).toBe('python');
    });
  });

  describe('Content Hashing', () => {
    it('should generate consistent hash for same content', async () => {
      const content = '# Test\n\nSame content';

      const result1 = await processor.process(content);
      const result2 = await processor.process(content);

      expect(result1.hash).toBe(result2.hash);
    });

    it('should generate different hash for different content', async () => {
      const content1 = '# Test 1';
      const content2 = '# Test 2';

      const result1 = await processor.process(content1);
      const result2 = await processor.process(content2);

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should use hash for cache key', async () => {
      const content = '# Cached Content';

      // First call - not cached
      const result1 = await processor.process(content, { useCache: true });
      expect(result1.cached).toBe(false);

      // Second call - should be cached
      const result2 = await processor.process(content, { useCache: true });
      expect(result2.cached).toBe(true);
      expect(result2.hash).toBe(result1.hash);
    });
  });

  describe('Table of Contents Generation', () => {
    it('should generate TOC from headings', () => {
      const headings = [
        { level: 1, text: 'Title', id: 'title' },
        { level: 2, text: 'Section 1', id: 'section-1' },
        { level: 3, text: 'Subsection 1.1', id: 'subsection-11' },
        { level: 2, text: 'Section 2', id: 'section-2' },
      ];

      const generateToc = (
        hdgs: Array<{ level: number; text: string; id: string }>,
        maxDepth = 3
      ) => {
        const toc: TocItem[] = [];
        const stack: TocItem[] = [];

        hdgs.forEach((h) => {
          if (h.level > maxDepth) return;

          const item = { ...h, children: [] as TocItem[] };

          while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
            stack.pop();
          }

          if (stack.length === 0) {
            toc.push(item);
          } else {
            stack[stack.length - 1].children.push(item);
          }

          stack.push(item);
        });

        return toc;
      };

      const toc = generateToc(headings);

      expect(toc).toHaveLength(1); // One root item
      expect(toc[0].children).toHaveLength(2); // Two sections
      expect((toc[0].children[0] as TocItem).children).toHaveLength(1); // One subsection
    });

    it('should generate heading IDs', () => {
      const generateId = (text: string) => {
        return text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      };

      expect(generateId('Hello World!')).toBe('hello-world');
      expect(generateId('Section 1.2.3')).toBe('section-1-2-3');
      expect(generateId('FAQ & Support')).toBe('faq-support');
    });

    it('should handle duplicate heading IDs', () => {
      const headings = ['Introduction', 'Introduction', 'Introduction'];
      const usedIds = new Set<string>();

      const generateUniqueId = (text: string) => {
        const baseId = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        let id = baseId;
        let counter = 1;

        while (usedIds.has(id)) {
          id = `${baseId}-${counter}`;
          counter++;
        }

        usedIds.add(id);
        return id;
      };

      const ids = headings.map(generateUniqueId);

      expect(ids).toEqual(['introduction', 'introduction-1', 'introduction-2']);
    });
  });

  describe('Special Markdown Features', () => {
    it('should handle tables', () => {
      const table = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |`;

      const isTable = (text: string) => {
        return text.includes('|') && text.includes('---');
      };

      expect(isTable(table)).toBe(true);
    });

    it('should handle blockquotes', () => {
      const quote = '> This is a blockquote\n> with multiple lines';

      const convertBlockquote = (text: string) => {
        return text.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
      };

      const result = convertBlockquote(quote);
      expect(result).toContain('<blockquote>');
    });

    it('should handle lists', () => {
      const unorderedList = `- Item 1
- Item 2
  - Nested item
- Item 3`;

      const orderedList = `1. First
2. Second
3. Third`;

      const isUnorderedList = (line: string) => /^[\-\*\+]\s/.test(line);
      const isOrderedList = (line: string) => /^\d+\.\s/.test(line);

      expect(isUnorderedList('- Item')).toBe(true);
      expect(isOrderedList('1. Item')).toBe(true);
    });

    it('should handle inline code', () => {
      const text = 'Use `npm install` to install dependencies.';

      const convertInlineCode = (content: string) => {
        return content.replace(/`([^`]+)`/g, '<code>$1</code>');
      };

      const result = convertInlineCode(text);
      expect(result).toContain('<code>npm install</code>');
    });
  });

  describe('Performance Optimization', () => {
    it('should cache processed results', async () => {
      const content = '# Expensive Processing';
      processor.clearCache();

      // First processing (not cached)
      const result1 = await processor.process(content, { useCache: true });
      expect(result1.cached).toBe(false);

      // Second processing (should be cached)
      const result2 = await processor.process(content, { useCache: true });
      expect(result2.cached).toBe(true);

      // HTML should be the same
      expect(result2.html).toBe(result1.html);
    });

    it('should handle cache invalidation', async () => {
      const content = '# Content';

      await processor.process(content, { useCache: true });
      processor.clearCache();

      const result = await processor.process(content, { useCache: true });
      expect(result.cached).toBe(false);
    });

    it('should limit cache size', () => {
      const cache = new Map();
      const maxSize = 100;

      const addToCache = (key: string, value: unknown) => {
        if (cache.size >= maxSize) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey); // Remove oldest
        }
        cache.set(key, value);
      };

      for (let i = 0; i < 150; i++) {
        addToCache(`key${i}`, `value${i}`);
      }

      expect(cache.size).toBe(maxSize);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid markdown gracefully', async () => {
      const invalidMarkdown = '```\nUnclosed code block';

      try {
        const result = await processor.process(invalidMarkdown);
        // Should still return something
        expect(result.html).toBeDefined();
      } catch (error) {
        // Should not throw
        expect(error).toBeUndefined();
      }
    });

    it('should validate markdown structure', () => {
      const validateMarkdown = (content: string) => {
        const issues = [];

        // Check for unclosed code blocks
        const codeBlockCount = (content.match(/```/g) || []).length;
        if (codeBlockCount % 2 !== 0) {
          issues.push('Unclosed code block');
        }

        // Check for broken links
        const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
          if (!match[2]) {
            issues.push(`Empty link URL for "${match[1]}"`);
          }
        }

        return { valid: issues.length === 0, issues };
      };

      const invalidContent = '[Link]() and ```\nunclosed';
      const validation = validateMarkdown(invalidContent);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Unclosed code block');
      expect(validation.issues).toContain('Empty link URL for "Link"');
    });
  });
});
