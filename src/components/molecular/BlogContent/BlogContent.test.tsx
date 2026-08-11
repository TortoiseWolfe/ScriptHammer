import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BlogContent from './BlogContent';

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

describe('BlogContent', () => {
  let originalScrollBehavior: string;
  let originalScrollPaddingTop: string;

  beforeEach(() => {
    // Store original values
    originalScrollBehavior = document.documentElement.style.scrollBehavior;
    originalScrollPaddingTop = document.documentElement.style.scrollPaddingTop;

    // Reset mocks
    vi.clearAllMocks();

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    // Restore original values
    document.documentElement.style.scrollBehavior = originalScrollBehavior;
    document.documentElement.style.scrollPaddingTop = originalScrollPaddingTop;
  });

  it('renders HTML content correctly', () => {
    const htmlContent = '<p>This is a test paragraph.</p>';
    render(<BlogContent htmlContent={htmlContent} />);

    expect(screen.getByText('This is a test paragraph.')).toBeInTheDocument();
  });

  it('renders basic HTML elements with proper styling classes', () => {
    const htmlContent = `
      <h1>Main Title</h1>
      <h2>Subtitle</h2>
      <p>A paragraph of text.</p>
      <ul><li>List item</li></ul>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);

    // Check that the content container has the expected responsive styling classes
    const contentDiv = container.firstChild as HTMLElement;
    // The four `[&>hN]:*-title` assertions that were here are GONE (#373 §C4).
    // They asserted class STRINGS for rules that generated no CSS whatsoever —
    // a plain class cannot be a Tailwind arbitrary variant — so they passed
    // while the styling their comments described had never applied. That is
    // exactly why the inertness survived unnoticed. Assert rendered results,
    // not the presence of a class.
    expect(contentDiv).toHaveClass('[&>p]:text-xs'); // Mobile size
    expect(contentDiv).toHaveClass('lg:[&>p]:text-lg'); // Desktop size
  });

  it('presents wide tables safely without changing table or quote semantics', () => {
    const htmlContent = `
      <div class="blog-table-scroll" data-blog-table-scroll="true" tabindex="0">
        <table class="blog-data-table">
          <caption>Release comparison</caption>
          <thead>
            <tr><th scope="col">Release</th><th scope="col">Support window</th></tr>
          </thead>
          <tbody>
            <tr><td>Stable</td><td>Long term support</td></tr>
          </tbody>
        </table>
      </div>
      <blockquote><p>Prefer the stable release.</p></blockquote>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);
    const contentDiv = container.firstChild as HTMLElement;
    const tableScroll = container.querySelector(
      '[data-blog-table-scroll="true"]'
    ) as HTMLElement;

    expect(contentDiv).toHaveClass(
      '[&_.blog-table-scroll]:max-w-full',
      '[&_.blog-table-scroll]:overflow-x-auto',
      '[&_.blog-table-scroll]:overscroll-x-contain',
      '[&_.blog-table-scroll]:focus-visible:ring-2',
      '[&_.blog-data-table]:m-0',
      '[&_.blog-data-table]:table',
      '[&_.blog-data-table]:min-w-full',
      '[&_.blog-data-table]:overflow-visible',
      '[&_.blog-data-table_th]:whitespace-nowrap',
      '[&_.blog-data-table_th]:bg-base-200',
      '[&_.blog-data-table_td]:break-words',
      '[&_blockquote]:border-l-4',
      '[&_blockquote]:bg-base-200',
      '[&_blockquote>p]:m-0'
    );

    expect(tableScroll).toHaveAttribute('tabindex', '0');
    Object.defineProperties(tableScroll, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 800 },
    });
    tableScroll.focus();
    expect(tableScroll).toHaveFocus();
    fireEvent.keyDown(tableScroll, { key: 'ArrowRight' });
    expect(tableScroll.scrollLeft).toBeGreaterThan(0);
    fireEvent.keyDown(tableScroll, { key: 'End' });
    expect(tableScroll.scrollLeft).toBe(500);
    fireEvent.keyDown(tableScroll, { key: 'Home' });
    expect(tableScroll.scrollLeft).toBe(0);
    expect(
      screen.getByRole('table', { name: 'Release comparison' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByRole('cell')).toHaveLength(2);
    expect(container.querySelector('blockquote')).toHaveTextContent(
      'Prefer the stable release.'
    );
  });

  it('preserves authored details state across unchanged parent renders', () => {
    const htmlContent = `
      <details>
        <summary>More information</summary>
        <p>Authored detail body</p>
      </details>
    `;
    const { container, rerender } = render(
      <BlogContent htmlContent={htmlContent} />
    );
    const details = container.querySelector('details') as HTMLDetailsElement;

    details.open = true;
    rerender(<BlogContent htmlContent={htmlContent} />);

    expect(container.querySelector('details')).toBe(details);
    expect(details.open).toBe(true);
  });

  it('processes code blocks and adds copy buttons', () => {
    const htmlContent = `
      <pre><code class="language-javascript">console.log('Hello, World!');</code></pre>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    // Check that copy button is present
    const copyButton = screen.getByTitle('Copy code');
    expect(copyButton).toBeInTheDocument();
    // Was toHaveTextContent('📋'). The button now renders the icon set
    // (#385), so its label is real sr-only text rather than an emoji glyph —
    // a stronger assertion, since the button previously had no accessible
    // name beyond `title`.
    expect(copyButton).toHaveTextContent('Copy code');
  });

  it('processes code blocks with language labels', () => {
    const htmlContent = `
      <pre><code class="language-typescript">const message: string = "Hello";</code></pre>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);

    // Check that language label is shown
    expect(container.textContent).toContain('typescript');
  });

  it('handles multiple code blocks', () => {
    const htmlContent = `
      <pre><code class="language-javascript">console.log('JS');</code></pre>
      <pre><code class="language-python">print('Python')</code></pre>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    // Check that both copy buttons are present
    const copyButtons = screen.getAllByTitle('Copy code');
    expect(copyButtons).toHaveLength(2);
  });

  it('sets scroll padding on mount', () => {
    render(<BlogContent htmlContent="<p>Test content</p>" />);

    expect(document.documentElement.style.scrollPaddingTop).toBe('90px');
  });

  it('resets scroll padding on unmount', () => {
    const { unmount } = render(
      <BlogContent htmlContent="<p>Test content</p>" />
    );

    unmount();

    expect(document.documentElement.style.scrollPaddingTop).toBe('0');
  });

  it('handles empty HTML content', () => {
    const { container } = render(<BlogContent htmlContent="" />);

    const contentDiv = container.firstChild as HTMLElement;
    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv.innerHTML).toBe('');
  });

  it('handles HTML content without code blocks', () => {
    const htmlContent = `
      <h1>Title</h1>
      <p>Just regular content without any code.</p>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(
      screen.getByText('Just regular content without any code.')
    ).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();

    // No copy buttons should be present
    expect(screen.queryByTitle('Copy code')).not.toBeInTheDocument();
  });

  it('preserves HTML structure and attributes', () => {
    const htmlContent = `
      <div class="custom-class" id="test-id">
        <p><a href="https://example.com">Link text</a></p>
      </div>
    `;

    const { container } = render(<BlogContent htmlContent={htmlContent} />);

    const link = screen.getByText('Link text') as HTMLAnchorElement;
    expect(link).toBeInTheDocument();
    expect(link.href).toBe('https://example.com/');

    const customDiv = container.querySelector('#test-id');
    expect(customDiv).toHaveClass('custom-class');
  });

  it('handles malformed HTML gracefully', () => {
    const htmlContent = '<p>Unclosed paragraph<div>Mixed nesting</p></div>';

    // Should not throw an error
    expect(() => {
      render(<BlogContent htmlContent={htmlContent} />);
    }).not.toThrow();
  });

  it('processes complex code blocks with special characters', () => {
    const htmlContent = `
      <pre><code class="language-bash">#!/bin/bash
echo "Hello & welcome"
if [ $? -eq 0 ]; then
  echo "Success!"
fi</code></pre>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    // Check that special characters are preserved
    expect(screen.getByText(/#!/)).toBeInTheDocument();
    expect(screen.getByText(/Hello & welcome/)).toBeInTheDocument();
    expect(screen.getByTitle('Copy code')).toBeInTheDocument();
  });
});
