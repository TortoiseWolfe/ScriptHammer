'use client';

import { useAccessibility } from '@/contexts/AccessibilityContext';
import { ColorblindToggle } from '@/components/atomic/ColorblindToggle';
import { FontSwitcher } from '@/components/atomic/FontSwitcher';

export default function AccessibilityPage() {
  const { settings, updateSettings, resetSettings } = useAccessibility();
  const { fontSize, lineHeight, fontFamily } = settings;

  return (
    <main className="bg-base-100 min-h-screen">
      <div className="container mx-auto px-4 py-6 sm:py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
            Accessibility Controls
          </h1>
          <p className="text-base-content/70 mb-8 text-lg">
            Customize the reading experience to suit your preferences
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Font Size Control */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title mb-4">Font Size</h2>
                <div className="flex flex-wrap gap-2">
                  {(['small', 'medium', 'large', 'x-large'] as const).map(
                    (size) => (
                      <button
                        key={size}
                        onClick={() => updateSettings({ fontSize: size })}
                        className={`btn ${fontSize === size ? 'btn-primary' : 'btn-outline'}`}
                      >
                        {size.charAt(0).toUpperCase() +
                          size.slice(1).replace('-', ' ')}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Line Height Control */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title mb-4">Line Spacing</h2>
                <div className="flex flex-wrap gap-2">
                  {(['compact', 'normal', 'relaxed'] as const).map((height) => (
                    <button
                      key={height}
                      onClick={() => updateSettings({ lineHeight: height })}
                      className={`btn ${lineHeight === height ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {height.charAt(0).toUpperCase() + height.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Font Family Control */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title mb-4">Font Selection</h2>
                <p className="mb-4 text-sm">
                  Choose from a variety of fonts including accessibility-focused
                  options for improved readability
                </p>
                <FontSwitcher className="w-full" />
              </div>
            </div>

            {/* Color Vision Control */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title mb-4">Color Vision Assistance</h2>
                <p className="mb-4 text-sm">
                  Apply color corrections to enhance color distinction for
                  various types of color vision deficiencies
                </p>
                <ColorblindToggle className="w-full" />
              </div>
            </div>

            {/* Reset Button */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title mb-4">Reset Settings</h2>
                <button onClick={resetSettings} className="btn btn-warning">
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="divider my-12">Preview</div>

          <div className="card bg-base-100 shadow-xl">
            <div
              className="card-body accessibility-preview"
              style={{ fontSize: `var(--base-font-size)` }}
            >
              <h2
                className="text-2xl font-bold"
                style={{ fontSize: `calc(2rem * var(--font-scale, 1))` }}
              >
                Sample Heading
              </h2>
              <p
                className="text-lg"
                style={{ fontSize: `calc(1.125rem * var(--font-scale, 1))` }}
              >
                This is a lead paragraph showing how your accessibility settings
                affect the text display.
              </p>
              <p style={{ fontSize: `calc(1rem * var(--font-scale, 1))` }}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat.
              </p>
              <p
                className="text-sm"
                style={{ fontSize: `calc(0.875rem * var(--font-scale, 1))` }}
              >
                Small text: These accessibility controls are saved to your
                browser and will persist across sessions.
              </p>
              <div className="mt-4">
                <pre
                  className="bg-base-200 rounded p-4"
                  style={{ fontSize: `calc(0.875rem * var(--font-scale, 1))` }}
                >
                  <code>{`// Code example
const settings = {
  fontSize: "${fontSize}",
  lineHeight: "${lineHeight}",
  fontFamily: "${fontFamily}"
};`}</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Current Settings Display */}
          <div className="stats mt-8 shadow">
            <div className="stat">
              <div className="stat-title">Current Font Size</div>
              <div className="stat-value text-primary">{fontSize}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Current Line Height</div>
              <div className="stat-value text-secondary">{lineHeight}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Current Font</div>
              <div className="stat-value text-accent">
                {fontFamily === 'sans-serif'
                  ? 'Sans'
                  : fontFamily === 'serif'
                    ? 'Serif'
                    : 'Mono'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
