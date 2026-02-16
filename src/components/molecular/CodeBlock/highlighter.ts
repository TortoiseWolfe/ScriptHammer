import Prism from 'prismjs';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:atomic:CodeBlock:highlighter');

// Import core language components
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
// import 'prismjs/components/prism-jsx';  // Not available
// import 'prismjs/components/prism-tsx';  // Not available
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-git';

/**
 * Highlight code using Prism.js
 * This function is designed to work both server-side and client-side
 */
export function highlightCode(
  code: string,
  language: string,
  showLineNumbers: boolean = false
): string {
  // Don't highlight plaintext
  if (language === 'plaintext') {
    return addLineNumbers(escapeHtml(code), showLineNumbers);
  }

  try {
    // Check if language is supported
    const grammar = Prism.languages[language];
    if (!grammar) {
      logger.warn('Language not supported by Prism', { language });
      return addLineNumbers(escapeHtml(code), showLineNumbers);
    }

    // Highlight the code
    const highlighted = Prism.highlight(code, grammar, language);
    return addLineNumbers(highlighted, showLineNumbers);
  } catch (error) {
    logger.warn('Failed to highlight code', { error });
    return addLineNumbers(escapeHtml(code), showLineNumbers);
  }
}

/**
 * Add line numbers to highlighted code
 */
function addLineNumbers(html: string, showLineNumbers: boolean): string {
  if (!showLineNumbers) {
    return html;
  }

  const lines = html.split('\n');
  return lines
    .map((line, index) => {
      const lineNumber = index + 1;
      return `<span class="code-line"><span class="line-number">${lineNumber}</span>${line}</span>`;
    })
    .join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}
