import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Hud from '../Hud';

describe('Hud', () => {
  it('renders provided title/provenance, not a hardcoded wordmark', () => {
    const html = renderToStaticMarkup(
      <Hud
        title="Test City"
        subtitle="sub"
        provenance="© X · Y"
        modes={[{ key: 'tour', label: 'Tour' }]}
        activeMode="tour"
        onMode={() => {}}
        palettes={[{ key: 'toy', label: 'Toy' }]}
        activePalette="toy"
        onPalette={() => {}}
        showFps={false}
      />
    );
    expect(html).toContain('Test City');
    expect(html).toContain('© X · Y');
    expect(html).not.toContain('Chattanooga Mini'); // wordmark comes from props/packs
  });

  it('renders the optional views dock and link buttons only when provided (#234)', () => {
    const base = {
      title: 'T',
      provenance: 'P',
      modes: [{ key: 'orbit', label: 'Miniature' }],
      activeMode: 'orbit',
      onMode: () => {},
      palettes: [{ key: 'toy', label: 'Toy' }],
      activePalette: 'toy',
      onPalette: () => {},
      showFps: false,
    };
    const bare = renderToStaticMarkup(<Hud {...base} />);
    expect(bare).not.toContain('As-built');
    expect(bare).not.toContain('<a ');

    const full = renderToStaticMarkup(
      <Hud
        {...base}
        views={[
          { key: 'massing', label: 'Massing' },
          { key: 'asbuilt', label: 'As-built' },
        ]}
        activeView="asbuilt"
        onView={() => {}}
        links={[{ label: 'Property page', href: '/x/twins/y/house/' }]}
      />
    );
    expect(full).toContain('Massing');
    // the active view is marked pressed
    expect(full).toMatch(/aria-pressed="true"[^>]*>As-built/);
    // links render as real anchors with the caller-resolved href
    expect(full).toMatch(
      /<a[^>]+href="\/x\/twins\/y\/house\/"[^>]*>Property page/
    );
  });

  // #259 iter 7 — secondary modes live behind the ⋯ overflow, not the bar.
  it('keeps secondary modes out of the primary bar behind a ⋯ trigger', () => {
    const html = renderToStaticMarkup(
      <Hud
        title="T"
        provenance="P"
        modes={[
          { key: 'orbit', label: 'Miniature' },
          { key: 'walk', label: 'Walk', secondary: true },
        ]}
        activeMode="orbit"
        onMode={() => {}}
        palettes={[{ key: 'toy', label: 'Toy' }]}
        activePalette="toy"
        onPalette={() => {}}
        showFps={false}
      />
    );
    // Primary label present, secondary label absent (popover is closed in SSR)
    expect(html).toContain('Miniature');
    expect(html).not.toContain('Walk');
    // The overflow trigger is present and closed
    expect(html).toMatch(/aria-haspopup="menu"/);
    expect(html).toMatch(/aria-expanded="false"/);
  });

  it('renders no ⋯ trigger when nothing is secondary or overflow-only', () => {
    const html = renderToStaticMarkup(
      <Hud
        title="T"
        provenance="P"
        modes={[{ key: 'orbit', label: 'Miniature' }]}
        activeMode="orbit"
        onMode={() => {}}
        palettes={[]}
        activePalette=""
        onPalette={() => {}}
        showFps={false}
      />
    );
    expect(html).not.toMatch(/aria-haspopup="menu"/);
  });
});
