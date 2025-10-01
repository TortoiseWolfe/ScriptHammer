export type PostStatus = 'draft' | 'published' | 'archived';
export type SyncStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'error';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  publishedAt?: string;
  scheduledAt?: string;
  status: PostStatus;
  version: number;
  syncStatus: SyncStatus;
  localChecksum?: string;
  serverChecksum?: string;
  createdAt: string;
  updatedAt: string;
  author: AuthorReference;
  metadata: PostMetadata;
  seo?: SEOMetadata;
  offline: OfflineMetadata;
}

export interface AuthorReference {
  id: string;
  name: string;
  avatar?: string;
}

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
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: string;
  linkedinAuthorUrl?: string;
}

export interface SEOMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  twitterImage?: string;
  twitterLabel1?: string;
  twitterData1?: string;
  twitterLabel2?: string;
  twitterData2?: string;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  linkedinAuthorUrl?: string;
  fbAppId?: string;
}

export interface OfflineMetadata {
  isOfflineDraft: boolean;
  lastSyncedAt?: string;
  conflictResolution?: 'local' | 'remote' | 'merged';
  queuedChanges?: QueuedChange[];
}

export interface QueuedChange {
  type: 'create' | 'update' | 'delete';
  timestamp: string;
  payload: any;
}

export interface BlogPostListResponse {
  posts: BlogPost[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface BlogPostCreateRequest {
  title: string;
  content: string;
  slug?: string;
  excerpt?: string;
  status?: PostStatus;
  metadata?: Partial<PostMetadata>;
  seo?: Partial<SEOMetadata>;
  scheduledAt?: string;
}

export interface BlogPostUpdateRequest {
  title?: string;
  content?: string;
  slug?: string;
  excerpt?: string;
  status?: PostStatus;
  metadata?: Partial<PostMetadata>;
  seo?: Partial<SEOMetadata>;
  version: number;
  scheduledAt?: string;
}

export interface BlogPostFilters {
  status?: PostStatus;
  author?: string;
  tags?: string[];
  categories?: string[];
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'publishedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}
