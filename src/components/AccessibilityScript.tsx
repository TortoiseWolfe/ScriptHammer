import {
  ACCESSIBILITY_STORAGE_KEYS,
  CONSENT_STORAGE_KEY,
  DEFAULT_ACCESSIBILITY_SETTINGS,
  DISPLAY_FONT_FAMILIES,
  FONT_FAMILIES,
  FONT_SCALE_FACTORS,
  LINE_HEIGHTS,
} from '@/config/accessibility-tokens';

/**
 * Applies the user's accessibility settings BEFORE first paint (#388).
 *
 * `AccessibilityProvider` reads storage in a mount effect, so without this the
 * page paints at the CSS default and then re-typesets on hydration — a 50%
 * jump at the default setting, roughly 900px of content shift on a long page,
 * on every cold load of every route.
 *
 * Mirrors `ThemeScript`: a plain synchronous inline `<script>` rendered as an
 * early child of `<body>`. Permitted by the CSP (`script-src` includes
 * `'unsafe-inline'`; the policy ships as a meta tag because this is a static
 * export, so a nonce is not possible). Hydration mismatch is already covered
 * by `suppressHydrationWarning` on `<html>` and `<body>` in `layout.tsx`.
 *
 * Two things this must NOT copy from `ThemeScript`:
 *
 *  1. `ThemeScript` reads `localStorage` unconditionally. Accessibility
 *     settings are consent-gated — the provider writes to `localStorage` only
 *     when FUNCTIONAL cookies are allowed, and `sessionStorage` otherwise. An
 *     unconditional read would silently miss every user who has not granted
 *     consent, so the gate is replicated here.
 *  2. The token values are serialised from the shared module rather than
 *     retyped, so they cannot drift from what the provider applies.
 */
/**
 * Serialise a build-time constant for embedding in an inline `<script>`.
 *
 * Everything passed here is a module-level literal, never user input, so this
 * is not an injection boundary. Escaping `<` anyway means a future token value
 * containing `</script>` cannot terminate the tag early.
 */
function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export default function AccessibilityScript() {
  const script = `
    (function() {
      var SCALE = ${embed(FONT_SCALE_FACTORS)};
      var LINE = ${embed(LINE_HEIGHTS)};
      var FAMILY = ${embed(FONT_FAMILIES)};
      var DISPLAY = ${embed(DISPLAY_FONT_FAMILIES)};
      var DEFAULTS = ${embed(DEFAULT_ACCESSIBILITY_SETTINGS)};
      var KEYS = ${embed(ACCESSIBILITY_STORAGE_KEYS)};
      var CONSENT_KEY = ${embed(CONSENT_STORAGE_KEY)};

      // Mirrors canUseCookies(CookieCategory.FUNCTIONAL) from utils/consent.
      // The provider picks its store the same way; reading the wrong one here
      // would reintroduce exactly the flash this script exists to remove.
      function canPersist() {
        try {
          var raw = localStorage.getItem(CONSENT_KEY);
          if (!raw) return false;
          return JSON.parse(raw).functional === true;
        } catch (e) {
          return false;
        }
      }

      function read(storage, key, fallback) {
        try {
          return storage.getItem(key) || fallback;
        } catch (e) {
          return fallback;
        }
      }

      try {
        var storage = canPersist() ? localStorage : sessionStorage;

        var fontSize = read(storage, KEYS.fontSize, DEFAULTS.fontSize);
        var lineHeight = read(storage, KEYS.lineHeight, DEFAULTS.lineHeight);
        var fontFamily = read(storage, KEYS.fontFamily, DEFAULTS.fontFamily);
        var reduceMotion = read(storage, KEYS.reduceMotion, DEFAULTS.reduceMotion);

        // A stored value could be stale or hand-edited; fall back rather than
        // writing "undefined" into a custom property.
        var scale = SCALE[fontSize] || SCALE[DEFAULTS.fontSize];
        var leading = LINE[lineHeight] || LINE[DEFAULTS.lineHeight];
        var family = FAMILY[fontFamily] || FAMILY[DEFAULTS.fontFamily];
        var display = DISPLAY[fontFamily] || DISPLAY[DEFAULTS.fontFamily];

        var root = document.documentElement;
        root.style.setProperty('--font-scale-factor', String(scale));

        // Font choice rides on custom properties now (#377), which means it can
        // be applied to <html> immediately instead of waiting for <body> to
        // exist. globals.css maps these onto body and h1-h6.
        root.style.setProperty('--sh-font-body', family);
        root.style.setProperty('--sh-font-display', display);

        if (reduceMotion === 'reduce') {
          root.setAttribute('data-reduce-motion', 'true');
        }

        // Line height is still an inline body style, so it still has to wait
        // for body to exist. It is the remaining cause of visible reflow.
        function applyBody() {
          if (!document.body) return false;
          document.body.style.lineHeight = leading;
          return true;
        }

        if (!applyBody()) {
          var observer = new MutationObserver(function () {
            if (applyBody()) observer.disconnect();
          });
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
          });
        }
      } catch (e) {
        // Never block paint on a storage or parse failure — the CSS defaults
        // already match the default setting.
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
