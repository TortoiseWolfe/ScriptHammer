/**
 * Social Media Platform Configuration
 * Defines social sharing platforms with their URLs, icons, and metadata
 */

export enum SocialPlatform {
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  REDDIT = 'reddit',
  EMAIL = 'email',
  GITHUB = 'github',
  INSTAGRAM = 'instagram',
  YOUTUBE = 'youtube',
  MASTODON = 'mastodon',
  WEBSITE = 'website',
}

export interface SocialPlatformConfig {
  platform: SocialPlatform;
  displayName: string;
  icon: string; // Icon component name or SVG path
  shareUrlTemplate?: string; // URL template for sharing
  profileUrlTemplate?: string; // URL template for profiles
  colorScheme: {
    primary: string;
    secondary?: string;
    hover: string;
    darkMode?: {
      primary: string;
      secondary?: string;
      hover: string;
    };
  };
  requiresAuth: boolean;
  metadataFields: string[]; // Required meta tags for sharing
  enabled: boolean;
  displayOrder: number;
}

export const socialPlatforms: Record<SocialPlatform, SocialPlatformConfig> = {
  [SocialPlatform.TWITTER]: {
    platform: SocialPlatform.TWITTER,
    displayName: 'X (Twitter)',
    icon: 'twitter', // Will map to icon component
    shareUrlTemplate: 'https://twitter.com/intent/tweet?text={title}&url={url}',
    profileUrlTemplate: 'https://twitter.com/{username}',
    colorScheme: {
      primary: '#1DA1F2',
      hover: '#1a8cd8',
      darkMode: {
        primary: '#1DA1F2',
        hover: '#1a8cd8',
      },
    },
    requiresAuth: false,
    metadataFields: [
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'twitter:image',
    ],
    enabled: true,
    displayOrder: 1,
  },

  [SocialPlatform.LINKEDIN]: {
    platform: SocialPlatform.LINKEDIN,
    displayName: 'LinkedIn',
    icon: 'linkedin',
    shareUrlTemplate:
      'https://www.linkedin.com/sharing/share-offsite/?url={url}',
    profileUrlTemplate: 'https://www.linkedin.com/in/{username}',
    colorScheme: {
      primary: '#0077B5',
      hover: '#006399',
      darkMode: {
        primary: '#0A66C2',
        hover: '#004182',
      },
    },
    requiresAuth: false,
    metadataFields: ['og:title', 'og:description', 'og:image'],
    enabled: true,
    displayOrder: 2,
  },

  [SocialPlatform.FACEBOOK]: {
    platform: SocialPlatform.FACEBOOK,
    displayName: 'Facebook',
    icon: 'facebook',
    shareUrlTemplate: 'https://www.facebook.com/sharer/sharer.php?u={url}',
    profileUrlTemplate: 'https://www.facebook.com/{username}',
    colorScheme: {
      primary: '#1877F2',
      hover: '#0c63d4',
      darkMode: {
        primary: '#1877F2',
        hover: '#0c63d4',
      },
    },
    requiresAuth: false,
    metadataFields: ['og:title', 'og:description', 'og:image', 'og:url'],
    enabled: true,
    displayOrder: 3,
  },

  [SocialPlatform.REDDIT]: {
    platform: SocialPlatform.REDDIT,
    displayName: 'Reddit',
    icon: 'reddit',
    shareUrlTemplate: 'https://reddit.com/submit?url={url}&title={title}',
    profileUrlTemplate: 'https://reddit.com/u/{username}',
    colorScheme: {
      primary: '#FF4500',
      hover: '#e03d00',
      darkMode: {
        primary: '#FF4500',
        hover: '#e03d00',
      },
    },
    requiresAuth: false,
    metadataFields: ['og:title', 'og:description'],
    enabled: true,
    displayOrder: 4,
  },

  [SocialPlatform.EMAIL]: {
    platform: SocialPlatform.EMAIL,
    displayName: 'Email',
    icon: 'email',
    shareUrlTemplate: 'mailto:?subject={title}&body={description}%0A%0A{url}',
    profileUrlTemplate: 'mailto:{username}',
    colorScheme: {
      primary: '#6B7280',
      hover: '#4B5563',
      darkMode: {
        primary: '#9CA3AF',
        hover: '#D1D5DB',
      },
    },
    requiresAuth: false,
    metadataFields: [],
    enabled: true,
    displayOrder: 5,
  },

  [SocialPlatform.GITHUB]: {
    platform: SocialPlatform.GITHUB,
    displayName: 'GitHub',
    icon: 'github',
    shareUrlTemplate: undefined, // GitHub doesn't have a share URL
    profileUrlTemplate: 'https://github.com/{username}',
    colorScheme: {
      primary: '#181717',
      hover: '#000000',
      darkMode: {
        primary: '#F0F6FC',
        hover: '#FFFFFF',
      },
    },
    requiresAuth: false,
    metadataFields: [],
    enabled: true,
    displayOrder: 6,
  },

  [SocialPlatform.INSTAGRAM]: {
    platform: SocialPlatform.INSTAGRAM,
    displayName: 'Instagram',
    icon: 'instagram',
    shareUrlTemplate: undefined, // Instagram doesn't support URL sharing
    profileUrlTemplate: 'https://instagram.com/{username}',
    colorScheme: {
      primary: '#E4405F',
      hover: '#d62d4b',
      darkMode: {
        primary: '#E4405F',
        hover: '#d62d4b',
      },
    },
    requiresAuth: false,
    metadataFields: [],
    enabled: true,
    displayOrder: 7,
  },

  [SocialPlatform.YOUTUBE]: {
    platform: SocialPlatform.YOUTUBE,
    displayName: 'YouTube',
    icon: 'youtube',
    shareUrlTemplate: undefined,
    profileUrlTemplate: 'https://youtube.com/@{username}',
    colorScheme: {
      primary: '#FF0000',
      hover: '#e60000',
      darkMode: {
        primary: '#FF0000',
        hover: '#e60000',
      },
    },
    requiresAuth: false,
    metadataFields: [],
    enabled: true,
    displayOrder: 8,
  },

  [SocialPlatform.MASTODON]: {
    platform: SocialPlatform.MASTODON,
    displayName: 'Mastodon',
    icon: 'mastodon',
    shareUrlTemplate: 'https://mastodon.social/share?text={title}%20{url}',
    profileUrlTemplate: 'https://{domain}/@{username}',
    colorScheme: {
      primary: '#6364FF',
      hover: '#4a4bf5',
      darkMode: {
        primary: '#858AFA',
        hover: '#6364FF',
      },
    },
    requiresAuth: false,
    metadataFields: [],
    enabled: true,
    displayOrder: 9,
  },

  [SocialPlatform.WEBSITE]: {
    platform: SocialPlatform.WEBSITE,
    displayName: 'Website',
    icon: 'globe',
    shareUrlTemplate: undefined,
    profileUrlTemplate: '{url}', // Direct URL
    colorScheme: {
      primary: '#3B82F6',
      hover: '#2563EB',
      darkMode: {
        primary: '#60A5FA',
        hover: '#3B82F6',
      },
    },
    requiresAuth: false,
    metadataFields: [],
    enabled: true,
    displayOrder: 10,
  },
};

