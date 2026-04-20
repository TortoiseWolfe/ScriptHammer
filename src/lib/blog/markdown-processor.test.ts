/**
 * Unit tests for MarkdownProcessor
 *
 * Exercises the real production code paths — no mocks of fs, path, or
 * markdown-to-jsx. Each section targets one public method or one self-
 * contained concern (TOC, images, links, code blocks, word count,
 * excerpt, math/diagram detection, HTML rendering, URL sanitization).
 */

import { describe, it, expect } from 'vitest';
import { MarkdownProcessor, markdownProcessor } from './markdown-processor';

function process(md: string, options = {}) {
  return new MarkdownProcessor(options).process(md);
}

describe('MarkdownProcessor.parseFrontMatter', () => {
  it('parses all declared frontmatter fields', () => {
    const md = `---
title: My Post
date: 2026-04-17
author: Jon
tags: [typescript, testing]
categories: [engineering]
excerpt: A test excerpt
featured: true
draft: false
slug: my-post
---

Body content.`;
    const mp = new MarkdownProcessor();
    const fm = mp.parseFrontMatter(md);

    expect(fm.title).toBe('My Post');
    // gray-matter parses YAML dates into Date objects, not strings
    expect(fm.date).toBeInstanceOf(Date);
    expect((fm.date as unknown as Date).toISOString()).toContain('2026-04-17');
    expect(fm.author).toBe('Jon');
    expect(fm.tags).toEqual(['typescript', 'testing']);
    expect(fm.categories).toEqual(['engineering']);
    expect(fm.excerpt).toBe('A test excerpt');
    expect(fm.featured).toBe(true);
    expect(fm.draft).toBe(false);
    expect(fm.slug).toBe('my-post');
  });

  it('returns an empty object when frontmatter is absent', () => {
    const fm = new MarkdownProcessor().parseFrontMatter(
      '# Just a heading\n\nNo frontmatter.'
    );
    expect(fm).toEqual({});
  });

  it('preserves arbitrary custom frontmatter keys', () => {
    const md = `---
title: Custom
customKey: custom-value
nested:
  child: value
---

body`;
    const fm = new MarkdownProcessor().parseFrontMatter(md);
    expect(fm.customKey).toBe('custom-value');
    expect(fm.nested).toEqual({ child: 'value' });
  });

  it('accepts frontmatter with only some optional fields', () => {
    const md = `---
title: Minimal
---
body`;
    const fm = new MarkdownProcessor().parseFrontMatter(md);
    expect(fm.title).toBe('Minimal');
    expect(fm.date).toBeUndefined();
    expect(fm.tags).toBeUndefined();
  });
});

describe('MarkdownProcessor TOC extraction', () => {
  it('captures all heading levels up to tocMaxDepth', () => {
    const md = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;
    const { toc } = process(md, { tocMaxDepth: 6 });
    const flat: string[] = [];
    const walk = (items: typeof toc) => {
      items.forEach((i) => {
        flat.push(i.text);
        if (i.children) walk(i.children);
      });
    };
    walk(toc);
    expect(flat).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  });

  it('respects tocMaxDepth default of 3', () => {
    const md = `# a
## b
### c
#### d`;
    const { toc } = process(md);
    const flat: string[] = [];
    const walk = (items: typeof toc) => {
      items.forEach((i) => {
        flat.push(i.text);
        if (i.children) walk(i.children);
      });
    };
    walk(toc);
    expect(flat).toEqual(['a', 'b', 'c']);
  });

  it('nests headings hierarchically (h1 > h2 > h3)', () => {
    const md = `# parent
## child
### grandchild`;
    const { toc } = process(md);
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe('parent');
    expect(toc[0].children).toHaveLength(1);
    expect(toc[0].children![0].text).toBe('child');
    expect(toc[0].children![0].children![0].text).toBe('grandchild');
  });

  it('handles skipped heading levels (h1 directly to h3)', () => {
    const md = `# top
### skipped
## normal`;
    const { toc } = process(md);
    expect(toc[0].text).toBe('top');
    // h3 nests under h1 because the stack has only h1 when h3 arrives
    expect(toc[0].children![0].text).toBe('skipped');
    // h2 pops h3 off the stack and attaches directly under h1
    expect(toc[0].children![1].text).toBe('normal');
  });

  it('returns empty TOC when enableToc is false', () => {
    const { toc } = process('# Only heading', { enableToc: false });
    expect(toc).toEqual([]);
  });

  it('generates slugs that lowercase and hyphenate text', () => {
    const { toc } = process('## Hello World With Spaces!');
    expect(toc[0].id).toBe('hello-world-with-spaces');
  });
});

