import type { TOCItem } from '@/types/metadata';

export class TOCGenerator {
  private maxDepth: number;
  private minHeadingLevel: number;
  private maxHeadingLevel: number;

  constructor(
    options: {
      maxDepth?: number;
      minHeadingLevel?: number;
      maxHeadingLevel?: number;
    } = {}
  ) {
    this.maxDepth = options.maxDepth || 3;
    this.minHeadingLevel = options.minHeadingLevel || 1;
    this.maxHeadingLevel = options.maxHeadingLevel || 6;
  }

  /**
   * Generate TOC from markdown content
   */
  generate(markdown: string): TOCItem[] {
    const headings = this.extractHeadings(markdown);
    return this.buildTree(headings);
  }

  /**
   * Generate TOC from HTML content
   */
  generateFromHTML(html: string): TOCItem[] {
    const headings = this.extractHeadingsFromHTML(html);
    return this.buildTree(headings);
  }

  /**
   * Extract headings from markdown
   */
  private extractHeadings(markdown: string): Array<{
    level: number;
    text: string;
    id: string;
  }> {
    // First, remove code blocks to avoid parsing headers inside them
    const withoutCodeBlocks = markdown.replace(/```[\s\S]*?```/g, '');

    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: Array<{ level: number; text: string; id: string }> = [];

    let match;
    while ((match = headingRegex.exec(withoutCodeBlocks)) !== null) {
      const level = match[1].length;

      if (level < this.minHeadingLevel || level > this.maxHeadingLevel) {
        continue;
      }

      const text = match[2].trim();
      const id = this.generateId(text);

      headings.push({ level, text, id });
    }

    return headings;
  }

  /**
   * Extract headings from HTML
   */
  private extractHeadingsFromHTML(html: string): Array<{
    level: number;
    text: string;
    id: string;
  }> {
    const headingRegex = /<h([1-6])[^>]*>([^<]+)<\/h\1>/gi;
    const headings: Array<{ level: number; text: string; id: string }> = [];

    let match;
    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1], 10);

      if (level < this.minHeadingLevel || level > this.maxHeadingLevel) {
        continue;
      }

      const text = this.stripHtml(match[2]).trim();
      const id = this.extractIdFromHTML(match[0]) || this.generateId(text);

      headings.push({ level, text, id });
    }

    return headings;
  }

  /**
   * Build hierarchical TOC tree
   */
  private buildTree(
    headings: Array<{
      level: number;
      text: string;
      id: string;
    }>
  ): TOCItem[] {
    const toc: TOCItem[] = [];
    const stack: TOCItem[] = [];

    for (const heading of headings) {
      const item: TOCItem = {
        id: heading.id,
        text: heading.text,
        level: heading.level as 1 | 2 | 3 | 4 | 5 | 6,
        children: [],
      };

      // Calculate effective depth
      const depth = heading.level - this.minHeadingLevel + 1;

      if (depth > this.maxDepth) {
        continue;
      }

      // Find the appropriate parent
      while (
        stack.length > 0 &&
        stack[stack.length - 1].level >= heading.level
      ) {
        stack.pop();
      }

      if (stack.length === 0) {
        // Top level item
        toc.push(item);
      } else {
        // Child item
        const parent = stack[stack.length - 1];
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(item);
      }

      stack.push(item);
    }

    return toc;
  }

  /**
   * Generate ID from text
   */
  private generateId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .trim();
  }

  /**
   * Extract ID attribute from HTML element
   */
  private extractIdFromHTML(html: string): string | null {
    const idMatch = /id="([^"]+)"/i.exec(html);
    return idMatch ? idMatch[1] : null;
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Flatten TOC tree to list
   */
  flatten(toc: TOCItem[]): Array<{
    id: string;
    text: string;
    level: number;
    depth: number;
  }> {
    const result: Array<{
      id: string;
      text: string;
      level: number;
      depth: number;
    }> = [];

    const traverse = (items: TOCItem[], depth: number = 0) => {
      for (const item of items) {
        result.push({
          id: item.id,
          text: item.text,
          level: item.level,
          depth,
        });

        if (item.children && item.children.length > 0) {
          traverse(item.children, depth + 1);
        }
      }
    };

    traverse(toc);
    return result;
  }

  /**
   * Generate HTML for TOC
   */
  toHTML(
    toc: TOCItem[],
    options: {
      listType?: 'ul' | 'ol';
      className?: string;
      linkClassName?: string;
    } = {}
  ): string {
    const {
      listType = 'ul',
      className = 'toc',
      linkClassName = 'toc-link',
    } = options;

    const renderItems = (items: TOCItem[]): string => {
      if (items.length === 0) return '';

      const listTag = listType;
      let html = `<${listTag} class="${className}">`;

      for (const item of items) {
        html += '<li>';
        html += `<a href="#${item.id}" class="${linkClassName}">${this.escapeHtml(item.text)}</a>`;

        if (item.children && item.children.length > 0) {
          html += renderItems(item.children);
        }

        html += '</li>';
      }

      html += `</${listTag}>`;
      return html;
    };

    return renderItems(toc);
  }

  /**
   * Generate markdown for TOC
   */
  toMarkdown(toc: TOCItem[]): string {
    const lines: string[] = [];

    const renderItems = (items: TOCItem[], indent: number = 0) => {
      for (const item of items) {
        const prefix = '  '.repeat(indent) + '- ';
        lines.push(`${prefix}[${item.text}](#${item.id})`);

        if (item.children && item.children.length > 0) {
          renderItems(item.children, indent + 1);
        }
      }
    };

    renderItems(toc);
    return lines.join('\n');
  }

  /**
   * Find TOC item by ID
   */
  findById(toc: TOCItem[], id: string): TOCItem | null {
    for (const item of toc) {
      if (item.id === id) {
        return item;
      }

      if (item.children) {
        const found = this.findById(item.children, id);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Get navigation links (previous, current, next)
   */
  getNavigation(
    toc: TOCItem[],
    currentId: string
  ): {
    previous: TOCItem | null;
    current: TOCItem | null;
    next: TOCItem | null;
  } {
    const flattened = this.flatten(toc);
    const currentIndex = flattened.findIndex((item) => item.id === currentId);

    if (currentIndex === -1) {
      return { previous: null, current: null, next: null };
    }

    const current = this.findById(toc, currentId);
    const previous =
      currentIndex > 0
        ? this.findById(toc, flattened[currentIndex - 1].id)
        : null;
    const next =
      currentIndex < flattened.length - 1
        ? this.findById(toc, flattened[currentIndex + 1].id)
        : null;

    return { previous, current, next };
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}

// Export singleton instance
export const tocGenerator = new TOCGenerator();

export default TOCGenerator;
