import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  it('renders code content correctly', () => {
    const code = 'console.log("Hello, World!");';
    const { container } = render(<CodeBlock>{code}</CodeBlock>);

    // Code is now rendered as highlighted HTML, not plain text
    const codeElement = container.querySelector('code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement?.textContent).toContain('console');
    expect(codeElement?.textContent).toContain('log');
    expect(codeElement?.textContent).toContain('Hello, World!');
  });

  it('renders with custom className', () => {
    const { container } = render(
      <CodeBlock className="custom-class">test code</CodeBlock>
    );

    const pre = container.querySelector('pre');
    expect(pre).toHaveClass('custom-class');
    expect(pre).toHaveClass('overflow-x-auto');
  });

  it('shows copy button on hover', async () => {
    render(<CodeBlock>test code</CodeBlock>);

    const copyButton = screen.getByRole('button', {
      name: /copy code to clipboard/i,
    });
    expect(copyButton).toHaveClass('opacity-0');
  });

  it('copies code to clipboard when copy button is clicked', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    const code = 'const x = 42;';
    render(<CodeBlock>{code}</CodeBlock>);

    const copyButton = screen.getByRole('button', {
      name: /copy code to clipboard/i,
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(code);
    });
  });

  it('shows success message after copying', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<CodeBlock>test code</CodeBlock>);

    const copyButton = screen.getByRole('button', {
      name: /copy code to clipboard/i,
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('handles complex nested React elements', () => {
    const code = (
      <code>
        <span>function</span> <span>test</span>() {'{'} <span>return</span> 42;{' '}
        {'}'}
      </code>
    );

    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<CodeBlock>{code}</CodeBlock>);

    const copyButton = screen.getByRole('button', {
      name: /copy code to clipboard/i,
    });
    fireEvent.click(copyButton);

    waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(
        'function test() { return 42; }'
      );
    });
  });

  it('falls back to execCommand if clipboard API is not available', () => {
    const mockExecCommand = vi.fn().mockReturnValue(true);
    document.execCommand = mockExecCommand;

    // Remove clipboard API
    const originalClipboard = navigator.clipboard;
    Object.assign(navigator, { clipboard: undefined });

    render(<CodeBlock>fallback test</CodeBlock>);

    const copyButton = screen.getByRole('button', {
      name: /copy code to clipboard/i,
    });
    fireEvent.click(copyButton);

    waitFor(() => {
      expect(mockExecCommand).toHaveBeenCalledWith('copy');
    });

    // Restore clipboard API
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it('sets data-language attribute when language prop is provided', () => {
    const { container } = render(
      <CodeBlock language="javascript">const x = 1;</CodeBlock>
    );

    const code = container.querySelector('code');
    expect(code).toHaveAttribute('data-language', 'javascript');
  });
});
