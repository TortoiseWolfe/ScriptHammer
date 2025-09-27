export interface PostMetadata {
  tags: string[];
  categories: string[];
  readingTime?: number;
  wordCount?: number;
  showToc?: boolean;
  showAuthor?: boolean;
  showShareButtons?: boolean;
  customCss?: string;
  featured?: boolean;
  featuredImage?: string;
  featuredImageAlt?: string;
}

export interface TOCItem {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: TOCItem[];
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
  highlight?: number[];
  showLineNumbers?: boolean;
  startLineNumber?: number;
}

export interface ImageMetadata {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  srcset?: string;
}

export interface LinkMetadata {
  href: string;
  text: string;
  isExternal: boolean;
  isDownload?: boolean;
  target?: '_blank' | '_self' | '_parent' | '_top';
  rel?: string;
}

export interface ProcessedContent {
  html: string;
  toc: TOCItem[];
  metadata: ContentMetadata;
  images: ImageMetadata[];
  links: LinkMetadata[];
  codeBlocks: CodeBlock[];
}

export interface ContentMetadata {
  title?: string;
  description?: string;
  excerpt?: string;
  readingTime: number;
  wordCount: number;
  hasCode: boolean;
  hasImages: boolean;
  hasLinks: boolean;
  hasMath?: boolean;
  hasDiagrams?: boolean;
}

export interface FrontMatter {
  title: string;
  date?: string;
  author?: string;
  tags?: string[];
  categories?: string[];
  excerpt?: string;
  featured?: boolean;
  draft?: boolean;
  slug?: string;
  [key: string]: any;
}

export interface MarkdownProcessorOptions {
  enableToc?: boolean;
  enableSyntaxHighlight?: boolean;
  enableMath?: boolean;
  enableDiagrams?: boolean;
  tocMaxDepth?: number;
  excerptLength?: number;
  imageOptimization?: boolean;
  lazyLoadImages?: boolean;
  externalLinksTarget?: '_blank' | '_self';
  sanitize?: boolean;
}