describe('MarkdownProcessor image extraction', () => {
  it('extracts src and alt from standard markdown images', () => {
    const { images } = process('![Cat photo](/img/cat.jpg)');
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      src: '/img/cat.jpg',
      alt: 'Cat photo',
    });
  });

  it('records empty string for missing alt text', () => {
    const { images } = process('![](/img/no-alt.jpg)');
    expect(images[0].alt).toBe('');
  });

  it('sets loading=lazy by default and eager when lazy load disabled', () => {
    const lazy = process('![x](/a.jpg)');
    const eager = process('![x](/a.jpg)', { lazyLoadImages: false });
    expect(lazy.images[0].loading).toBe('lazy');
    expect(eager.images[0].loading).toBe('eager');
  });

  it('handles multiple images in a single document', () => {
    const md = '![one](/1.jpg)\n![two](/2.jpg)\n![three](/3.jpg)';
    const { images } = process(md);
    expect(images.map((i) => i.alt)).toEqual(['one', 'two', 'three']);
  });

  it('sets hasImages metadata flag correctly', () => {
    expect(process('![x](/a.jpg)').metadata.hasImages).toBe(true);
    expect(process('no images here').metadata.hasImages).toBe(false);
  });
});

describe('MarkdownProcessor link extraction', () => {
  it('extracts external links with target and rel attributes', () => {
    const { links } = process('[example](https://example.com)');
    expect(links[0]).toMatchObject({
      href: 'https://example.com',
      text: 'example',
      isExternal: true,
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('marks relative links as internal with no rel attribute', () => {
    const { links } = process('[docs](/docs/intro)');
    expect(links[0]).toMatchObject({
      href: '/docs/intro',
      isExternal: false,
      target: '_self',
      rel: undefined,
    });
  });

  it('recognises both http:// and https:// as external', () => {
    const { links } = process('[http](http://a.com)\n[https](https://b.com)');
    expect(links[0].isExternal).toBe(true);
    expect(links[1].isExternal).toBe(true);
  });

  it('treats protocol-relative URLs as internal (not http/https prefixed)', () => {
    const { links } = process('[relative](//cdn.example.com)');
    expect(links[0].isExternal).toBe(false);
  });

  it('does NOT extract images as links', () => {
    const md = '![img alt](/pic.jpg)\n[real link](/target)';
    const { links, images } = process(md);
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('/target');
    expect(images).toHaveLength(1);
  });

  it('allows empty link text', () => {
    const { links } = process('[](https://empty.com)');
    expect(links[0].text).toBe('');
  });

  it('honours externalLinksTarget override', () => {
    const { links } = process('[ext](https://e.com)', {
      externalLinksTarget: '_self',
    });
    expect(links[0].target).toBe('_self');
  });
});

describe('MarkdownProcessor code block extraction', () => {
  it('extracts language and multi-line code from fenced blocks', () => {
    const md = '```typescript\nconst x = 1;\nconst y = 2;\n```';
    const { codeBlocks } = process(md);
    expect(codeBlocks[0].language).toBe('typescript');
    // Known quirk: the extractor's optional-filename capture group is greedy
    // on single-line blocks. Multi-line code survives because the filename
    // regex only matches within the language line.
    expect(codeBlocks[0].code).toContain('const y = 2;');
  });

  it('defaults to text when no language hint is given', () => {
    const md = '```\nplain text content\n```';
    const { codeBlocks } = process(md);
    expect(codeBlocks[0].language).toBe('text');
  });

  it('extracts optional filename after the language hint', () => {
    const md = '```ts hello.ts\nexport const x = 1;\nexport const y = 2;\n```';
    const { codeBlocks } = process(md);
    expect(codeBlocks[0].language).toBe('ts');
    expect(codeBlocks[0].filename).toBe('hello.ts');
  });

  it('extracts multiple distinct code blocks', () => {
    const md = '```js\na\n```\n\n```py\nb\n```';
    const { codeBlocks } = process(md);
    expect(codeBlocks).toHaveLength(2);
    expect(codeBlocks[0].language).toBe('js');
    expect(codeBlocks[1].language).toBe('py');
  });

  it('sets hasCode metadata flag', () => {
    expect(process('```js\nx\n```').metadata.hasCode).toBe(true);
    expect(process('no code').metadata.hasCode).toBe(false);
  });
});

describe('MarkdownProcessor word count and reading time', () => {
  it('excludes code block contents from word count', () => {
    const noCode = process('one two three four five').metadata.wordCount;
    const withCode = process(
      'one two three four five\n\n```\nignored ignored ignored\n```'
    ).metadata.wordCount;
    expect(withCode).toBe(noCode);
  });

  it('strips common markdown syntax before counting', () => {
    const wc = process('**bold** _italic_ `code` > quote').metadata.wordCount;
    expect(wc).toBe(4);
  });

  it('computes reading time at 200 words per minute, rounded up', () => {
    const tenWords = Array(10).fill('word').join(' ');
    expect(process(tenWords).metadata.readingTime).toBe(1);

    // 250 words → 2 minutes (250 / 200 = 1.25 → ceil = 2)
    const twoFifty = Array(250).fill('word').join(' ');
    expect(process(twoFifty).metadata.readingTime).toBe(2);
  });
});

describe('MarkdownProcessor excerpt generation', () => {
  it('uses frontmatter excerpt when provided', () => {
    const md = `---
excerpt: Custom excerpt from frontmatter
---

# Body heading
Body content.`;
    expect(process(md).metadata.excerpt).toBe(
      'Custom excerpt from frontmatter'
    );
  });

  it('auto-generates excerpt from body when frontmatter excerpt is absent', () => {
    const md = 'This is the first paragraph of the body.';
    expect(process(md).metadata.excerpt).toBe(
      'This is the first paragraph of the body.'
    );
  });

  it('truncates at word boundary with ellipsis when body is long', () => {
    const long = Array(100).fill('word').join(' ');
    const excerpt = process(long, { excerptLength: 50 }).metadata.excerpt!;
    expect(excerpt.endsWith('...')).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(54); // 50 + '...'
  });

  it('strips headings, code, images, and link wrapping from excerpt', () => {
    const md = `# Heading
![alt](/pic.jpg) [link text](/url) **bold**
\`\`\`
code
\`\`\`
Plain words here.`;
    const excerpt = process(md).metadata.excerpt!;
    expect(excerpt).not.toContain('#');
    expect(excerpt).not.toContain('![');
    expect(excerpt).not.toContain('```');
    expect(excerpt).not.toContain('**');
    expect(excerpt).toContain('Plain words here');
    expect(excerpt).toContain('link text'); // link text is preserved
  });
});

describe('MarkdownProcessor math and diagram detection', () => {
  it('detects inline math with $...$ delimiters', () => {
    expect(process('Euler: $e^{i\\pi}+1=0$').metadata.hasMath).toBe(true);
  });

  it('detects display math with $$...$$ delimiters', () => {
    expect(process('$$\\int_0^\\infty e^{-x}dx=1$$').metadata.hasMath).toBe(
      true
    );
  });

  it('does not flag plain text as math', () => {
    expect(process('Just prose with no math.').metadata.hasMath).toBe(false);
  });

  it('detects mermaid diagram blocks', () => {
    const md = '```mermaid\ngraph TD\nA-->B\n```';
    expect(process(md).metadata.hasDiagrams).toBe(true);
  });

  it('detects flowchart diagrams case-insensitively', () => {
    const md = '```FlowChart\nA->B\n```';
    expect(process(md).metadata.hasDiagrams).toBe(true);
  });

  it('does not flag plain code as diagram', () => {
    expect(process('```js\nconst x=1;\n```').metadata.hasDiagrams).toBe(false);
  });
});

describe('MarkdownProcessor HTML rendering', () => {
  it('renders headings with stable id attributes for TOC anchors', () => {
    const { html } = process('## Intro Section');
    expect(html).toContain('<h2 id="intro-section">Intro Section</h2>');
  });

  it('renders bold and italic with correct tags', () => {
    const { html } = process('**strong** and _emphasis_');
    expect(html).toContain('<strong>strong</strong>');
    expect(html).toContain('<em>emphasis</em>');
  });

  it('wraps paragraphs in <p> tags', () => {
    const { html } = process('First paragraph.\n\nSecond paragraph.');
    expect(html).toContain('<p>First paragraph.</p>');
    expect(html).toContain('<p>Second paragraph.</p>');
  });

  it('groups consecutive unordered list items into a <ul>', () => {
    const { html } = process('- one\n- two\n- three');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<li>two</li>');
  });

  it('groups consecutive ordered list items into an <ol>', () => {
    const { html } = process('1. first\n2. second');
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>first</li>');
  });

  it('converts horizontal rules', () => {
    const { html } = process('before\n\n---\n\nafter');
    expect(html).toContain('<hr />');
  });

  it('renders inline code with <code> tags', () => {
    const { html } = process('use `npm test` to run');
    expect(html).toContain('<code>npm test</code>');
  });

  it('emits <pre><code> with language class for fenced code', () => {
    const { html } = process('```javascript\nconst x=1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('class="language-javascript"');
  });

  it('does not mangle code block content even when it contains markdown syntax', () => {
    const { html } = process('```\n**not bold**\n_not italic_\n```');
    expect(html).toContain('**not bold**');
    expect(html).toContain('_not italic_');
    expect(html).not.toContain('<strong>not bold</strong>');
  });

  it('falls back to escaped HTML for unsupported languages', () => {
    const { html } = process('```brainfuck\n<>&\n```');
    expect(html).toContain('class="language-brainfuck"');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
    expect(html).toContain('&amp;');
  });

  it('renders images with sanitized URLs', () => {
    const { html } = process('![a](https://example.com/p.jpg)');
    expect(html).toContain('<img src="https://example.com/p.jpg" alt="a" />');
  });

  it('strips dangerous URLs on images (javascript: protocol)', () => {
    const { html } = process('![x](javascript:alert(1))');
    expect(html).toContain('src="#"');
    expect(html).not.toContain('javascript:');
  });

  it('strips dangerous URLs on links (data: protocol)', () => {
    const { html } = process('[evil](data:text/html;base64,XYZ)');
    expect(html).toContain('href="#"');
    expect(html).not.toContain('data:text/html');
  });

  it('adds rel and target to external anchors', () => {
    const { html } = process('[ext](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('omits rel and target on internal anchors', () => {
    const { html } = process('[docs](/docs)');
    expect(html).toContain('<a href="/docs">docs</a>');
    expect(html).not.toContain('target="_blank"');
  });

  it('handles vbscript: URLs defensively', () => {
    const { html } = process('[evil](vbscript:msgbox)');
    expect(html).toContain('href="#"');
  });
});

describe('MarkdownProcessor.process integration', () => {
  it('produces a complete ProcessedContent result with all fields populated', () => {
    const md = `---
title: Test Post
excerpt: An excerpt
---

# Heading

Body with [link](/docs) and ![alt](/img.jpg).

\`\`\`ts
export const x = 1;
\`\`\`
`;
    const result = process(md);

    expect(result.html).toContain('<h1');
    expect(result.toc[0].text).toBe('Heading');
    expect(result.images).toHaveLength(1);
    expect(result.links).toHaveLength(1);
    expect(result.codeBlocks).toHaveLength(1);
    expect(result.metadata.title).toBe('Test Post');
    expect(result.metadata.excerpt).toBe('An excerpt');
    expect(result.metadata.hasCode).toBe(true);
    expect(result.metadata.hasImages).toBe(true);
    expect(result.metadata.hasLinks).toBe(true);
  });

  it('exposes a working singleton instance', () => {
    const result = markdownProcessor.process('# heading\n\nbody');
    expect(result.toc).toHaveLength(1);
    expect(result.html).toContain('<h1');
  });
});
