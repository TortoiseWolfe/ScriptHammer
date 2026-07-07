/**
 * Author Configuration
 * Defines author profiles for the blog system
 */

import { createLogger } from '@/lib/logger';

const logger = createLogger('config:authors');

export interface AuthorSocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
  email?: string;
  mastodon?: string;
  bluesky?: string;
  twitch?: string;
}

export interface AuthorPreferences {
  showSocialLinks: boolean;
  showEmail: boolean;
  showBio: boolean;
}

export interface Author {
  id: string;
  name: string;
  role: string;
  bio: string;
  avatar?: string;
  social: AuthorSocialLinks;
  preferences: AuthorPreferences;
}

// Validation functions
export const validateAuthorId = (id: string): boolean => {
  return /^[a-z0-9-]+$/.test(id);
};

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateAuthor = (author: Author): string[] => {
  const errors: string[] = [];

  if (!validateAuthorId(author.id)) {
    errors.push('Author ID must be alphanumeric with hyphens only');
  }

  if (author.name.length < 2 || author.name.length > 100) {
    errors.push('Author name must be 2-100 characters');
  }

  if (author.role.length < 2 || author.role.length > 100) {
    errors.push('Author role must be 2-100 characters');
  }

  if (author.bio.length > 500) {
    errors.push('Author bio must be max 500 characters');
  }

  if (author.social.email && !validateEmail(author.social.email)) {
    errors.push('Invalid email format');
  }

  // Validate all social URLs
  const socialUrls = [
    author.social.github,
    author.social.twitter,
    author.social.linkedin,
    author.social.website,
    author.social.mastodon,
    author.social.bluesky,
  ];

  socialUrls.forEach((url) => {
    if (url && !validateUrl(url)) {
      errors.push(`Invalid URL: ${url}`);
    }
  });

  return errors;
};

// Import the generated author config (created at build time from .env)
let authorConfigData: any = {
  name: 'Your Name',
  role: 'Developer',
  bio: 'Building modern web applications.',
  avatar: '/images/authors/default.jpg',
  social: {},
  disqus: {},
};

try {
  // Try to import the generated config
  const generatedConfig = require('./author-generated');
  authorConfigData = generatedConfig.authorConfig;
} catch {
  // Fallback if generated config doesn't exist (will be created on next build)
  logger.warn(
    'Author config not generated yet. Run build to generate from .env'
  );
}

// Helper function to get social links from generated config
const getAuthorSocialFromConfig = (): AuthorSocialLinks => {
  const social: AuthorSocialLinks = {};

  if (authorConfigData.social.github) {
    social.github = authorConfigData.social.github;
  }
  if (authorConfigData.social.twitter) {
    social.twitter = authorConfigData.social.twitter;
  }
  if (authorConfigData.social.linkedin) {
    social.linkedin = authorConfigData.social.linkedin;
  }
  if (authorConfigData.social.website) {
    social.website = authorConfigData.social.website;
  }
  if (authorConfigData.social.email) {
    social.email = authorConfigData.social.email;
  }
  if (authorConfigData.social.twitch) {
    social.twitch = authorConfigData.social.twitch;
  }

  return social;
};

// Default author entries with environment variable support
export const authors: Record<string, Author> = {
  default: {
    id: 'default',
    name: authorConfigData.name,
    role: authorConfigData.role,
    bio: authorConfigData.bio,
    avatar: authorConfigData.avatar,
    social: getAuthorSocialFromConfig(),
    preferences: {
      showSocialLinks: true,
      showEmail: false,
      showBio: true,
    },
  },
  TurtleWolfe: {
    id: 'turtlewolfe',
    name: authorConfigData.name,
    role: authorConfigData.role,
    bio: authorConfigData.bio,
    avatar: authorConfigData.avatar,
    social: getAuthorSocialFromConfig(),
    preferences: {
      showSocialLinks: true,
      showEmail: false,
      showBio: true,
    },
  },
  // Legacy alias for backwards compatibility
  TortoiseWolfe: {
    id: 'tortoisewolfe',
    name: authorConfigData.name,
    role: authorConfigData.role,
    bio: authorConfigData.bio,
    avatar: authorConfigData.avatar,
    social: getAuthorSocialFromConfig(),
    preferences: {
      showSocialLinks: true,
      showEmail: false,
      showBio: true,
    },
  },
  'guest-author': {
    id: 'guest-author',
    name: 'Guest Author',
    role: 'Contributing Writer',
    bio: 'Guest contributors share their expertise and insights on web development topics.',
    social: {},
    preferences: {
      showSocialLinks: true,
      showEmail: false,
      showBio: true,
    },
  },
};

// Helper functions
export const getAuthorById = (id: string): Author | undefined => {
  return authors[id];
};

export const getAuthorByName = (name: string): Author | undefined => {
  // First try to find by key (for backwards compatibility)
  if (authors[name]) {
    return authors[name];
  }

  // Then try to find by name field
  const foundAuthor = Object.values(authors).find(
    (author) => author.name.toLowerCase() === name.toLowerCase()
  );

  // If not found, return the default author as fallback
  return foundAuthor || authors.default;
};

export const getAllAuthors = (): Author[] => {
  return Object.values(authors);
};

export const defaultAuthor = authors['default'];
