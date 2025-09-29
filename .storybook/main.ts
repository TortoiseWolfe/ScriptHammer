import type { StorybookConfig } from '@storybook/nextjs';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// Load environment variables from .env files
dotenvConfig({ path: path.resolve(process.cwd(), '.env.local') });
dotenvConfig({ path: path.resolve(process.cwd(), '.env') });

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-onboarding',
    '@storybook/addon-links',
    '@storybook/addon-docs',
    '@chromatic-com/storybook',
    '@storybook/addon-themes',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  env: (config) => ({
    ...config,
    // Pass through all NEXT_PUBLIC_ env vars to Storybook
    ...Object.keys(process.env)
      .filter((key) => key.startsWith('NEXT_PUBLIC_'))
      .reduce(
        (env, key) => {
          env[key] = process.env[key];
          return env;
        },
        {} as Record<string, string>
      ),
  }),
};

export default config;
