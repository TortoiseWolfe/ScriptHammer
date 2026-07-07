/**
 * Unit tests for TOCGenerator
 *
 * Covers both markdown and HTML heading extraction paths, the hierarchical
 * tree builder, and the rendering helpers (HTML, markdown, flatten, nav).
 */

import { describe, it, expect } from 'vitest';
import { TOCGenerator, tocGenerator } from './toc-generator';

describe('TOCGenerator.generate (from markdown)', () => {
  it('builds a flat list when all headings share the same level', () => {
    const md = '## one\n## two\n## three';
    const toc = new TOCGenerator().generate(md);
    expect(toc).toHaveLength(3);
    expect(toc.map((i) => i.text)).toEqual(['one', 'two', 'three']);
    expect(toc.every((i) => i.children!.length === 0)).toBe(true);
  });

  it('nests lower-level headings as children', () => {
    const md = '# parent\n## child\n### grandchild';
    const toc = new TOCGenerator().generate(md);
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe('parent');
    expect(toc[0].children![0].text).toBe('child');
    expect(toc[0].children![0].children![0].text).toBe('grandchild');
  });

  it('pops the stack correctly for sibling headings', () => {
    const md = '# a\n## a1\n## a2\n# b';
    const toc = new TOCGenerator().generate(md);
    expect(toc.map((i) => i.text)).toEqual(['a', 'b']);
    expect(toc[0].children!.map((c) => c.text)).toEqual(['a1', 'a2']);
    expect(toc[1].children).toEqual([]);
  });

  it('handles skipped heading levels (h1 → h3 with no h2)', () => {
    const md = '# top\n### deep\n## normal';
    const toc = new TOCGenerator().generate(md);
    expect(toc[0].text).toBe('top');
    expect(toc[0].children!.map((c) => c.text)).toEqual(['deep', 'normal']);
  });

  it('ignores headings that appear inside fenced code blocks', () => {
    const md =
      '# real heading\n\n```\n# not a heading\n## also not\n```\n\n## another real';
    const toc = new TOCGenerator().generate(md);
    const flat: string[] = [];
    const walk = (items: typeof toc) => {
      items.forEach((i) => {
        flat.push(i.text);
        if (i.children) walk(i.children);
      });
    };
    walk(toc);
    expect(flat).toEqual(['real heading', 'another real']);
  });

  it('respects maxDepth option', () => {
    const md = '# a\n## b\n### c\n#### d';
    const toc = new TOCGenerator({ maxDepth: 2 }).generate(md);
    expect(toc[0].text).toBe('a');
    expect(toc[0].children![0].text).toBe('b');
    // depth 2 excludes h3 and h4
    expect(toc[0].children![0].children).toEqual([]);
  });

  it('respects minHeadingLevel and maxHeadingLevel options', () => {
    const md = '# skip-me\n## keep\n### keep-too\n#### skip-me-too';
    const toc = new TOCGenerator({
      minHeadingLevel: 2,
      maxHeadingLevel: 3,
    }).generate(md);
    const flat: string[] = [];
    const walk = (items: typeof toc) => {
      items.forEach((i) => {
        flat.push(i.text);
        if (i.children) walk(i.children);
      });
    };
    walk(toc);
    expect(flat).toEqual(['keep', 'keep-too']);
  });

  it('returns an empty array for content with no headings', () => {
    const toc = new TOCGenerator().generate(
      'just body text\n\nwith paragraphs'
    );
    expect(toc).toEqual([]);
  });
});

