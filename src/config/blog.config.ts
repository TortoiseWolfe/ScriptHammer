/**
 * Blog System Configuration
 * Central configuration for the blog system including storage limits,
 * sync intervals, and cache settings
 */

export const blogConfig = {
  // Storage Limits
  storage: {
    textLimit: 5 * 1024 * 1024, // 5MB for text content
    imageLimit: 200 * 1024 * 1024, // 200MB for images
    maxPostSize: 1024 * 1024, // 1MB per post
    compressionThreshold: 100 * 1024, // Compress posts larger than 100KB
  },

  // Sync Configuration
  sync: {
    intervalMs: 30000, // Sync every 30 seconds when online
    batchSize: 10, // Process 10 items per sync batch
    maxRetries: 3, // Maximum retry attempts for failed syncs
    retryDelayMs: 5000, // Wait 5 seconds between retries
    conflictStrategy: 'three-way-merge' as const, // Conflict resolution strategy
  },

  // Cache Configuration
  cache: {
    ttlMs: 7 * 24 * 60 * 60 * 1000, // Cache for 7 days
    maxEntries: 100, // Maximum cached entries
    cleanupIntervalMs: 60 * 60 * 1000, // Clean up every hour
  },

  // Content Processing
  processing: {
    tocMinHeadings: 3, // Minimum headings for TOC generation
    tocMaxDepth: 3, // Maximum heading depth for TOC
    excerptLength: 160, // Characters for auto-generated excerpts
    readingWordsPerMinute: 200, // For reading time calculation
    syntaxHighlightTheme: 'prism-tomorrow', // Prism.js theme
    maxCodeBlockSize: 10 * 1024, // 10KB max for syntax highlighting
  },

  // Pagination
  pagination: {
    postsPerPage: 10,
    maxPageButtons: 5, // Maximum pagination buttons to show
  },

  // Feature Flags
  features: {
    enableComments: false, // Comments system not implemented yet
    enableSearch: true, // Enable search functionality
    enableRss: true, // Enable RSS feed generation
    enableSocialSharing: true, // Enable social share buttons
    enableOfflineEditing: true, // Enable offline editing capabilities
    enableConflictResolution: true, // Enable conflict resolution UI
  },

  // SEO Configuration
  seo: {
    titleTemplate: '%s | Blog',
    defaultDescription: 'A modern blog with offline-first capabilities',
    defaultImage: '/opengraph-image.png',
    twitterHandle: '@yourtwitterhandle',
  },

  // Author Registry
  authors: {
    registryPath: '/src/data/authors.json',
    defaultAvatar: '/avatars/default.png',
    maxBioLength: 500,
    maxSocialLinks: 10,
  },

  // Validation
  validation: {
    slugPattern: /^[a-z0-9-]+$/,
    tagPattern: /^[a-z0-9-]+$/,
    maxTitleLength: 200,
    maxTags: 10,
    maxCategories: 5,
    requiredFrontmatterFields: ['title', 'date', 'author'],
  },
};

export type BlogConfig = typeof blogConfig;
