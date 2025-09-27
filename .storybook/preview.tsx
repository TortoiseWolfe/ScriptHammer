import React from 'react';
import type { Preview } from '@storybook/react';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import { ConsentProvider } from '../src/contexts/ConsentContext';
import '../src/app/globals.css';

// Initialize MSW
if (typeof window !== 'undefined') {
  import('../src/mocks/browser').then(({ worker }) => {
    // Start the mocking when in Storybook
    worker.start({
      onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    });
  });
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // Configure addon-a11y to use WCAG 2.1 AA standards
      config: {
        rules: [
          {
            // WCAG 2.1 AA rules
            id: 'wcag2aa',
            enabled: true,
          },
          {
            // Additional best practices
            id: 'best-practice',
            enabled: true,
          },
        ],
      },
      options: {
        runOnly: {
          type: 'tag',
          values: ['wcag2aa', 'best-practice'],
        },
      },
    },
  },
  decorators: [
    // Add ConsentProvider wrapper
    (Story) => (
      <ConsentProvider>
        <Story />
      </ConsentProvider>
    ),
    // Theme decorator
    withThemeByDataAttribute({
      themes: {
        light: 'light',
        dark: 'dark',
        cupcake: 'cupcake',
        bumblebee: 'bumblebee',
        emerald: 'emerald',
        corporate: 'corporate',
        synthwave: 'synthwave',
        retro: 'retro',
        cyberpunk: 'cyberpunk',
        valentine: 'valentine',
        halloween: 'halloween',
        garden: 'garden',
        forest: 'forest',
        aqua: 'aqua',
        lofi: 'lofi',
        pastel: 'pastel',
        fantasy: 'fantasy',
        wireframe: 'wireframe',
        black: 'black',
        luxury: 'luxury',
        dracula: 'dracula',
        cmyk: 'cmyk',
        autumn: 'autumn',
        business: 'business',
        acid: 'acid',
        lemonade: 'lemonade',
        night: 'night',
        coffee: 'coffee',
        winter: 'winter',
        dim: 'dim',
        nord: 'nord',
        sunset: 'sunset',
      },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
  ],
};

export default preview;
