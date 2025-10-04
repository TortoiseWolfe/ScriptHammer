import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibility Controls - ScriptHammer',
  description:
    'Customize your reading experience with accessibility controls. Adjust font size, line height, font family, and color vision settings for improved readability.',
};

export default function AccessibilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
