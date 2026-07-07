'use client';

import React, { useMemo } from 'react';
import { highlightCode } from './highlighter';
import { detectLanguage } from '@/utils/codeblock-utils';
import { useCodeBlockPreferences } from '@/hooks/useCodeBlockPreferences';
import { CopyButton } from '@/components/atomic/CopyButton';

export interface CodeBlockProps {
  children: React.ReactNode;
  className?: string;
  language?: string;
  showLineNumbers?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  children,
  className = '',
  language,
  showLineNumbers = true,
}) => {
  const { preferences } = useCodeBlockPreferences();

  const extractText = (node: React.ReactNode): string => {
    if (typeof node === 'string') {
      return node;
    }
    if (typeof node === 'number') {
      return String(node);
    }
    if (React.isValidElement(node)) {
      const props = node.props as { children?: React.ReactNode };
      if (props.children) {
        return extractText(props.children);
      }
    }
    if (Array.isArray(node)) {
      return node.map(extractText).join('');
    }
    return '';
  };

  // Extract language from className if not provided directly
  const extractLanguage = (cls: string): string | undefined => {
    const match = cls.match(/language-(\w+)/);
    return match ? match[1] : undefined;
  };

  const codeText = extractText(children);
  const detectedLanguage =
    language || extractLanguage(className) || detectLanguage(codeText);

  // Use memoized syntax highlighting
  const highlightedCode = useMemo(() => {
    const displayLineNumbers =
      showLineNumbers !== undefined
        ? showLineNumbers
        : preferences.showLineNumbers;
    return highlightCode(codeText, detectedLanguage, displayLineNumbers);
  }, [
    codeText,
    detectedLanguage,
    showLineNumbers,
    preferences.showLineNumbers,
  ]);

  return (
    <div className="group relative">
      <CopyButton
        content={codeText}
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
      />
      <pre
        className={`language-${detectedLanguage || 'plaintext'} ${className} overflow-x-auto`}
      >
        <code
          className={`language-${detectedLanguage || 'plaintext'}`}
          data-language={detectedLanguage || 'plaintext'}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
};

CodeBlock.displayName = 'CodeBlock';

export default CodeBlock;
