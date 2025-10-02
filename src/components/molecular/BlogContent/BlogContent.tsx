'use client';

import React from 'react';
import { getProjectConfig } from '@/config/project.config';

// Import Prism theme for styling the pre-highlighted code
import 'prismjs/themes/prism-tomorrow.css';
import '@/styles/prism-override.css';

interface BlogContentProps {
  htmlContent: string;
}

export default function BlogContent({ htmlContent }: BlogContentProps) {
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
            <div class="absolute top-2 right-12 text-xs text-base-content/60">${lang}</div>
            <button
              onclick="navigator.clipboard.writeText(this.parentElement.querySelector('pre').textContent); this.innerHTML='✓'; setTimeout(() => this.innerHTML='📋', 2000)"
              class="btn btn-xs btn-ghost absolute top-2 right-2"
              title="Copy code"
            >📋</button>
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

  return (
    <div
      ref={contentRef}
      className="[&>.mockup-code]:not-prose [&_code]:bg-base-200 [&_a]:link [&_a]:link-primary [&_a]:hover:link-hover [&_em]:text-base-content/70 [&_details]:border-base-300 [&_details]:bg-base-200 [&_summary]:hover:bg-base-300 [&_details[open]>summary]:border-base-300 [&>h1]:page-title [&>h2]:section-title [&>h3]:subsection-title [&>h4]:minor-heading [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs sm:[&_code]:text-sm md:[&_code]:text-base [&_details]:my-4 [&_details]:rounded-lg [&_details]:border [&_details>*:not(summary)]:p-4 [&_details[open]>summary]:border-b [&_em]:text-xs [&_em]:italic sm:[&_em]:text-sm md:[&_em]:text-base lg:[&_em]:text-lg [&_img]:my-3 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-lg sm:[&_img]:my-4 md:[&_img]:my-6 lg:[&_img]:my-8 [&_li]:text-xs [&_li]:leading-relaxed sm:[&_li]:text-sm md:[&_li]:text-base lg:[&_li]:text-lg [&_summary]:cursor-pointer [&_summary]:p-4 [&_summary]:font-semibold [&_summary]:transition-colors [&>ol]:my-2 [&>ol]:ml-4 [&>ol]:list-decimal [&>ol]:space-y-0.5 sm:[&>ol]:my-3 sm:[&>ol]:ml-5 sm:[&>ol]:space-y-1 md:[&>ol]:my-4 md:[&>ol]:ml-6 md:[&>ol]:space-y-2 lg:[&>ol]:my-6 lg:[&>ol]:ml-8 lg:[&>ol]:space-y-3 [&>p]:mb-2 [&>p]:text-xs [&>p]:leading-relaxed sm:[&>p]:mb-3 sm:[&>p]:text-sm md:[&>p]:mb-4 md:[&>p]:text-base lg:[&>p]:mb-6 lg:[&>p]:text-lg [&>ul]:my-2 [&>ul]:ml-4 [&>ul]:list-disc [&>ul]:space-y-0.5 sm:[&>ul]:my-3 sm:[&>ul]:ml-5 sm:[&>ul]:space-y-1 md:[&>ul]:my-4 md:[&>ul]:ml-6 md:[&>ul]:space-y-2 lg:[&>ul]:my-6 lg:[&>ul]:ml-8 lg:[&>ul]:space-y-3"
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
}