/**
 * Get enabled social platforms for sharing
 */
export function getEnabledSharePlatforms(): SocialPlatformConfig[] {
  return Object.values(socialPlatforms)
    .filter((platform) => platform.enabled && platform.shareUrlTemplate)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Get enabled social platforms for author profiles
 */
export function getEnabledProfilePlatforms(): SocialPlatformConfig[] {
  return Object.values(socialPlatforms)
    .filter((platform) => platform.enabled && platform.profileUrlTemplate)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Generate share URL for a platform
 */
export function generateShareUrl(
  platform: SocialPlatform,
  data: {
    url: string;
    title: string;
    description?: string;
  }
): string | null {
  const config = socialPlatforms[platform];
  if (!config.shareUrlTemplate) return null;

  let shareUrl = config.shareUrlTemplate
    .replace('{url}', encodeURIComponent(data.url))
    .replace('{title}', encodeURIComponent(data.title));

  if (data.description) {
    shareUrl = shareUrl.replace(
      '{description}',
      encodeURIComponent(data.description)
    );
  }

  return shareUrl;
}

/**
 * Generate profile URL for a platform
 */
export function generateProfileUrl(
  platform: SocialPlatform,
  username: string,
  domain?: string
): string | null {
  const config = socialPlatforms[platform];
  if (!config.profileUrlTemplate) return null;

  let profileUrl = config.profileUrlTemplate.replace('{username}', username);

  // Handle special cases like Mastodon which needs domain
  if (platform === SocialPlatform.MASTODON && domain) {
    profileUrl = profileUrl.replace('{domain}', domain);
  }

  // Handle website which is just a direct URL
  if (platform === SocialPlatform.WEBSITE) {
    profileUrl = username; // Username is actually the full URL
  }

  return profileUrl;
}
