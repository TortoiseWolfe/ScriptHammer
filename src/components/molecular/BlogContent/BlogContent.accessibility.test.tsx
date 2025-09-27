import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import BlogContent from './BlogContent';

expect.extend(toHaveNoViolations);

// Mock Prism.js
vi.mock('prismjs', () => ({
  default: {
    highlightElement: vi.fn(),
  },
}));

// Mock Prism.js language imports
vi.mock('prismjs/components/prism-typescript', () => ({}));
vi.mock('prismjs/components/prism-javascript', () => ({}));
vi.mock('prismjs/components/prism-jsx', () => ({}));
vi.mock('prismjs/components/prism-tsx', () => ({}));
vi.mock('prismjs/components/prism-bash', () => ({}));
vi.mock('prismjs/components/prism-css', () => ({}));
vi.mock('prismjs/components/prism-json', () => ({}));
vi.mock('prismjs/components/prism-docker', () => ({}));
vi.mock('prismjs/components/prism-yaml', () => ({}));

describe('BlogContent Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not have basic accessibility violations with simple content', async () => {
    const htmlContent = `
      <h1>Main Title</h1>
      <p>This is a paragraph with some content.</p>
      <h2>Subtitle</h2>
      <p>Another paragraph with <a href="#example">a link</a>.</p>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should not have accessibility violations with code blocks', async () => {
    const htmlContent = `
      <h1>Code Example</h1>
      <p>Here's some JavaScript code:</p>
      <pre><code class="language-javascript">console.log('Hello, World!');</code></pre>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper semantic structure with headings', () => {
    const htmlContent = `
      <h1>Main Title</h1>
      <h2>Section Title</h2>
      <h3>Subsection Title</h3>
      <p>Content under subsection.</p>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    // Check heading hierarchy
    const h1 = screen.getByRole('heading', { level: 1 });
    const h2 = screen.getByRole('heading', { level: 2 });
    const h3 = screen.getByRole('heading', { level: 3 });

    expect(h1).toHaveTextContent('Main Title');
    expect(h2).toHaveTextContent('Section Title');
    expect(h3).toHaveTextContent('Subsection Title');
  });

  it('should have accessible links with proper attributes', () => {
    const htmlContent = `
      <p>Visit our <a href="https://example.com">homepage</a> for more information.</p>
      <p>Check out the <a href="#section1">section below</a>.</p>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    const externalLink = screen.getByText('homepage');
    const internalLink = screen.getByText('section below');

    expect(externalLink).toBeInTheDocument();
    expect(externalLink.getAttribute('href')).toBe('https://example.com');

    expect(internalLink).toBeInTheDocument();
    expect(internalLink.getAttribute('href')).toBe('#section1');
  });

  it('should have accessible list structures', () => {
    const htmlContent = `
      <h2>Features</h2>
      <ul>
        <li>Feature one</li>
        <li>Feature two</li>
        <li>Feature three</li>
      </ul>
      <h2>Steps</h2>
      <ol>
        <li>First step</li>
        <li>Second step</li>
        <li>Third step</li>
      </ol>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    const lists = screen.getAllByRole('list');
    const unorderedList = lists[0]; // First list is unordered
    const orderedList = lists[1]; // Second list is ordered

    expect(unorderedList).toBeInTheDocument();
    expect(orderedList).toBeInTheDocument();

    // Check list items
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(6); // 3 + 3 items
  });

  it('should have accessible copy buttons in code blocks', () => {
    const htmlContent = `
      <pre><code class="language-javascript">const x = 42;</code></pre>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    const copyButton = screen.getByTitle('Copy code');
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveAttribute('title', 'Copy code');

    // Button should be keyboard accessible
    expect(copyButton.tagName).toBe('BUTTON');
  });

  it('should handle inline code elements accessibly', () => {
    const htmlContent = `
      <p>Use the <code>useState</code> hook to manage state in React components.</p>
      <p>The <code>console.log()</code> function is useful for debugging.</p>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);

    const codeElements = container.querySelectorAll('code');
    expect(codeElements).toHaveLength(2);

    // Inline code should be properly contained within text
    expect(
      screen.getByText(/Use the.*hook to manage state/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The.*function is useful for debugging/)
    ).toBeInTheDocument();
  });

  it('should maintain proper contrast ratios with styling classes', () => {
    const htmlContent = `
      <h1>Title</h1>
      <p>Content with <a href="#test">a link</a>.</p>
      <code>inline code</code>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);

    // Check that styling classes are applied (these should provide good contrast)
    const contentDiv = container.firstChild as HTMLElement;
    expect(contentDiv).toHaveClass('[&_a]:link');
    expect(contentDiv).toHaveClass('[&_a]:link-primary');
    expect(contentDiv).toHaveClass('[&_code]:bg-base-200');
  });

  it('should handle empty content without accessibility issues', async () => {
    const { container } = render(<BlogContent htmlContent="" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard navigable', () => {
    const htmlContent = `
      <h1>Interactive Content</h1>
      <p>Click this <a href="#test">link</a> or use the code below:</p>
      <pre><code class="language-javascript">console.log('test');</code></pre>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    const link = screen.getByText('link');
    const copyButton = screen.getByTitle('Copy code');

    // Both interactive elements should be focusable
    expect(link.tabIndex).not.toBe(-1);
    expect(copyButton.tabIndex).not.toBe(-1);
  });

  it('should provide proper ARIA structure for complex content', async () => {
    const htmlContent = `
      <article>
        <h1>Article Title</h1>
        <section>
          <h2>Section 1</h2>
          <p>Section content.</p>
        </section>
        <section>
          <h2>Section 2</h2>
          <p>More content.</p>
        </section>
      </article>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);

    // Should preserve semantic HTML structure
    const article = container.querySelector('article');
    const sections = container.querySelectorAll('section');

    expect(article).toBeInTheDocument();
    expect(sections).toHaveLength(2);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle special characters and entities properly', () => {
    const htmlContent = `
      <p>Special characters: &amp; &lt; &gt; &quot; &#39;</p>
      <p>Unicode: © ® ™ → ← ↑ ↓</p>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    // Content should be rendered properly and remain accessible
    expect(screen.getByText(/Special characters:/)).toBeInTheDocument();
    expect(screen.getByText(/Unicode:/)).toBeInTheDocument();
  });

  it('should support high contrast mode styling', () => {
    const htmlContent = `
      <h1>High Contrast Test</h1>
      <p>This content should work well in high contrast mode.</p>
      <pre><code class="language-css">.high-contrast { color: white; background: black; }</code></pre>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);

    // Component should support additional styling for high contrast
    const contentDiv = container.firstChild as HTMLElement;
    expect(contentDiv).toHaveClass('[&_code]:bg-base-200');
    expect(contentDiv).toHaveClass('[&_a]:link');
  });
});
