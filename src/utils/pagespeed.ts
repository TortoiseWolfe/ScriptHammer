/**
 * PageSpeed Insights v5 — the thing `NEXT_PUBLIC_PAGESPEED_API_KEY` was bought for.
 *
 * The key was a MANDATORY deploy secret that nothing consumed (#987). `deploy.yml`
 * exited 1 before `pnpm build` when it was empty, so a fork could not publish a site
 * at all without obtaining a Google API key — and setting one changed nothing, because
 * no component, hook, service or script ever called the API. The gate was an emptiness
 * check, never a validity one: `placeholder-no-pagespeed-key-see-issue` satisfied it,
 * which is what a real fork deployed on.
 *
 * WHAT THIS ADDS THAT /status DID NOT ALREADY HAVE. The page showed two things:
 * committed Lighthouse scores from CI (`docs/lighthouse-scores.json`) and this
 * visitor's own Web Vitals. The CI scores are stale by construction — monitor.yml's
 * commit step is disabled, so that file is updated by hand — and one visitor's vitals
 * are a sample of one.
 *
 * PageSpeed Insights returns BOTH halves of what is missing:
 *   lighthouseResult    a lab audit Google runs on demand, now, from its own
 *                       infrastructure. Always available.
 *   loadingExperience   CrUX field data: real users, 28-day rolling. Only present for
 *                       URLs with enough traffic, which is why this is optional here
 *                       rather than the headline.
 *
 * THE KEY IS OPTIONAL TO THE CALL. The v5 endpoint answers unauthenticated requests at
 * a low quota; a key raises it. So the honest states are "worked", "rate limited — a
 * key would raise the quota", and "the API said no", not "configured / not configured".
 * That is the whole reason the deploy gate was the wrong shape: a missing key degrades
 * one panel, and never justified refusing to publish a site.
 */

/** Google's category scores are 0–1; the UI everywhere else in this repo is 0–100. */
const toScore = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : null;

export type PageSpeedStrategy = 'mobile' | 'desktop';

/** One CrUX metric, already in the shape the status ledger renders. */
export interface FieldMetric {
  /** e.g. LARGEST_CONTENTFUL_PAINT_MS */
  id: string;
  /** The 75th-percentile value Google reports for this metric. */
  percentile: number;
  /** FAST | AVERAGE | SLOW — Google's own bucketing, not ours. */
  category: 'FAST' | 'AVERAGE' | 'SLOW' | string;
}

export interface PageSpeedLab {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

export type PageSpeedResult =
  | {
      state: 'ok';
      lab: PageSpeedLab;
      /** Absent when the URL has too little real traffic for CrUX. */
      field: FieldMetric[] | null;
      /** The URL Google actually audited, which may differ from the one requested. */
      url: string;
      fetchedAt: string;
    }
  | {
      state: 'rate-limited';
      /** True when no key was sent, which is the actionable half of this state. */
      keyless: boolean;
    }
  | { state: 'error'; message: string };

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * The key is read here rather than passed in so that callers cannot accidentally
 * render it. `next.config.ts` bakes it into the bundle at build time; an absent one
 * arrives as `undefined`, and an unset repository secret arrives as an EMPTY STRING,
 * so both have to count as "no key".
 */
export function pageSpeedApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_PAGESPEED_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function pageSpeedRequestUrl(
  url: string,
  strategy: PageSpeedStrategy,
  key: string | null
): string {
  const params = new URLSearchParams({ url, strategy });
  // Four separate `category` params, not a comma-joined one — the API treats a
  // comma-joined value as a single unknown category and returns 400.
  for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) {
    params.append('category', c);
  }
  if (key) params.set('key', key);
  return `${ENDPOINT}?${params.toString()}`;
}

interface PsiCategory {
  score?: unknown;
}

interface PsiExperience {
  metrics?: Record<
    string,
    { percentile?: unknown; category?: unknown } | undefined
  >;
}

interface PsiResponse {
  id?: string;
  lighthouseResult?: {
    categories?: Record<string, PsiCategory | undefined>;
  };
  loadingExperience?: PsiExperience;
  originLoadingExperience?: PsiExperience;
}

/**
 * URL-level CrUX first, then ORIGIN-level.
 *
 * `loadingExperience` describes the exact URL and is empty for most pages, because a
 * single page rarely has enough real traffic to be reported. `originLoadingExperience`
 * aggregates the whole origin and is populated far more often — verified in the v5
 * discovery document, which carries both fields.
 *
 * Taking only the first is why a field panel would have looked permanently broken on
 * every site but the largest. Preferring the URL when it exists keeps the more specific
 * answer when there is one.
 */
function readExperience(exp: PsiExperience | undefined): FieldMetric[] | null {
  const metrics = exp?.metrics;
  if (!metrics) return null;
  const out: FieldMetric[] = [];
  for (const [id, m] of Object.entries(metrics)) {
    if (!m || typeof m.percentile !== 'number') continue;
    out.push({
      id,
      percentile: m.percentile,
      category: typeof m.category === 'string' ? m.category : 'UNKNOWN',
    });
  }
  // An empty metrics object means CrUX has no data for this URL, which is not the
  // same as "the field half is missing from the response". Both render identically,
  // so collapse them rather than making the caller distinguish.
  return out.length ? out : null;
}

function readField(body: PsiResponse): FieldMetric[] | null {
  return (
    readExperience(body.loadingExperience) ??
    readExperience(body.originLoadingExperience)
  );
}

/**
 * Ask Google to audit `url` now.
 *
 * NEVER THROWS. This drives one panel on a status page, and a status page that
 * cannot render because a third party is slow has failed at its only job.
 */
export async function fetchPageSpeed(
  url: string,
  strategy: PageSpeedStrategy = 'mobile',
  init?: { signal?: AbortSignal }
): Promise<PageSpeedResult> {
  const key = pageSpeedApiKey();

  let res: Response;
  try {
    res = await fetch(pageSpeedRequestUrl(url, strategy, key), {
      signal: init?.signal,
    });
  } catch (error) {
    return {
      state: 'error',
      message: error instanceof Error ? error.message : 'request failed',
    };
  }

  // 429 is the quota answer. 403 is what an unauthenticated caller gets when the
  // anonymous quota is exhausted, so it reports as rate-limited too — telling
  // someone "forbidden" when the fix is "set a key" sends them to the wrong place.
  if (res.status === 429 || res.status === 403) {
    return { state: 'rate-limited', keyless: key === null };
  }
  if (!res.ok) {
    return { state: 'error', message: `PageSpeed API returned ${res.status}` };
  }

  let body: PsiResponse;
  try {
    body = (await res.json()) as PsiResponse;
  } catch {
    return { state: 'error', message: 'PageSpeed API returned invalid JSON' };
  }

  const categories = body.lighthouseResult?.categories ?? {};
  return {
    state: 'ok',
    lab: {
      performance: toScore(categories.performance?.score),
      accessibility: toScore(categories.accessibility?.score),
      bestPractices: toScore(categories['best-practices']?.score),
      seo: toScore(categories.seo?.score),
    },
    field: readField(body),
    url: typeof body.id === 'string' ? body.id : url,
    fetchedAt: new Date().toISOString(),
  };
}