describe('TOCGenerator slug generation', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    const toc = new TOCGenerator().generate('## Hello World');
    expect(toc[0].id).toBe('hello-world');
  });

  it('strips punctuation from slugs', () => {
    const toc = new TOCGenerator().generate("## What's new? (2026 edition)!");
    expect(toc[0].id).toBe('whats-new-2026-edition');
  });

  it('collapses multiple spaces into a single hyphen', () => {
    const toc = new TOCGenerator().generate('##   Triple   Spaced   ');
    expect(toc[0].id).toBe('triple-spaced');
  });

  it('produces matching slugs for repeated headings (collision documented)', () => {
    // The generator does not de-duplicate. Callers that care must do it.
    const toc = new TOCGenerator().generate('## intro\n## intro');
    expect(toc[0].id).toBe('intro');
    expect(toc[1].id).toBe('intro');
  });

  it('strips leading and trailing hyphens from slugs', () => {
    const toc = new TOCGenerator().generate('## -leading- and -trailing-');
    expect(toc[0].id).not.toMatch(/^-/);
    expect(toc[0].id).not.toMatch(/-$/);
  });

  it('handles non-ASCII text by stripping to basic word chars', () => {
    const toc = new TOCGenerator().generate('## Café résumé');
    // Non-ASCII letters are stripped by the [^\w\s-] regex
    expect(toc[0].id).toBe('caf-rsum');
  });
});

describe('TOCGenerator.generateFromHTML', () => {
  it('extracts headings and levels from HTML', () => {
    const html = '<h1>Top</h1><h2>Mid</h2><h3>Deep</h3>';
    const toc = new TOCGenerator().generateFromHTML(html);
    expect(toc[0].text).toBe('Top');
    expect(toc[0].children![0].text).toBe('Mid');
    expect(toc[0].children![0].children![0].text).toBe('Deep');
  });

  it('prefers existing id attributes over generated slugs', () => {
    const html = '<h2 id="custom-slug">Display Text</h2>';
    const toc = new TOCGenerator().generateFromHTML(html);
    expect(toc[0].id).toBe('custom-slug');
    expect(toc[0].text).toBe('Display Text');
  });

  it('generates slug from text when id attribute is missing', () => {
    const html = '<h2>Auto Slug Here</h2>';
    const toc = new TOCGenerator().generateFromHTML(html);
    expect(toc[0].id).toBe('auto-slug-here');
  });

  it('is case-insensitive on tag names', () => {
    const html = '<H1>upper</H1><h2>lower</h2>';
    const toc = new TOCGenerator().generateFromHTML(html);
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe('upper');
    expect(toc[0].children![0].text).toBe('lower');
  });
});

describe('TOCGenerator.flatten', () => {
  it('flattens a nested tree with depth indices', () => {
    const md = '# a\n## b\n### c\n## d';
    const toc = new TOCGenerator().generate(md);
    const flat = new TOCGenerator().flatten(toc);
    expect(flat.map((i) => i.text)).toEqual(['a', 'b', 'c', 'd']);
    expect(flat.map((i) => i.depth)).toEqual([0, 1, 2, 1]);
  });

  it('returns an empty list when the TOC is empty', () => {
    expect(new TOCGenerator().flatten([])).toEqual([]);
  });
});

describe('TOCGenerator.toHTML', () => {
  it('renders unordered list by default', () => {
    const md = '## one\n## two';
    const toc = new TOCGenerator().generate(md);
    const html = new TOCGenerator().toHTML(toc);
    expect(html.startsWith('<ul class="toc">')).toBe(true);
    expect(html).toContain('<a href="#one" class="toc-link">one</a>');
    expect(html).toContain('<a href="#two" class="toc-link">two</a>');
  });

  it('renders ordered list when listType is ol', () => {
    const md = '## a';
    const toc = new TOCGenerator().generate(md);
    const html = new TOCGenerator().toHTML(toc, { listType: 'ol' });
    expect(html.startsWith('<ol class="toc">')).toBe(true);
  });

  it('nests child lists inside parent list items', () => {
    const md = '## parent\n### child';
    const toc = new TOCGenerator().generate(md);
    const html = new TOCGenerator().toHTML(toc);
    // child <ul> must appear before the parent's closing </li>
    expect(html).toMatch(
      /<li><a[^>]*>parent<\/a><ul[^>]*><li><a[^>]*>child<\/a><\/li><\/ul><\/li>/
    );
  });

  it('escapes HTML entities in heading text', () => {
    const md = '## a & b <c>';
    const toc = new TOCGenerator().generate(md);
    const html = new TOCGenerator().toHTML(toc);
    expect(html).toContain('a &amp; b &lt;c&gt;');
    expect(html).not.toContain('<c>');
  });

  it('accepts custom class names', () => {
    const md = '## x';
    const toc = new TOCGenerator().generate(md);
    const html = new TOCGenerator().toHTML(toc, {
      className: 'custom-toc',
      linkClassName: 'custom-link',
    });
    expect(html).toContain('class="custom-toc"');
    expect(html).toContain('class="custom-link"');
  });

  it('returns an empty string for an empty TOC', () => {
    expect(new TOCGenerator().toHTML([])).toBe('');
  });
});

