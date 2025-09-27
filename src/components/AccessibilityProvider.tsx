'use client';

import { useEffect } from 'react';

export default function AccessibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Apply saved accessibility settings on app load
    const savedFontSize = localStorage.getItem('fontSize') || 'medium';
    const savedLineHeight = localStorage.getItem('lineHeight') || 'normal';
    const savedFontFamily = localStorage.getItem('fontFamily') || 'sans-serif';

    const root = document.documentElement;

    // Font scale factors
    const scaleFactors: Record<string, number> = {
      small: 1.25, // 20px - minimum comfortable size
      medium: 1.5, // 24px - good default
      large: 1.75, // 28px - easy to read
      'x-large': 2.125, // 34px - very accessible
    };

    // Line heights
    const lineHeights: Record<string, string> = {
      compact: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    };

    // Font families
    const fontFamilies: Record<string, string> = {
      'sans-serif':
        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
    };

    // Apply settings
    root.style.setProperty(
      '--font-scale-factor',
      scaleFactors[savedFontSize]?.toString() || '1.5'
    );
    root.style.setProperty(
      '--base-line-height',
      lineHeights[savedLineHeight] || '1.5'
    );
    root.style.setProperty(
      '--base-font-family',
      fontFamilies[savedFontFamily] || fontFamilies['sans-serif']
    );

    document.body.style.lineHeight = lineHeights[savedLineHeight] || '1.5';
    document.body.style.fontFamily =
      fontFamilies[savedFontFamily] || fontFamilies['sans-serif'];
  }, []);

  return <>{children}</>;
}
