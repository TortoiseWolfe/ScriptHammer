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
    expect(contentDiv).toHaveClass('[&>h1]:page-title'); // Global page title class
    expect(contentDiv).toHaveClass('[&>h2]:section-title'); // Global section title class
    expect(contentDiv).toHaveClass('[&>h3]:subsection-title'); // Global subsection title class
    expect(contentDiv).toHaveClass('[&>h4]:minor-heading'); // Global minor heading class
    expect(contentDiv).toHaveClass('[&>p]:text-xs'); // Mobile size
    expect(contentDiv).toHaveClass('lg:[&>p]:text-lg'); // Desktop size
  });

  it('processes code blocks and adds copy buttons', () => {
    const htmlContent = `
      <pre><code class="language-javascript">console.log('Hello, World!');</code></pre>
    `;

    render(<BlogContent htmlContent={htmlContent} />);

    // Check that copy button is present
    const copyButton = screen.getByTitle('Copy code');
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveTextContent('📋');
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