describe('TOCGenerator.toMarkdown', () => {
  it('renders a flat TOC as a one-level bullet list', () => {
    const md = '## alpha\n## beta';
    const toc = new TOCGenerator().generate(md);
    const out = new TOCGenerator().toMarkdown(toc);
    expect(out).toBe('- [alpha](#alpha)\n- [beta](#beta)');
  });

  it('indents nested items with two spaces per level', () => {
    const md = '## parent\n### child\n#### grand';
    // Default maxDepth is 3; bump to 4 so the grandchild is included
    const toc = new TOCGenerator({ maxDepth: 4 }).generate(md);
    const out = new TOCGenerator().toMarkdown(toc);
    expect(out).toContain('- [parent](#parent)');
    expect(out).toContain('  - [child](#child)');
    expect(out).toContain('    - [grand](#grand)');
  });

  it('returns empty string for empty TOC', () => {
    expect(new TOCGenerator().toMarkdown([])).toBe('');
  });
});

describe('TOCGenerator.findById', () => {
  it('finds a top-level item', () => {
    const md = '## target\n## other';
    const toc = new TOCGenerator().generate(md);
    const found = new TOCGenerator().findById(toc, 'target');
    expect(found?.text).toBe('target');
  });

  it('finds a deeply nested item', () => {
    const md = '## a\n### b\n#### c';
    // Default maxDepth is 3; bump to 4 so grandchild is part of the tree
    const toc = new TOCGenerator({ maxDepth: 4 }).generate(md);
    const found = new TOCGenerator().findById(toc, 'c');
    expect(found?.text).toBe('c');
  });

  it('returns null when id is not present', () => {
    const md = '## exists';
    const toc = new TOCGenerator().generate(md);
    expect(new TOCGenerator().findById(toc, 'missing')).toBeNull();
  });
});

describe('TOCGenerator.getNavigation', () => {
  it('returns previous, current, and next for a middle item', () => {
    const md = '## one\n## two\n## three';
    const toc = new TOCGenerator().generate(md);
    const nav = new TOCGenerator().getNavigation(toc, 'two');
    expect(nav.previous?.text).toBe('one');
    expect(nav.current?.text).toBe('two');
    expect(nav.next?.text).toBe('three');
  });

  it('returns null previous for the first item', () => {
    const md = '## one\n## two';
    const toc = new TOCGenerator().generate(md);
    const nav = new TOCGenerator().getNavigation(toc, 'one');
    expect(nav.previous).toBeNull();
    expect(nav.next?.text).toBe('two');
  });

  it('returns null next for the last item', () => {
    const md = '## one\n## two';
    const toc = new TOCGenerator().generate(md);
    const nav = new TOCGenerator().getNavigation(toc, 'two');
    expect(nav.previous?.text).toBe('one');
    expect(nav.next).toBeNull();
  });

  it('returns all nulls when id is not found in TOC', () => {
    const md = '## one';
    const toc = new TOCGenerator().generate(md);
    const nav = new TOCGenerator().getNavigation(toc, 'missing');
    expect(nav).toEqual({ previous: null, current: null, next: null });
  });

  it('walks nested TOC in depth-first order for navigation', () => {
    const md = '## parent\n### child\n## sibling';
    const toc = new TOCGenerator().generate(md);
    const nav = new TOCGenerator().getNavigation(toc, 'child');
    expect(nav.previous?.text).toBe('parent');
    expect(nav.next?.text).toBe('sibling');
  });
});

describe('TOCGenerator singleton', () => {
  it('exposes a usable default instance', () => {
    const toc = tocGenerator.generate('## from singleton');
    expect(toc[0].text).toBe('from singleton');
  });
});
