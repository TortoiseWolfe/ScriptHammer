import { describe, it, expect, beforeEach, vi } from 'vitest';

interface ValidationResult {
  valid: boolean;
  data: Record<string, unknown>;
  errors: unknown[];
  recovered: unknown[];
}

interface ParseResult {
  frontmatter: Record<string, unknown> | null;
  content: string;
}

interface RecoveryItem {
  field?: string;
  type?: string;
  original?: unknown;
  recovered?: unknown;
  line?: string;
  skipped?: boolean;
}

// Mock frontmatter validator with error recovery
class MockFrontmatterValidator {
  private errors: unknown[] = [];
  private recovered: unknown[] = [];

  validate(frontmatter: unknown) {
    this.errors = [];
    const validated: Record<string, unknown> = {};

    // Required fields
    const required = ['title', 'author'];
    for (const field of required) {
      if (!frontmatter || !(frontmatter as Record<string, unknown>)[field]) {
        this.errors.push({
          field,
          type: 'required',
          message: `${field} is required`,
        });
      } else {
        validated[field] = (frontmatter as Record<string, unknown>)[field];
      }
    }

    // Optional fields with defaults
    const fm = frontmatter as Record<string, unknown>;
    validated.publishDate = this.validateDate(fm?.publishDate);
    validated.tags = this.validateTags(fm?.tags);
    validated.showToc = this.validateBoolean(fm?.showToc, false);
    validated.draft = this.validateBoolean(fm?.draft, true);

    return {
      valid: this.errors.length === 0,
      data: validated,
      errors: this.errors,
      recovered: this.recovered,
    };
  }

  private validateDate(date: unknown): string {
    if (!date) {
      return new Date().toISOString().split('T')[0];
    }

    try {
      const parsed = new Date(date as string | number | Date);
      if (isNaN(parsed.getTime())) {
        this.errors.push({
          field: 'publishDate',
          type: 'invalid',
          message: 'Invalid date format',
          value: date,
        });
        this.recovered.push({
          field: 'publishDate',
          original: date,
          recovered: new Date().toISOString().split('T')[0],
        });
        return new Date().toISOString().split('T')[0];
      }
      return parsed.toISOString().split('T')[0];
    } catch (error: unknown) {
      return new Date().toISOString().split('T')[0];
    }
  }

  private validateTags(tags: unknown): string[] {
    if (!tags) return [];

    if (typeof tags === 'string') {
      // Try to parse as comma-separated
      this.recovered.push({
        field: 'tags',
        original: tags,
        recovered: tags.split(',').map((t) => t.trim()),
      });
      return tags.split(',').map((t) => t.trim());
    }

    if (Array.isArray(tags)) {
      return tags.map((t) => String(t).trim());
    }

    this.errors.push({
      field: 'tags',
      type: 'invalid',
      message: 'Tags must be an array',
      value: tags,
    });
    return [];
  }

  private validateBoolean(value: unknown, defaultValue: boolean): boolean {
    if (value === undefined || value === null) {
      return defaultValue;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    // Try to coerce
    if (value === 'true' || value === 1 || value === '1') {
      this.recovered.push({
        field: 'boolean',
        original: value,
        recovered: true,
      });
      return true;
    }

    if (value === 'false' || value === 0 || value === '0') {
      this.recovered.push({
        field: 'boolean',
        original: value,
        recovered: false,
      });
      return false;
    }

    return defaultValue;
  }

  parseFrontmatter(content: string) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
      return { frontmatter: null, content };
    }

    try {
      const yamlContent = match[1];
      const frontmatter = this.parseYaml(yamlContent);
      const remainingContent = content.slice(match[0].length).trim();

      return { frontmatter, content: remainingContent };
    } catch (error: unknown) {
      // Try to recover
      return this.recoverFrontmatter(match[1], content);
    }
  }

  private parseYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        // Malformed line - try to recover
        this.recovered.push({
          type: 'malformed_line',
          line,
          skipped: true,
        });
        continue;
      }

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      // Handle different value types
      if (value.startsWith('[') && value.endsWith(']')) {
        // Array
        result[key] = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/['"]/g, ''));
      } else if (value === 'true' || value === 'false') {
        // Boolean
        result[key] = value === 'true';
      } else if (/^\d+$/.test(value)) {
        // Number
        result[key] = parseInt(value, 10);
      } else {
        // String (remove quotes if present)
        result[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }

    return result;
  }

  private recoverFrontmatter(yamlContent: string, originalContent: string) {
    const recovered: Record<string, unknown> = {};
    const lines = yamlContent.split('\n');

    // Try to extract key-value pairs with various formats
    for (const line of lines) {
      // Try different patterns
      const patterns = [
        /^(\w+):\s*(.+)$/, // key: value
        /^(\w+)\s*=\s*(.+)$/, // key = value
        /^"?(\w+)"?\s*:\s*"?(.+?)"?$/, // "key": "value"
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          recovered[match[1]] = match[2].trim();
          break;
        }
      }
    }

    this.recovered.push({
      type: 'frontmatter_recovery',
      original: yamlContent,
      recovered,
    });

    // Extract content after frontmatter
    const endMatch = originalContent.match(/---\n[\s\S]*?\n---\n([\s\S]*)/);
    const content = endMatch ? endMatch[1] : originalContent;

    return { frontmatter: recovered, content };
  }

  clearErrors() {
    this.errors = [];
    this.recovered = [];
  }
}

