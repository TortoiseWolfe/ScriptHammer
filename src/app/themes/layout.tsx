import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Theme Playground - ScriptHammer',
  description:
    'Explore 32+ beautiful DaisyUI themes. Customize the look and feel of your application with our interactive theme switcher.',
};

export default function ThemesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
