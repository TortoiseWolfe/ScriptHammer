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
});
