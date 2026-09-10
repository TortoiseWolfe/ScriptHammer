import Cal, { getCalApi } from '@calcom/embed-react';
import { useEffect, useRef } from 'react';
import { createLogger } from '@/lib/logger';
import { useEmbedThemeColor } from '@/hooks/useEmbedThemeColor';

/**
 * A NON-EMPTY namespace, and it is load-bearing (#1111).
 *
 * `getCalApi()` with no argument defaults `namespace` to `""`, and the two halves of the embed
 * disagree about what `""` means:
 *
 *   - `<Cal>` tests it as FALSY, so it takes the non-namespaced branch and mounts the iframe on
 *     the root instance (`Cal.es.mjs:53-68`).
 *   - the loader stub tests `typeof c == "string"`, which is TRUE for `""`, so it takes the
 *     namespace branch, creates `Cal.ns[""]`, and the boot loop then constructs a SECOND
 *     instance for that key. The constructor does `actionsManagers[ns] = this.actionManager`,
 *     so the second one overwrites the first.
 *
 * Inbound iframe messages then dispatch on the instance that has no iframe, and its
 * `__iframeReady` handler calls `doInIframe`, which throws:
 *
 *     Uncaught Error: iframe doesn't exist. `createIframe` must be called before `doInIframe`
 *
 * A 50ms `setInterval` pushing `("ui", {colorScheme})` at every initialised namespace re-fires
 * it continuously, so it is one error per load plus a stream after it.
 *
 * Any non-empty string fixes it, because both halves then agree. It must be passed to
 * `getCalApi`, to `<Cal>`, AND to the popup button's `data-cal-namespace`, or they diverge
 * again — the click handler reads that attribute to pick an instance.
 */
const NAMESPACE = 'scripthammer';

interface CalComProviderProps {
  calLink: string;
  mode: 'inline' | 'popup';
  config?: {
    name?: string;
    email?: string;
    notes?: string;
    guests?: string[];
    theme?: 'light' | 'dark' | 'auto';
    /** Prefills the hidden `lead_ref` booking field, which the webhook joins on (#562). */
    lead_ref?: string;
  };
  styles?: Record<string, string>;
}

const logger = createLogger('components:calendar:CalCom');

export function CalComProvider({
  calLink,
  mode = 'inline',
  config,
  styles,
}: CalComProviderProps) {
  // Theme-aware brand color (issue #39). brandColor is the active DaisyUI theme's
  // --color-primary, applied to the embed when the iframe reports ready; the binary
  // light/dark `theme` prop is unchanged. (The Cal.com iframe initializes once, so an
  // already-rendered embed keeps its color until it re-initializes.)
  const { hexWithHash: brandColor, isDark } = useEmbedThemeColor('p');

  // A ref, not a dependency. The effect below subscribes event handlers exactly once; adding
  // `brandColor` to its dep array would re-run it on every theme change and stack duplicate
  // subscriptions. The ref lets the ready-callback read the current colour without that.
  const brandColorRef = useRef(brandColor);
  brandColorRef.current = brandColor;

  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace: NAMESPACE });

      // Listen for Cal.com events
      cal('on', {
        action: 'bookingSuccessful',

        callback: (e: any) => {
          logger.info('Calendar scheduled', {
            provider: 'Cal.com',
            name: e.detail?.name,
          });
        },
      });

      cal('on', {
        action: 'linkReady',
        callback: () => {
          logger.info('Calendar viewed', { provider: 'Cal.com' });

          // THE BRAND COLOUR GOES THROUGH `ui`, NOT THROUGH `config` (#1111).
          //
          // `config` becomes the iframe's QUERY STRING: embed-core's
          // `buildFilteredQueryParams` does `URLSearchParams.set(key, value)` on each entry,
          // so any nested object stringifies. This component used to pass
          // `branding: { brandColor }` inside `config`, which produced a live URL reading
          // `…&branding=%5Bobject+Object%5D&…` — the colour has never once reached the embed,
          // and the unit test was green because it asserted the object we computed rather
          // than the URL that was built from it.
          //
          // `ui` is the sanctioned home. The hosted embed validates it as
          // `{ theme?: string, styles?: Object }` and delivers it by `postMessage`
          // (`doInIframe`) rather than in a URL, so a nested object is correct HERE and only
          // here.
          //
          // AND IT MUST BE CALLED FROM `linkReady`: `ui` routes through `doInIframe`, which
          // throws if the iframe does not exist yet. That is the same throw the namespace fix
          // above removes — calling this at mount would reintroduce it by a different route.
          cal('ui', {
            styles: { branding: { brandColor: brandColorRef.current } },
          });
        },
      });
    })();
  }, []);

  if (mode === 'popup') {
    return (
      <button
        className="btn btn-primary"
        data-cal-link={calLink}
        data-cal-namespace={NAMESPACE}
        data-cal-config={JSON.stringify({
          ...config,
          theme: isDark ? 'dark' : 'light',
        })}
      >
        Schedule a Meeting
      </button>
    );
  }

  return (
    <Cal
      namespace={NAMESPACE}
      calLink={calLink}
      /*
       * HEIGHT IS 'auto', AND OVERFLOW IS NOT HIDDEN (#1162).
       *
       * This style lands on `.cal-inline-container`, the element embed-react wraps around
       * `<cal-inline>`. Cal.com's embed sizes ITSELF: the iframe measures its content and reports
       * a height by postMessage, which is why the iframe on production measured 1786px. Pinning
       * this element to 700px with `overflow: hidden` threw 1086px of that away — the month grid
       * cut off mid-row, inside a panel already reserving 1250px.
       *
       * `minHeight` is the floor that keeps the layout from collapsing before the iframe reports,
       * and it is the only size this component should assert. Do not reintroduce a fixed height
       * to "fix" spacing: whatever number you choose is wrong for a different event type, a
       * different month, or a narrower viewport, and the failure is silent — a clipped calendar
       * looks like a Cal.com quirk rather than our CSS.
       */
      style={{
        width: '100%',
        height: styles?.height || 'auto',
        minHeight: styles?.minHeight || '500px',
        ...styles,
      }}
      config={{
        ...config,
        theme: isDark ? 'dark' : 'light',
      }}
    />
  );
}
