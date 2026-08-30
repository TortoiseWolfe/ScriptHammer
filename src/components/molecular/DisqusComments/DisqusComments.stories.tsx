import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import DisqusComments from './DisqusComments';

const meta = {
  title: 'Components/Molecular/DisqusComments',
  component: DisqusComments,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The comment thread under a blog post. It loads nothing until the reader scrolls to it, and renders nothing at all without a Disqus shortname — which is the default for a fresh fork. It injects a small stylesheet because Disqus’s `embed.js` cannot parse OKLCH, and picks a link colour that clears WCAG AA against the thread background rather than trusting the theme primary (#46). **The configured stories load real third-party content from disqus.com.**',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: { shortname: { control: 'text' }, url: { control: 'text' } },
  args: {
    slug: 'hello-world',
    title: 'Hello World',
    url: 'https://example.com/blog/hello-world',
    shortname: '',
  },
} satisfies Meta<typeof DisqusComments>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * No shortname configured — the component renders nothing. This is what a fresh
 * fork sees, and it is correct rather than broken.
 */
export const NotConfigured: Story = {};

/** With a shortname, the heading and thread container appear. */
export const Configured: Story = { args: { shortname: 'scripthammer' } };
