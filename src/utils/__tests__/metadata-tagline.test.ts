import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * The home title's tagline comes from project config (#1327).
 *
 * It was hard-coded to "Modern Web Starter" in metadata.tsx, so a rebranded fork's
 * front page was titled "<Fork> - Modern Web Starter". The config is read when the
 * module loads, so each case re-imports with its own environment.
 */
async function homeTitle(): Promise<string> {
  vi.resetModules();
  const { generateMetadata } = await import('../metadata');
  return String(generateMetadata({}).title);
}

describe('generateMetadata — the home title tagline', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps this repo’s own tagline by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_PROJECT_NAME', '');
    vi.stubEnv('NEXT_PUBLIC_PROJECT_TAGLINE', undefined as unknown as string);
    expect(await homeTitle()).toBe('ScriptHammer - Modern Web Starter');
  });

  it('lets a fork set its own tagline', async () => {
    vi.stubEnv('NEXT_PUBLIC_PROJECT_NAME', 'Acme');
    vi.stubEnv('NEXT_PUBLIC_PROJECT_TAGLINE', 'Plumbing for Chattanooga');
    expect(await homeTitle()).toBe('Acme - Plumbing for Chattanooga');
  });

  it('drops the separator when the tagline is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_PROJECT_NAME', 'Acme');
    vi.stubEnv('NEXT_PUBLIC_PROJECT_TAGLINE', '');
    expect(await homeTitle()).toBe('Acme');
  });

  it('leaves inner-page titles alone', async () => {
    vi.stubEnv('NEXT_PUBLIC_PROJECT_NAME', 'Acme');
    vi.stubEnv('NEXT_PUBLIC_PROJECT_TAGLINE', 'Anything');
    vi.resetModules();
    const { generateMetadata } = await import('../metadata');
    expect(generateMetadata({ title: 'Pricing' }).title).toBe('Pricing | Acme');
  });
});
