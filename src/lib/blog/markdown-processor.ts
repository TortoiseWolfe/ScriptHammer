import matter from 'gray-matter';
import Markdown from 'markdown-to-jsx';
import { createElement } from 'react';
import Prism from 'prismjs';

// Import language support
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-yaml';

import type {
  ProcessedContent,
  FrontMatter,
  MarkdownProcessorOptions,
  TOCItem,
  ImageMetadata,
  LinkMetadata,
  CodeBlock,
} from '@/types/metadata';

export class MarkdownProcessor {
  private options: MarkdownProcessorOptions;

  /**
   * Sanitize a URL to prevent XSS via javascript:, data:, or vbscript: protocols
   */
  private static sanitizeUrl(url: string): string {
    const trimmed = url.trim();
    // Block dangerous protocols
    if (/^\s*(javascript|data|vbscript)\s*:/i.test(trimmed)) {
      return '#';
    }
    return trimmed;
  }

  /**
   * Neutralize dangerous raw HTML in markdown prose without stripping the
   * benign structural tags the blog authors rely on (<div>, <span>,
   * <details>, <summary>, <br>, etc.). This is a targeted denylist, not a
   * full sanitizer — the blog content is author-controlled at build time, so
   * the goal is defense-in-depth so a fork that renders untrusted markdown
   * is not immediately XSS-vulnerable. Removes:
   *   - <script>/<style>/<iframe>/<object>/<embed>/<form>/<link>/<meta> tags
   *     (opening, closing, and their contents where they wrap a payload);
   *   - inline event-handler attributes (onclick=, onerror=, onload=, ...);
   *   - javascript:/vbscript:/data: URIs inside href/src attributes.
   */
  private stripDangerousHtml(input: string): string {
    let out = input;

    // Drop entire dangerous elements including their contents.
    out = out.replace(
      /<(script|style|iframe|object|embed|form|link|meta|base)\b[\s\S]*?<\/\1\s*>/gi,
      ''
    );
    // Drop any leftover self-closing / unclosed dangerous opening tags.
    out = out.replace(
      /<\/?(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi,
      ''
    );
    // Strip inline event-handler attributes (on*=), quoted or unquoted.
    out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    // Neutralize dangerous URIs in href/src attributes.
    out = out.replace(
      /\b(href|src|xlink:href)\s*=\s*("|')?\s*(javascript|vbscript|data)\s*:[^"'>\s]*/gi,
      '$1="#"'
    );

    return out;
  }

  constructor(options: MarkdownProcessorOptions = {}) {
    this.options = {
      enableToc: true,
      enableSyntaxHighlight: true,
      tocMaxDepth: 3,
      excerptLength: 200,
      imageOptimization: true,
      lazyLoadImages: true,
      externalLinksTarget: '_blank',
      sanitize: true,
      ...options,
    };
  }

  /**
   * Process markdown content and extract metadata
   */
  process(markdown: string): ProcessedContent {
    // Parse frontmatter
    const { data: frontMatter, content } = matter(markdown);

    // Extract metadata
    const toc = this.options.enableToc ? this.extractTOC(content) : [];
    const images = this.extractImages(content);
    const links = this.extractLinks(content);
    const codeBlocks = this.extractCodeBlocks(content);

    // Calculate reading time and word count
    const wordCount = this.calculateWordCount(content);
    const readingTime = Math.ceil(wordCount / 200); // Assume 200 words per minute

    // Generate excerpt if not provided
    const excerpt = frontMatter.excerpt || this.generateExcerpt(content);

    // Process markdown to HTML
    const html = this.renderMarkdown(content);

    return {
      html,
      toc,
      metadata: {
        title: frontMatter.title,
        description: frontMatter.description,
        excerpt,
        readingTime,
        wordCount,
        hasCode: codeBlocks.length > 0,
        hasImages: images.length > 0,
        hasLinks: links.length > 0,
        hasMath: this.detectMath(content),
        hasDiagrams: this.detectDiagrams(content),
      },
      images,
      links,
      codeBlocks,
    };
  }

  /**
   * Parse frontmatter from markdown
   */
  parseFrontMatter(markdown: string): FrontMatter {
    const { data } = matter(markdown);
    return data as FrontMatter;
  }

  /**
   * Extract table of contents from markdown
   */
  private extractTOC(content: string): TOCItem[] {
    // Same shift the renderer applies, so the TOC's nesting matches the
    // document's heading levels rather than drifting one level apart (#373 §C5).
    const demote = this.headingDemotion(content);
    // SCAN THE SAME TEXT THE RENDERER DOES (#483). Scanning raw markdown gave a
    // TOC entry to every `# comment` inside a fenced code block, and those never
    // render a heading — so the anchor pointed at nothing. Measured on
    // production: 7 of 7 TOC anchors dead on /blog/playable-city-chattanooga,
    // 8 of 13 on countdown-timer-tutorial, 7 of 17 on admin-dashboard-overview.
    const scannable = this.stripFences(content);
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const toc: TOCItem[] = [];
    const stack: TOCItem[] = [];

    let match;
    while ((match = headingRegex.exec(scannable)) !== null) {
      const level = Math.min(6, match[1].length + demote) as
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6;

      if (level > (this.options.tocMaxDepth || 3)) continue;

      const text = match[2].trim();
      const id = this.generateId(text);

      const item: TOCItem = {
        id,
        text,
        level,
        children: [],
      };

      // Find parent based on level
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        toc.push(item);
      } else {
        const parent = stack[stack.length - 1];
        if (!parent.children) parent.children = [];
        parent.children.push(item);
      }

      stack.push(item);
    }

    return toc;
  }

  /**
   * Extract images from markdown
   */
  private extractImages(content: string): ImageMetadata[] {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const images: ImageMetadata[] = [];

    let match;
    while ((match = imageRegex.exec(content)) !== null) {
      images.push({
        src: match[2],
        alt: match[1] || '',
        loading: this.options.lazyLoadImages ? 'lazy' : 'eager',
      });
    }

    return images;
  }

  /**
   * Extract links from markdown
   */
  private extractLinks(content: string): LinkMetadata[] {
    const linkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;
    const links: LinkMetadata[] = [];

    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const href = match[2];
      const isExternal =
        href.startsWith('http://') || href.startsWith('https://');

      links.push({
        href,
        text: match[1],
        isExternal,
        target: isExternal
          ? this.options.externalLinksTarget || '_blank'
          : '_self',
        rel: isExternal ? 'noopener noreferrer' : undefined,
      });
    }

    return links;
  }

