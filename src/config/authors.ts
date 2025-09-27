/**
 * Author Configuration
 * Defines author profiles for the blog system
 */

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

// Helper function to get social links from environment variables
const getAuthorSocialFromEnv = (): AuthorSocialLinks => {
  const social: AuthorSocialLinks = {};

  // Read from environment variables with empty defaults
  if (process.env.NEXT_PUBLIC_AUTHOR_GITHUB) {
    social.github = `https://github.com/${process.env.NEXT_PUBLIC_AUTHOR_GITHUB}`;
  }
  if (process.env.NEXT_PUBLIC_AUTHOR_TWITTER) {
    social.twitter = `https://twitter.com/${process.env.NEXT_PUBLIC_AUTHOR_TWITTER}`;
  }
  if (process.env.NEXT_PUBLIC_AUTHOR_LINKEDIN) {
    social.linkedin = `https://linkedin.com/in/${process.env.NEXT_PUBLIC_AUTHOR_LINKEDIN}`;
  }
  if (process.env.NEXT_PUBLIC_AUTHOR_WEBSITE) {
    social.website = process.env.NEXT_PUBLIC_AUTHOR_WEBSITE;
  }
  if (process.env.NEXT_PUBLIC_AUTHOR_EMAIL) {
    social.email = process.env.NEXT_PUBLIC_AUTHOR_EMAIL;
  }
  if (process.env.NEXT_PUBLIC_AUTHOR_MASTODON) {
    social.mastodon = process.env.NEXT_PUBLIC_AUTHOR_MASTODON;
  }
  if (process.env.NEXT_PUBLIC_AUTHOR_BLUESKY) {
    social.bluesky = process.env.NEXT_PUBLIC_AUTHOR_BLUESKY;
  }
  if (process.env.NEXT_PUBLIC_AUTHOR_TWITCH) {
    social.twitch = `https://twitch.tv/${process.env.NEXT_PUBLIC_AUTHOR_TWITCH}`;
  }

  return social;
};

// Default author entries with environment variable support
export const authors: Record<string, Author> = {
  default: {
    id: 'default',
    name: process.env.NEXT_PUBLIC_AUTHOR_NAME || 'Your Name',
    role: process.env.NEXT_PUBLIC_AUTHOR_ROLE || 'Developer',
    bio:
      process.env.NEXT_PUBLIC_AUTHOR_BIO || 'Building modern web applications.',
    avatar:
      process.env.NEXT_PUBLIC_AUTHOR_AVATAR || '/images/authors/default.jpg',
    social: getAuthorSocialFromEnv(),
    preferences: {
      showSocialLinks: true,
      showEmail: false,
      showBio: true,
    },
  },
  TurtleWolfe: {
    id: 'turtlewolfe',
    name: process.env.NEXT_PUBLIC_AUTHOR_NAME || 'TurtleWolfe',
    role: process.env.NEXT_PUBLIC_AUTHOR_ROLE || 'Full Stack Developer',
    bio:
      process.env.NEXT_PUBLIC_AUTHOR_BIO ||
      'Building modern web applications with Next.js and TypeScript. Passionate about clean code, performance, and developer experience.',
    avatar:
      process.env.NEXT_PUBLIC_AUTHOR_AVATAR ||
      '/images/authors/turtlewolfe.jpg',
    social: getAuthorSocialFromEnv(),
    preferences: {
      showSocialLinks: true,
      showEmail: false,
      showBio: true,
    },
  },
  // Legacy alias for backwards compatibility
  TortoiseWolfe: {
    id: 'tortoisewolfe',
    name: process.env.NEXT_PUBLIC_AUTHOR_NAME || 'TurtleWolfe',
    role: process.env.NEXT_PUBLIC_AUTHOR_ROLE || 'Full Stack Developer',
    bio:
      process.env.NEXT_PUBLIC_AUTHOR_BIO ||
      'Building modern web applications with Next.js and TypeScript. Passionate about clean code, performance, and developer experience.',
    avatar:
      process.env.NEXT_PUBLIC_AUTHOR_AVATAR ||
      '/images/authors/turtlewolfe.jpg',
    social: getAuthorSocialFromEnv(),
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
