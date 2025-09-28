'use client';

import ThemeSwitcher from '@/components/theme/ThemeSwitcher';
import Text from '@/components/subatomic/Text/Text';

export default function ThemesPage() {
  return (
    <main className="bg-base-100 min-h-screen">
      <div className="container mx-auto px-4 py-6 sm:py-8 md:py-12">
        <div className="mb-8 text-center">
          <h1 className="mb-4 !text-2xl font-bold sm:!text-4xl md:!text-5xl">
            ScriptHammer Theme Playground
          </h1>
          <p className="text-base-content/70 text-base sm:text-lg md:text-xl">
            Explore 32+ beautiful DaisyUI themes
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          <ThemeSwitcher />
        </div>

        <div className="divider my-12">Theme Preview</div>

        {/* Simplified theme preview using our Text component */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Text Component Showcase */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <Text variant="h3" className="mb-4">
                Typography
              </Text>
              <div className="space-y-2">
                <Text variant="h4">Heading Example</Text>
                <Text variant="lead">Lead paragraph text</Text>
                <Text variant="body">
                  Body text for regular content in the current theme.
                </Text>
                <Text variant="small">
                  Small text for secondary information
                </Text>
                <Text variant="code">const theme = &quot;current&quot;;</Text>
              </div>
            </div>
          </div>

          {/* Color Showcase */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <Text variant="h3" className="mb-4">
                Theme Colors
              </Text>
              <div className="space-y-2">
                <button className="btn btn-primary w-full">Primary</button>
                <button className="btn btn-secondary w-full">Secondary</button>
                <button className="btn btn-accent w-full">Accent</button>
                <div className="flex gap-2">
                  <button className="btn btn-success btn-sm">Success</button>
                  <button className="btn btn-warning btn-sm">Warning</button>
                  <button className="btn btn-error btn-sm">Error</button>
                  <button className="btn btn-info btn-sm">Info</button>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="space-y-2">
            <div className="alert alert-info">
              <Text variant="body">
                Info: Theme changes are saved automatically
              </Text>
            </div>
            <div className="alert alert-success">
              <Text variant="body">Success: Theme applied</Text>
            </div>
          </div>

          {/* Background Colors */}
          <div className="space-y-2">
            <div className="bg-base-100 rounded-lg p-4">
              <Text variant="body">Base 100 Background</Text>
            </div>
            <div className="bg-base-200 rounded-lg p-4">
              <Text variant="body">Base 200 Background</Text>
            </div>
            <div className="bg-base-300 rounded-lg p-4">
              <Text variant="body">Base 300 Background</Text>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
