import matter from 'gray-matter';
import Markdown from 'markdown-to-jsx';
import { createElement } from 'react';
import {
  blogHeadingDemotion,
  generateBlogHeadingId,
  renderBlogMarkdown,
  stripBlogFences,
} from './render';

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
    const demote = blogHeadingDemotion(content, this.options.demoteHeadings);
    // SCAN THE SAME TEXT THE RENDERER DOES (#483). Scanning raw markdown gave a
    // TOC entry to every `# comment` inside a fenced code block, and those never
    // render a heading — so the anchor pointed at nothing. Measured on
    // production: 7 of 7 TOC anchors dead on /blog/playable-city-chattanooga,
    // 8 of 13 on countdown-timer-tutorial, 7 of 17 on admin-dashboard-overview.
    const scannable = stripBlogFences(content);
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
      const id = generateBlogHeadingId(text);

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
   * Render through the blog-specific safe GFM pipeline. Metadata extraction
   * stays in this class so its public ProcessedContent contract is unchanged.
   */
  private renderMarkdown(content: string): string {
    return renderBlogMarkdown(content, this.options);
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