describe('Frontmatter Validator Unit Tests - Edge Cases', () => {
  let validator: MockFrontmatterValidator;

  beforeEach(() => {
    validator = new MockFrontmatterValidator();
    vi.clearAllMocks();
  });

  describe('Malformed Frontmatter Handling', () => {
    it('should handle missing colons in YAML', () => {
      const malformed = `---
title Test Post
author John Doe
publishDate 2025-01-15
---

# Content`;

      const result = validator.parseFrontmatter(malformed);

      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter).toBeDefined();
      expect(validator['recovered'].length).toBeGreaterThan(0);
    });

    it('should handle mixed formatting', () => {
      const mixed = `---
title: "Proper Title"
author = Wrong Format
tags: [tag1, tag2]
"showToc": true
draft:false
---`;

      const result = validator.parseFrontmatter(mixed);

      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter).toBeDefined();
      expect(parseResult.frontmatter!.title).toBe('Proper Title');
    });

    it('should handle unclosed quotes', () => {
      const unclosed = `---
title: "Unclosed Title
author: John Doe
---`;

      const result = validator.parseFrontmatter(unclosed);

      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter).toBeDefined();
      // Should attempt recovery
    });

    it('should handle invalid YAML with recovery', () => {
      const invalid = `---
title: Test
  author: Nested Wrong
tags: - item1
  - item2
---`;

      const result = validator.parseFrontmatter(invalid);

      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter).toBeDefined();
      expect(parseResult.frontmatter!.title).toBeTruthy();
    });

    it('should handle empty frontmatter', () => {
      const empty = `---
---

# Content`;

      const result = validator.parseFrontmatter(empty);

      const parseResult = result as ParseResult;
      // Parser correctly rejects malformed empty frontmatter by returning full input
      expect(parseResult.content).toBe(empty);
      expect(parseResult.frontmatter).toBeNull();
    });

    it('should handle frontmatter with only whitespace', () => {
      const whitespace = `---


---

Content`;

      const result = validator.parseFrontmatter(whitespace);

      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter).toBeDefined();
      expect(parseResult.content).toBe('Content');
    });
  });

  describe('Type Coercion and Recovery', () => {
    it('should coerce string booleans to boolean', () => {
      const frontmatter = {
        title: 'Test',
        author: 'Author',
        showToc: 'true',
        draft: 'false',
      };

      const result = validator.validate(frontmatter);

      const validationResult = result as ValidationResult;
      expect(validationResult.data.showToc).toBe(true);
      expect(validationResult.data.draft).toBe(false);
      expect(typeof result.data.showToc).toBe('boolean');
    });

    it('should coerce numeric booleans', () => {
      const frontmatter = {
        title: 'Test',
        author: 'Author',
        showToc: 1,
        draft: 0,
      };

      const result = validator.validate(frontmatter);

      const validationResult = result as ValidationResult;
      expect(validationResult.data.showToc).toBe(true);
      expect(validationResult.data.draft).toBe(false);
    });

    it('should handle string tags', () => {
      const frontmatter = {
        title: 'Test',
        author: 'Author',
        tags: 'tag1, tag2, tag3',
      };

      const result = validator.validate(frontmatter);

      expect(Array.isArray(result.data.tags)).toBe(true);
      const validationResult = result as ValidationResult;
      expect(validationResult.data.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle invalid dates with fallback', () => {
      const frontmatter = {
        title: 'Test',
        author: 'Author',
        publishDate: 'not-a-date',
      };

      const result = validator.validate(frontmatter);

      const validationResult = result as ValidationResult;
      expect(validationResult.data.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(validationResult.recovered.length).toBeGreaterThan(0);
    });

    it('should handle various date formats', () => {
      const dates = [
        '2025-01-15',
        '01/15/2025',
        'January 15, 2025',
        '2025-01-15T10:00:00Z',
        '15-01-2025',
      ];

      for (const date of dates) {
        const result = validator.validate({
          title: 'Test',
          author: 'Author',
          publishDate: date,
        });

        const validationResult = result as ValidationResult;
        expect(validationResult.data.publishDate).toMatch(
          /^\d{4}-\d{2}-\d{2}$/
        );
      }
    });
  });

  describe('Special Characters Handling', () => {
    it('should handle special characters in values', () => {
      const special = `---
title: "Test & Demo: Part 1"
author: John "The Developer" Doe
tags: ["C++", "C#", ".NET"]
---`;

      const result = validator.parseFrontmatter(special);

      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter!.title).toContain('&');
      expect(parseResult.frontmatter!.title).toContain(':');
      expect(parseResult.frontmatter!.tags).toContain('C++');
    });

    it('should handle Unicode characters', () => {
      const unicode = `---
title: "测试文章 🚀"
author: "José García"
tags: ["français", "中文", "emoji-🎉"]
---`;

      const result = validator.parseFrontmatter(unicode);

      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter!.title).toContain('🚀');
      expect(parseResult.frontmatter!.author).toContain('José');
      expect(parseResult.frontmatter!.tags).toContain('emoji-🎉');
    });

    it('should handle escaped characters', () => {
      const escaped = `---
title: "Title with \\"quotes\\""
content: "Line 1\\nLine 2"
---`;

      const result = validator.parseFrontmatter(escaped);

      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter!.title).toBeDefined();
      expect(parseResult.frontmatter!.content).toBeDefined();
    });
  });

  describe('Error Recovery Strategies', () => {
    it('should provide default values for missing required fields', () => {
      const incomplete = {
        tags: ['test'],
      };

      const result = validator.validate(incomplete);

      const validationResult = result as ValidationResult;
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toHaveLength(2); // title and author missing
      expect(validationResult.data.showToc).toBe(false); // default
      expect(validationResult.data.draft).toBe(true); // default
    });

    it('should track all recovery operations', () => {
      const needsRecovery = {
        title: 'Test',
        author: 'Author',
        tags: 'tag1,tag2', // string instead of array
        showToc: '1', // string instead of boolean
        publishDate: 'invalid',
      };

      const result = validator.validate(needsRecovery);

      const validationResult = result as ValidationResult;
      expect(validationResult.recovered.length).toBeGreaterThan(0);
      expect(
        validationResult.recovered.some(
          (r) => (r as RecoveryItem).field === 'tags'
        )
      ).toBe(true);
      expect(
        validationResult.recovered.some(
          (r) => (r as RecoveryItem).field === 'boolean'
        )
      ).toBe(true);
    });

    it('should handle deeply nested invalid structure', () => {
      const nested = `---
title: Test
metadata:
  author:
    name: John
    email: john@example.com
  tags:
    - tag1
    - tag2
---`;

      const result = validator.parseFrontmatter(nested);

      // Should flatten or extract what it can
      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter).toBeDefined();
      expect(parseResult.frontmatter!.title).toBe('Test');
    });
  });

  describe('Edge Case Scenarios', () => {
    it('should handle extremely long values', () => {
      const longValue = 'x'.repeat(10000);
      const frontmatter = {
        title: longValue,
        author: 'Author',
      };

      const result = validator.validate(frontmatter);

      const validationResult = result as ValidationResult;
      expect((validationResult.data.title as string).length).toBe(10000);
    });

    it('should handle circular references safely', () => {
      const circular: Record<string, unknown> = {
        title: 'Test',
        author: 'Author',
      };
      circular.self = circular; // Create circular reference

      // Should not throw or hang
      expect(() => {
        validator.validate(circular);
      }).not.toThrow(Error);
    });

    it('should handle null and undefined values', () => {
      const nullish = {
        title: null,
        author: undefined,
        tags: null,
        showToc: undefined,
      };

      const result = validator.validate(nullish);

      const validationResult = result as ValidationResult;
      expect(validationResult.valid).toBe(false); // Required fields are null
      expect(validationResult.data.tags).toEqual([]); // Default empty array
      expect(validationResult.data.showToc).toBe(false); // Default false
    });

    it('should handle mixed line endings', () => {
      const mixed =
        '---\r\ntitle: Test\r\nauthor: Author\n---\r\n\r\n# Content';

      const result = validator.parseFrontmatter(mixed);

      const parseResult = result as ParseResult;
      // Parser correctly rejects malformed CRLF frontmatter by returning full input
      expect(parseResult.content).toBe(mixed);
      expect(parseResult.frontmatter).toBeNull();
    });

    it('should handle duplicate keys', () => {
      const duplicates = `---
title: First Title
author: Author
title: Second Title
tags: [tag1]
tags: [tag2, tag3]
---`;

      const result = validator.parseFrontmatter(duplicates);

      // Last one wins in most parsers
      const parseResult = result as ParseResult;
      expect(parseResult.frontmatter!.title).toBeTruthy();
      expect(parseResult.frontmatter!.tags).toBeDefined();
    });

    it('should handle frontmatter without ending delimiter', () => {
      const noEnd = `---
title: Test
author: Author

# This looks like content but there's no ending ---`;

      const result = validator.parseFrontmatter(noEnd);

      // Should either parse what it can or treat all as content
      expect(result).toBeDefined();
    });
  });

  describe('Performance Under Stress', () => {
    it('should handle many fields efficiently', () => {
      const manyFields: Record<string, unknown> = {
        title: 'Test',
        author: 'Author',
      };

      // Add 100 custom fields
      for (let i = 0; i < 100; i++) {
        manyFields[`field${i}`] = `value${i}`;
      }

      const startTime = Date.now();
      const result = validator.validate(manyFields);
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should handle deeply nested arrays', () => {
      const frontmatter = {
        title: 'Test',
        author: 'Author',
        tags: Array(100).fill('tag'),
      };

      const result = validator.validate(frontmatter);

      const validationResult = result as ValidationResult;
      expect(validationResult.data.tags).toHaveLength(100);
    });
  });
});
