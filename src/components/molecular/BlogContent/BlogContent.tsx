'use client';

import React from 'react';
import { getProjectConfig } from '@/config/project.config';

// Import Prism theme for styling the pre-highlighted code
import 'prismjs/themes/prism-tomorrow.css';
import '@/styles/prism-override.css';
import { ICON_PATHS, type IconName } from '@/components/atomic/Icon';

interface BlogContentProps {
  htmlContent: string;
}

/**
 * An icon as an HTML string (#385).
 *
 * This code block is built as markup in a template literal with an inline
 * `onclick`, not as JSX, so `<Icon>` cannot be used. Attributes are
 * single-quoted deliberately: the surrounding `onclick` is a double-quoted
 * HTML attribute, and double quotes here would terminate it.
 *
 * The button swaps two pre-rendered spans by `display` rather than rewriting
 * `innerHTML`, because injecting SVG markup through an attribute-embedded JS
 * string is exactly where quoting breaks.
 */
function iconSvg(name: IconName, style = ''): string {
  return (
    `<svg width='1em' height='1em' viewBox='0 0 24 24' fill='none' ` +
    `stroke='currentColor' stroke-width='2' stroke-linecap='round' ` +
    `stroke-linejoin='round' aria-hidden='true' style='${style}'>` +
    `<path d='${ICON_PATHS[name]}'/></svg>`
  );
}

