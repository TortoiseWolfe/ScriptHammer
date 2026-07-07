/**
 * Social Media Platform Configuration
 * Settings for social sharing and integration
 */

export interface SocialPlatform {
  id: string;
  name: string;
  icon: string;
  color: string;
  shareUrl: string;
  ariaLabel: string;
  enabled: boolean;
}

export interface SocialShareConfig {
  enabledPlatforms: string[];
  defaultHashtags: string[];
  siteTwitterHandle?: string;
  analyticsEnabled: boolean;
  showShareCounts: boolean;
  openInNewTab: boolean;
  mobileNativeShare: boolean;
}

// Platform configurations
export const PLATFORMS: Record<string, SocialPlatform> = {
  twitter: {
    id: 'twitter',
    name: 'Twitter/X',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>`,
    color: '#1DA1F2',
    shareUrl:
      'https://twitter.com/intent/tweet?url={url}&text={title}&hashtags={tags}',
    ariaLabel: 'Share on Twitter',
    enabled: true,
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>`,
    color: '#0A66C2',
    shareUrl:
      'https://www.linkedin.com/sharing/share-offsite/?url={url}&title={title}&summary={description}',
    ariaLabel: 'Share on LinkedIn',
    enabled: true,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>`,
    color: '#1877F2',
    shareUrl: 'https://www.facebook.com/sharer/sharer.php?u={url}',
    ariaLabel: 'Share on Facebook',
    enabled: true,
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>`,
    color: '#FF4500',
    shareUrl: 'https://reddit.com/submit?url={url}&title={title}',
    ariaLabel: 'Share on Reddit',
    enabled: true,
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.149-.67.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.123-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>`,
    color: '#25D366',
    shareUrl: 'https://api.whatsapp.com/send?text={title}%20{url}',
    ariaLabel: 'Share on WhatsApp',
    enabled: true,
  },
  email: {
    id: 'email',
    name: 'Email',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z"/>
      <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z"/>
    </svg>`,
    color: '#EA4335',
    shareUrl: 'mailto:?subject={title}&body={description}%0A%0A{url}',
    ariaLabel: 'Share via Email',
    enabled: true,
  },
  twitch: {
    id: 'twitch',
    name: 'Twitch',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
    </svg>`,
    color: '#9146FF',
    shareUrl: 'https://www.twitch.tv/{username}',
    ariaLabel: 'Visit Twitch channel',
    enabled: true,
  },
};

// Global configuration with environment variable support
const getEnabledPlatformsFromEnv = (): string[] => {
  const envPlatforms = process.env.NEXT_PUBLIC_SOCIAL_PLATFORMS;
  if (envPlatforms) {
    return envPlatforms
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }
  // Default platforms if not configured
  return ['twitter', 'linkedin', 'facebook', 'reddit', 'email'];
};

export const socialConfig: SocialShareConfig = {
  enabledPlatforms: getEnabledPlatformsFromEnv(),
  defaultHashtags: ['webdev', 'nextjs', 'react', 'typescript'],
  siteTwitterHandle: process.env.NEXT_PUBLIC_SITE_TWITTER_HANDLE || '',
  analyticsEnabled: true,
  showShareCounts: false,
  openInNewTab: true,
  mobileNativeShare: true,
};

// Helper functions
export const generateShareUrl = (
  platform: SocialPlatform,
  content: {
    url: string;
    title: string;
    description?: string;
    tags?: string[];
  }
): string => {
  let shareUrl = platform.shareUrl;

  // Replace placeholders
  shareUrl = shareUrl.replace('{url}', encodeURIComponent(content.url));
  shareUrl = shareUrl.replace('{title}', encodeURIComponent(content.title));

  if (content.description) {
    shareUrl = shareUrl.replace(
      '{description}',
      encodeURIComponent(content.description)
    );
  }

  if (content.tags && content.tags.length > 0) {
    const hashtags = content.tags.join(',');
    shareUrl = shareUrl.replace('{tags}', hashtags);
  }

  return shareUrl;
};

export const getEnabledPlatforms = (): SocialPlatform[] => {
  return socialConfig.enabledPlatforms
    .map((id) => PLATFORMS[id])
    .filter((platform) => platform && platform.enabled);
};

export const getPlatformById = (id: string): SocialPlatform | undefined => {
  return PLATFORMS[id];
};

export const canUseNativeShare = (): boolean => {
  if (typeof window === 'undefined') return false;
  return socialConfig.mobileNativeShare && 'share' in navigator;
};
