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
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const toc: TOCItem[] = [];
    const stack: TOCItem[] = [];

    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;

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
  private generateId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
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

    // Convert headers (after code blocks to avoid converting # in code)
    // Add IDs to headers for TOC navigation
    html = html.replace(/^###### (.*?)$/gm, (match, text) => {
      const id = this.generateId(text);
      return `<h6 id="${id}">${text}</h6>`;
    });
    html = html.replace(/^##### (.*?)$/gm, (match, text) => {
      const id = this.generateId(text);
      return `<h5 id="${id}">${text}</h5>`;
    });
    html = html.replace(/^#### (.*?)$/gm, (match, text) => {
      const id = this.generateId(text);
      return `<h4 id="${id}">${text}</h4>`;
    });
    html = html.replace(/^### (.*?)$/gm, (match, text) => {
      const id = this.generateId(text);
      return `<h3 id="${id}">${text}</h3>`;
    });
    html = html.replace(/^## (.*?)$/gm, (match, text) => {
      const id = this.generateId(text);
      return `<h2 id="${id}">${text}</h2>`;
    });
    html = html.replace(/^# (.*?)$/gm, (match, text) => {
      const id = this.generateId(text);
      return `<h1 id="${id}">${text}</h1>`;
    });

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
    html = html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" />'
    );

    // Convert links (after images to avoid conflicts)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

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
export const markdownProcessor = new MarkdownProcessor();

export default MarkdownProcessor;