function BlogContent({ htmlContent }: BlogContentProps) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Process HTML to add copy buttons to code blocks and fix image paths
  const processedHtml = React.useMemo(() => {
    let codeBlockIndex = 0;
    const config = getProjectConfig();

    // First, fix image paths to include basePath if needed
    let html = htmlContent;
    const basePath = config.basePath || '';

    // Fix img src attributes that start with / (only if basePath exists)
    if (basePath) {
      html = html.replace(/(<img[^>]*src=")(\/)([^"]+)"/g, `$1${basePath}/$3"`);
    }

    // Replace pre/code blocks with mockup-code
    return html.replace(
      /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
      (match, lang, code) => {
        // Use deterministic ID based on index instead of Math.random()
        const id = `code-block-${codeBlockIndex++}`;
        // Code is already escaped by markdown processor, keep it escaped for safety
        // Prism will handle the highlighting after the content is rendered
        return `
          <div class="mockup-code bg-base-300 my-4 relative" data-code-id="${id}">
            <div class="absolute top-2 right-12 text-xs text-base-content">${lang}</div>
            <button
              onclick="navigator.clipboard.writeText(this.parentElement.querySelector('pre').textContent); var i=this.children; i[0].style.display='none'; i[1].style.display='inline'; setTimeout(function(){i[0].style.display='inline'; i[1].style.display='none'}, 2000)"
              class="btn btn-xs btn-ghost absolute top-2 right-2"
              title="Copy code"
            >${iconSvg('copy')}${iconSvg('check', 'display:none')}<span class='sr-only'>Copy code</span></button>
            <pre><code class="language-${lang}" id="${id}">${code}</code></pre>
          </div>
        `;
      }
    );
  }, [htmlContent]);

  // No need for client-side highlighting anymore
  // Server-side highlighting is already applied in markdown-processor.ts

  // Add smooth scrolling for anchor links with offset for header
  React.useEffect(() => {
    // Add scroll padding to account for fixed header (about 90px)
    document.documentElement.style.scrollPaddingTop = '90px';

    return () => {
      // Reset on cleanup
      document.documentElement.style.scrollPaddingTop = '0';
    };
  }, []);

  // Browsers do not consistently move a generic focusable overflow region
  // with horizontal arrow keys. Give the renderer-owned table wrappers an
  // explicit, predictable keyboard contract without changing table semantics.
  React.useEffect(() => {
    const tableScrollers = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>(
        '[data-blog-table-scroll]'
      ) || []
    );

    const handleTableScrollKey = (event: KeyboardEvent) => {
      const scroller = event.currentTarget as HTMLElement;
      const maxScroll = Math.max(
        0,
        scroller.scrollWidth - scroller.clientWidth
      );
      const step = Math.max(40, Math.round(scroller.clientWidth * 0.15));
      let nextScroll: number | undefined;

      if (event.key === 'ArrowRight') {
        nextScroll = Math.min(maxScroll, scroller.scrollLeft + step);
      } else if (event.key === 'ArrowLeft') {
        nextScroll = Math.max(0, scroller.scrollLeft - step);
      } else if (event.key === 'Home') {
        nextScroll = 0;
      } else if (event.key === 'End') {
        nextScroll = maxScroll;
      }

      if (nextScroll !== undefined) {
        event.preventDefault();
        scroller.scrollLeft = nextScroll;
      }
    };

    for (const scroller of tableScrollers) {
      scroller.addEventListener('keydown', handleTableScrollKey);
    }

    return () => {
      for (const scroller of tableScrollers) {
        scroller.removeEventListener('keydown', handleTableScrollKey);
      }
    };
  }, [processedHtml]);

  return (
    <div
      ref={contentRef}
      className="[&>.mockup-code]:not-prose [&_code]:bg-base-200 [&_a]:link [&_a]:link-primary [&_a]:hover:link-hover [&_em]:text-base-content [&_details]:border-base-300 [&_details]:bg-base-200 [&_summary]:hover:bg-base-300 [&_details[open]>summary]:border-base-300 [&_.blog-table-scroll]:border-base-300 [&_.blog-table-scroll]:bg-base-100 [&_.blog-table-scroll]:focus-visible:ring-primary [&_.blog-table-scroll]:focus-visible:ring-offset-base-100 [&_.blog-data-table_th]:border-base-300 [&_.blog-data-table_th]:bg-base-200 [&_.blog-data-table_th]:text-base-content [&_.blog-data-table_td]:border-base-300 [&_.blog-data-table_td]:text-base-content [&_blockquote]:border-primary [&_blockquote]:bg-base-200 [&_blockquote]:text-base-content [&_.blog-data-table]:m-0 [&_.blog-data-table]:table [&_.blog-data-table]:min-w-full [&_.blog-data-table]:border-collapse [&_.blog-data-table]:overflow-visible [&_.blog-data-table]:text-left [&_.blog-data-table]:text-xs sm:[&_.blog-data-table]:text-sm md:[&_.blog-data-table]:text-base [&_.blog-data-table_td]:border-b [&_.blog-data-table_td]:px-3 [&_.blog-data-table_td]:py-2 [&_.blog-data-table_td]:align-top [&_.blog-data-table_td]:break-words sm:[&_.blog-data-table_td]:px-4 sm:[&_.blog-data-table_td]:py-3 [&_.blog-data-table_th]:border-b [&_.blog-data-table_th]:px-3 [&_.blog-data-table_th]:py-2 [&_.blog-data-table_th]:text-left [&_.blog-data-table_th]:font-semibold [&_.blog-data-table_th]:whitespace-nowrap sm:[&_.blog-data-table_th]:px-4 sm:[&_.blog-data-table_th]:py-3 [&_.blog-table-scroll]:my-4 [&_.blog-table-scroll]:w-full [&_.blog-table-scroll]:max-w-full [&_.blog-table-scroll]:overflow-x-auto [&_.blog-table-scroll]:overscroll-x-contain [&_.blog-table-scroll]:rounded-lg [&_.blog-table-scroll]:border [&_.blog-table-scroll]:focus-visible:ring-2 [&_.blog-table-scroll]:focus-visible:ring-offset-2 [&_.blog-table-scroll]:focus-visible:outline-none [&_blockquote]:my-4 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-xs [&_blockquote]:leading-relaxed sm:[&_blockquote]:text-sm md:[&_blockquote]:text-base lg:[&_blockquote]:text-lg [&_blockquote>p]:m-0 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs sm:[&_code]:text-sm md:[&_code]:text-base [&_details]:my-4 [&_details]:rounded-lg [&_details]:border [&_details>*:not(summary)]:p-4 [&_details[open]>summary]:border-b [&_em]:text-xs [&_em]:italic sm:[&_em]:text-sm md:[&_em]:text-base lg:[&_em]:text-lg [&_img]:my-3 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-lg sm:[&_img]:my-4 md:[&_img]:my-6 lg:[&_img]:my-8 [&_li]:text-xs [&_li]:leading-relaxed sm:[&_li]:text-sm md:[&_li]:text-base lg:[&_li]:text-lg [&_summary]:cursor-pointer [&_summary]:p-4 [&_summary]:font-semibold [&_summary]:transition-colors [&>h2]:mt-8 [&>h2]:mb-3 [&>h3]:mt-6 [&>h3]:mb-2 [&>h4]:mt-4 [&>h4]:mb-2 [&>ol]:my-2 [&>ol]:ml-4 [&>ol]:list-decimal [&>ol]:space-y-0.5 sm:[&>ol]:my-3 sm:[&>ol]:ml-5 sm:[&>ol]:space-y-1 md:[&>ol]:my-4 md:[&>ol]:ml-6 md:[&>ol]:space-y-2 lg:[&>ol]:my-6 lg:[&>ol]:ml-8 lg:[&>ol]:space-y-3 [&>p]:mb-2 [&>p]:text-xs [&>p]:leading-relaxed sm:[&>p]:mb-3 sm:[&>p]:text-sm md:[&>p]:mb-4 md:[&>p]:text-base lg:[&>p]:mb-6 lg:[&>p]:text-lg [&>ul]:my-2 [&>ul]:ml-4 [&>ul]:list-disc [&>ul]:space-y-0.5 sm:[&>ul]:my-3 sm:[&>ul]:ml-5 sm:[&>ul]:space-y-1 md:[&>ul]:my-4 md:[&>ul]:ml-6 md:[&>ul]:space-y-2 lg:[&>ul]:my-6 lg:[&>ul]:ml-8 lg:[&>ul]:space-y-3"
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
}

export default React.memo(BlogContent);
