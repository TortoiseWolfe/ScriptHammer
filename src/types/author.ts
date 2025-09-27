export type SocialPlatform =
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'github'
  | 'youtube'
  | 'reddit'
  | 'mastodon'
  | 'bluesky'
  | 'threads'
  | 'twitch'
  | 'website';

export interface Author {
  id: string;
  username: string;
  name: string;
  email: string;
  bio?: string;
  avatar?: string;
  website?: string;
  location?: string;
  company?: string;
  socialLinks: SocialLink[];
  joinedAt: string;
  lastActiveAt?: string;
  postsCount: number;
  permissions: AuthorPermission[];
  preferences: AuthorPreferences;
  hideSocial?: boolean;
}

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
  username?: string;
  displayOrder: number;
  isVerified?: boolean;
}

export interface AuthorPermission {
  resource: 'post' | 'author' | 'settings' | 'admin';
  actions: ('read' | 'write' | 'delete' | 'publish')[];
}

export interface AuthorPreferences {
  emailNotifications?: boolean;
  publicProfile?: boolean;
  showEmail?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
}

export interface AuthorReference {
  id: string;
  name: string;
  avatar?: string;
}

export interface AuthorStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalViews?: number;
  totalShares?: number;
  avgReadingTime?: number;
  popularTags: string[];
  recentPosts: {
    id: string;
    title: string;
    publishedAt: string;
  }[];
}

export interface AuthorListResponse {
  authors: Author[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthorCreateRequest {
  username: string;
  name: string;
  email: string;
  bio?: string;
  avatar?: string;
  website?: string;
  location?: string;
  socialLinks?: Omit<SocialLink, 'isVerified'>[];
}

export interface AuthorUpdateRequest {
  name?: string;
  email?: string;
  bio?: string;
  avatar?: string;
  website?: string;
  location?: string;
  company?: string;
  socialLinks?: Omit<SocialLink, 'isVerified'>[];
  preferences?: Partial<AuthorPreferences>;
  hideSocial?: boolean;
}
