import React from 'react';

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'body'
  | 'lead'
  | 'small'
  | 'code'
  | 'emphasis'
  | 'caption';

export interface TextProps {
  variant?: TextVariant;
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

const variantStyles: Record<TextVariant, string> = {
  h1: 'text-5xl font-bold text-base-content',
  h2: 'text-4xl font-bold text-base-content',
  h3: 'text-3xl font-semibold text-base-content',
  h4: 'text-2xl font-semibold text-base-content',
  h5: 'text-xl font-medium text-base-content',
  h6: 'text-lg font-medium text-base-content',
  body: 'text-base text-base-content',
  lead: 'text-xl text-base-content/70',
  small: 'text-sm text-base-content/70',
  code: 'font-mono text-sm bg-base-200 px-1 py-0.5 rounded',
  emphasis: 'text-base italic text-base-content',
  caption: 'text-xs text-base-content/60',
};

const variantElements: Partial<Record<TextVariant, React.ElementType>> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  code: 'code',
  emphasis: 'em',
};

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  children,
  className = '',
  as,
}) => {
  const Component = as || variantElements[variant] || 'p';
  const combinedClassName = `${variantStyles[variant]} ${className}`.trim();

  return <Component className={combinedClassName}>{children}</Component>;
};

export default Text;