  /**
   * Extract code blocks from markdown
   */
  private extractCodeBlocks(content: string): CodeBlock[] {
    const codeBlockRegex = /```(\w+)?(?:\s+([^\n]+))?\n([\s\S]*?)```/g;
    const codeBlocks: CodeBlock[] = [];

    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[3].trim(),
        filename: match[2],
        showLineNumbers: true,
      });
    }

    return codeBlocks;
  }

  /**
   * Calculate word count
   */
  private calculateWordCount(content: string): number {
    // Remove code blocks
    const withoutCode = content.replace(/```[\s\S]*?```/g, '');
    // Remove markdown syntax
    const plainText = withoutCode
      .replace(/[#*_~`>/\[\]()!-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return plainText.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Generate excerpt from content
   */
  private generateExcerpt(content: string): string {
    // Remove headers, code blocks, images
    const cleanContent = content
      .replace(/^#{1,6}\s+.+$/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/[*_~`>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const length = this.options.excerptLength || 200;
    if (cleanContent.length <= length) return cleanContent;

    // Cut at word boundary
    const excerpt = cleanContent.substring(0, length);
    const lastSpace = excerpt.lastIndexOf(' ');

    return lastSpace > 0
      ? excerpt.substring(0, lastSpace) + '...'
      : excerpt + '...';
  }

  /**
   * Detect if content contains math
   */
  private detectMath(content: string): boolean {
    // Check for LaTeX math delimiters
    return (
      /\$\$[\s\S]+?\$\$|\$[^$]+\$/g.test(content) ||
      /\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/g.test(content)
    );
  }

  /**
   * Detect if content contains diagrams
   */
  private detectDiagrams(content: string): boolean {
    // Check for mermaid or other diagram syntaxes
    return /```(?:mermaid|graph|sequenceDiagram|gantt|flowchart)/i.test(
      content
    );
  }

  /**
   * Generate ID from text
   */
  /**
   * How many levels to demote every body heading by (#373 §C5).
   *
   * The page template already renders the post title as the document's `h1`.
   * 11 of 13 posts ALSO open with a `# ` heading in the body — usually the
   * title repeated, sometimes with a leading emoji — so those pages render two
   * `h1` elements, and `countdown-timer-tutorial` renders six because it uses
   * `# ` for every section.
   *
   * Demoting by one puts the body under the title: `# ` becomes `h2`, `## `
   * becomes `h3`, and so on. Nothing is deleted and no text is rewritten, so
   * every emoji the author put in a heading is preserved exactly.
   *
   * ONLY when the body actually has an `h1`. A blanket demote would push the
   * `## ` headings of the two posts that are already correct down to `h3`,
   * creating an h1 -> h3 skip where there is none today — a regression, not a
   * fix.
   *
   * Fenced code is stripped before testing, because a shell comment or a
   * markdown example inside a fence is not a heading. Counting `^# ` in the raw
   * file reports 17 for `countdown-timer-tutorial`, which renders 6.
   *
   * Measured: no post renders an `h6`, so shifting down one cannot overflow
   * past `h6`. The deepest result is `h5`.
   */
  /**
   * Markdown with fenced code blocks removed (#483).
   *
   * `renderMarkdown` pulls code blocks out to placeholders BEFORE converting
   * headings — its own comment says "after code blocks to avoid converting # in
   * code". Anything that reasons about HEADINGS has to see the same thing, or it
   * counts shell comments and markdown examples as headings.
   *
   * Deliberately NOT used by extractImages / extractLinks / extractCodeBlocks:
   * those legitimately scan the raw source.
   */
  private stripFences(content: string): string {
    return content.replace(/```[\s\S]*?```/g, '');
  }

  private headingDemotion(content: string): number {
    if (!this.options.demoteHeadings) return 0;
    return /^#\s+\S/m.test(this.stripFences(content)) ? 1 : 0;
  }

  private generateId(text: string): string {
    return (
      text
        .toLowerCase()
        // Strips emoji and punctuation — but leaves the SPACE that followed
        // them, which the next rule turns into a leading hyphen.
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        // TRIM HYPHENS, NOT JUST WHITESPACE (#483).
        //
        // `.trim()` alone removes whitespace, and by this point there is none
        // left — the leading space has already become a `-`. So a heading that
        // opens with an emoji produced `-the-twin-we-already-have` while every
        // link to it, hand-written or generated, points at
        // `#the-twin-we-already-have`. Measured on production: 7 of 7 in-page
        // anchors dead on /blog/playable-city-chattanooga, and every affected
        // heading starts with an emoji (🌆 🗺️ 🏙️ 🧭 🎯 ⚠️ 💬).
        //
        // Also collapses runs, so `A — B` cannot yield `a---b`.
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    );
  }

  /**
   * Render markdown to HTML string
   */
  private renderMarkdown(content: string): string {
    // Convert markdown to HTML using a simple conversion
    // This handles the most common markdown patterns
    let html = content;

    // Store code blocks with placeholders to protect them from markdown processing
    const codeBlocks: string[] = [];
    const CODE_PLACEHOLDER = '___CODE_BLOCK_PLACEHOLDER___';

    // Convert code blocks FIRST (before other conversions)
    // This protects code content from being transformed by other markdown rules
    html = html.replace(
      /```(\w+)?[ \t]*\n([\s\S]*?)```/g,
      (match, lang, code) => {
        const trimmedCode = code.trim();
        const language = lang || 'text';

        // Apply Prism syntax highlighting on the server
        let highlightedCode: string;

        try {
          // Check if language is supported
          const grammar = Prism.languages[language];
          if (grammar) {
            // Tokenize and highlight the code
            highlightedCode = Prism.highlight(trimmedCode, grammar, language);
          } else {
            // Fallback: escape HTML entities for unsupported languages
            highlightedCode = trimmedCode
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          }
        } catch (error) {
          // Fallback on error: escape HTML entities
          highlightedCode = trimmedCode
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        }

        const codeHtml = `<pre><code class="language-${language}">${highlightedCode}</code></pre>`;

        // Store the code block and return a placeholder
        const index = codeBlocks.length;
        codeBlocks.push(codeHtml);
        return `${CODE_PLACEHOLDER}${index}`;
      }
    );

    // Neutralize dangerous RAW HTML in the markdown body. Code blocks are
    // already extracted to placeholders above, so this only touches prose.
    // The blog intentionally allows benign structural tags (<div>, <span>,
    // <details>, <summary>, <br>) authored in .md, so we do NOT strip all
    // HTML — only the script/style/iframe/etc. sinks, event-handler
    // attributes, and javascript: URIs. This makes a fork that later renders
    // untrusted markdown safe by default (XSS defense-in-depth).
    html = this.stripDangerousHtml(html);

    // Convert headers (after code blocks to avoid converting # in code)
    // Add IDs to headers for TOC navigation.
    //
    // ONE level-aware pass, replacing six independent replaces (#373 §C5). The
    // old cascade ran deepest-first so that `###` could not be eaten by the `#`
    // pattern; matching `#{1,6}` in a single pass removes that ordering
    // dependency entirely.
    //
    // `demote` shifts the body under the template's `h1` — see
    // headingDemotion(). The heading TEXT is passed through untouched, so
    // emoji and everything else survive exactly as authored; only the tag
    // number changes.
    const demote = this.headingDemotion(content);
    html = html.replace(
      /^(#{1,6}) (.*?)$/gm,
      (_match, hashes: string, text: string) => {
        const level = Math.min(6, hashes.length + demote);
        const id = this.generateId(text);
        return `<h${level} id="${id}">${text}</h${level}>`;
      }
    );

    // Convert inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert horizontal rules
    html = html.replace(/^---$/gm, '<hr />');

    // Convert lists (before converting asterisks to emphasis)
    // Ordered lists (numbered)
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ordered">$1</li>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

    // Group consecutive ordered li elements into ol
    html = html.replace(
      /(<li class="ordered">.*?<\/li>\n?)(<li class="ordered">.*?<\/li>\n?)*/gm,
      (match) => {
        // Remove the class attribute since we're wrapping in ol
        const cleanedMatch = match.replace(/ class="ordered"/g, '');
        return `<ol>\n${cleanedMatch}</ol>`;
      }
    );

    // Group consecutive unordered li elements into ul
    html = html.replace(/(<li>.*?<\/li>\n?)(<li>.*?<\/li>\n?)*/gm, (match) => {
      return `<ul>\n${match}</ul>`;
    });

    // Temporarily replace the CODE_PLACEHOLDER to protect it from underscore processing
    const TEMP_PLACEHOLDER = '§§§CODEBLOCKPLACEHOLDER§§§';
    html = html.replace(
      new RegExp(CODE_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      TEMP_PLACEHOLDER
    );

    // Convert bold (must be done before italic)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Convert italic (single asterisks and underscores)
    html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');

    // Restore the CODE_PLACEHOLDER
    html = html.replace(
      new RegExp(TEMP_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      CODE_PLACEHOLDER
    );

    // Convert images (MUST be before links!)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
      const safeUrl = MarkdownProcessor.sanitizeUrl(url);
      return `<img src="${safeUrl}" alt="${alt}" />`;
    });

    // Convert links (after images to avoid conflicts)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      const safeUrl = MarkdownProcessor.sanitizeUrl(url);
      const isExternal = safeUrl.startsWith('http');
      const attrs = isExternal
        ? ' target="_blank" rel="noopener noreferrer"'
        : '';
      return `<a href="${safeUrl}"${attrs}>${text}</a>`;
    });

    // Convert line breaks to paragraphs
    const blocks = html.split(/\n\n+/);
    const processedBlocks = blocks.map((block) => {
      const trimmed = block.trim();

      // Don't wrap these in p tags
      if (
        !trimmed ||
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<li') ||
        trimmed.startsWith('<pre') ||
        trimmed.startsWith('<code') ||
        trimmed.includes(CODE_PLACEHOLDER) // Check if it contains placeholder
      ) {
        return trimmed;
      }

      // Wrap text content in paragraphs
      return `<p>${trimmed}</p>`;
    });

    const result = processedBlocks.filter((b) => b).join('\n\n');

    // Restore code blocks from placeholders
    let finalHtml = result;
    codeBlocks.forEach((codeBlock, index) => {
      finalHtml = finalHtml.replace(`${CODE_PLACEHOLDER}${index}`, codeBlock);
    });

    return finalHtml;
  }

  /**
   * Create React component from markdown
   */
  renderToReact(markdown: string, options?: any) {
    const { content } = matter(markdown);
    return createElement(Markdown, {
      options: {
        ...options,
        overrides: {
          // Custom component overrides
          a: {
            component: 'a',
            props: {
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          },
          img: {
            component: 'img',
            props: {
              loading: 'lazy',
            },
          },
        },
      },
      children: content,
    });
  }
}

// Export singleton instance
// The singleton is the BLOG's processor — its only consumer is
// `src/app/blog/[slug]/page.tsx`, which renders the post title as the page's
// `h1`. So the body must start at `h2` (#373 §C5). Construct your own
// MarkdownProcessor if you want plain markdown semantics.
export const markdownProcessor = new MarkdownProcessor({
  demoteHeadings: true,
});

export default MarkdownProcessor;
