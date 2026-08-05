'use client';

import { useAccessibility } from '@/contexts/AccessibilityContext';
import { ColorblindToggle } from '@/components/molecular/ColorblindToggle';
import { FontSwitcher } from '@/components/molecular/FontSwitcher';

export default function AccessibilityPage() {
  const { settings, updateSettings, resetSettings } = useAccessibility();
  const { fontSize, lineHeight, fontFamily } = settings;

  return (
    <main className="bg-base-100 min-h-full">
      <div className="mx-auto w-full px-4 py-6 sm:py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
            Accessibility Controls
          </h1>
          <p className="text-base-content mb-8 text-lg">
            Customize the reading experience to suit your preferences
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Font Size Control */}
            <div className="card bg-base-200 rounded-box">
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
            <div className="card bg-base-200 rounded-box">
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
            <div className="card bg-base-200 rounded-box">
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
            <div className="card bg-base-200 rounded-box">
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
            <div className="card bg-base-200 rounded-box">
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

          <div className="card bg-base-100 rounded-box">
            {/* The inline `fontSize` overrides that used to be on these
                elements referenced `--base-font-size` and `--font-scale`,
                neither of which is set by anything in the app — the provider
                writes `--font-scale-factor`. So this preview never responded
                to the S/M/L/XL buttons above it (#388). The Tailwind classes
                do the work correctly: `--text-*` already multiplies by
                `--font-scale-factor`. */}
            <div className="card-body accessibility-preview">
              <h2 className="text-2xl font-bold">Sample Heading</h2>
              <p className="text-lg">
                This is a lead paragraph showing how your accessibility settings
                affect the text display.
              </p>
              <p className="text-base">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat.
              </p>
              <p className="text-sm">
                Small text: These accessibility controls are saved to your
                browser and will persist across sessions.
              </p>
              {/* The scroller is INSIDE the well, not on it (#430, #511).
                  `<pre>` preserves whitespace and will not wrap, so this block
                  rendered 286px wide at x=56 and ran past a 320px viewport.
                  `overflow-x-auto` makes it reachable by scrolling — the
                  pattern "Pre/code blocks are responsive" already asserts. It
                  must NOT go on the `sh-well` element itself: the well paints
                  an inset shadow below its children, and on a scroll container
                  that shadow is clipped inside the scroll area and disappears. */}
              <div className="mt-4">
                <div className="sh-well bg-base-200 rounded-box p-4">
                  <pre className="overflow-x-auto text-sm">
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
          </div>

          {/* Current Settings Display */}
          {/* `max-w-full` is what makes DaisyUI's own scroller work (#511).
              `.stats` is `display: inline-grid` with `grid-auto-flow: column`
              and `overflow-x: auto` — but an inline-grid is sized by its
              CONTENT, so the box simply grew to 455px and the overflow rule
              never engaged. Capping the width at the container gives the
              `auto` something to scroll. */}
          <div className="stats mt-8 max-w-full">
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
