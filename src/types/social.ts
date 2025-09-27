export type SharePlatform =
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'reddit'
  | 'email'
  | 'whatsapp'
  | 'telegram'
  | 'slack'
  | 'copy-link';

export interface ShareEvent {
  id: string;
  postId: string;
  platform: SharePlatform;
  sharedAt: string;
  sharedBy?: string;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
  success: boolean;
  errorMessage?: string;
}

export interface SocialPlatformConfig {
  name: string;
  platform: SharePlatform;
  shareUrl: string;
  icon?: string;
  color?: string;
  enabled: boolean;
  displayOrder: number;
  requiresAuth?: boolean;
  maxCharacters?: number;
}

export interface ShareOptions {
  title: string;
  text?: string;
  url: string;
  hashtags?: string[];
  via?: string;
  related?: string[];
  image?: string;
}

export interface ShareStats {
  postId: string;
  totalShares: number;
  platformBreakdown: Record<SharePlatform, number>;
  recentShares: ShareEvent[];
  topPlatforms: {
    platform: SharePlatform;
    count: number;
    percentage: number;
  }[];
  dailyShares: {
    date: string;
    count: number;
  }[];
}

export interface SocialMetaTags {
  // Open Graph
  'og:title': string;
  'og:description'?: string;
  'og:image'?: string;
  'og:url': string;
  'og:type': string;
  'og:site_name'?: string;
  'og:locale'?: string;
  'article:author'?: string;
  'article:published_time'?: string;
  'article:modified_time'?: string;
  'article:tag'?: string[];

  // Twitter Card
  'twitter:card': 'summary' | 'summary_large_image' | 'app' | 'player';
  'twitter:site'?: string;
  'twitter:creator'?: string;
  'twitter:title': string;
  'twitter:description'?: string;
  'twitter:image'?: string;
  'twitter:image:alt'?: string;

  // LinkedIn
  'linkedin:owner'?: string;

  // Schema.org
  '@context'?: string;
  '@type'?: string;
  headline?: string;
  author?: {
    '@type': string;
    name: string;
    url?: string;
  };
  datePublished?: string;
  dateModified?: string;
  image?: string | string[];
  publisher?: {
    '@type': string;
    name: string;
    logo?: {
      '@type': string;
      url: string;
    };
  };
}

export interface ShareButtonProps {
  platform: SharePlatform;
  shareOptions: ShareOptions;
  onShare?: (event: ShareEvent) => void;
  className?: string;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'solid' | 'outline' | 'ghost';
}

export interface ShareAnalytics {
  trackShare(event: ShareEvent): Promise<void>;
  getShareStats(postId: string): Promise<ShareStats>;
  getTopSharedPosts(limit?: number): Promise<
    {
      postId: string;
      title: string;
      shares: number;
    }[]
  >;
  getShareTrends(days?: number): Promise<
    {
      date: string;
      shares: number;
      platforms: Record<SharePlatform, number>;
    }[]
  >;
}
