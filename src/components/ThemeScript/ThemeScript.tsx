import { CONSENT_STORAGE_KEY } from '@/config/accessibility-tokens';

export default function ThemeScript() {
  const themeScript = `
    (function() {
      var CONSENT_KEY = ${JSON.stringify(CONSENT_STORAGE_KEY)};

      /*
        Mirrors readStoredThemeOrNull() in src/utils/apply-theme.ts (#1016).

        This USED to read localStorage unconditionally, which was fine only while
        the nav wrote there unconditionally too. Now that persistence is
        consent-gated, a visitor who declined functional cookies has their theme
        in sessionStorage — and reading only localStorage would paint the default
        before hydration and then flip, on every single page load.

        The other store is consulted as a fallback for the same reason it is
        there: consent governs what may be WRITTEN, not what may be read back,
        and without it every theme chosen before the gate existed is lost.
      */
      function canPersist() {
        try {
          var raw = localStorage.getItem(CONSENT_KEY);
          if (!raw) return false;
          return JSON.parse(raw).functional === true;
        } catch (e) {
          return false;
        }
      }

      function storedTheme() {
        try {
          var preferred = canPersist() ? localStorage : sessionStorage;
          var other = preferred === localStorage ? sessionStorage : localStorage;
          return preferred.getItem('theme') || other.getItem('theme') || null;
        } catch (e) {
          return null;
        }
      }

      function getSystemTheme() {
        // Check if user prefers dark mode
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return 'scripthammer-dark';
        }
        return 'scripthammer-light';
      }

      function applyTheme(theme) {
        if (!theme) {
          // storedTheme() swallows storage errors and returns null of its own.
          theme = storedTheme() || getSystemTheme();
        }

        document.documentElement.setAttribute('data-theme', theme);
        // Also set on body as backup
        if (document.body) {
          document.body.setAttribute('data-theme', theme);
        }

        return theme;
      }

      // Apply theme immediately on initial load
      var currentTheme = applyTheme();

      // Reapply when DOM is ready (only on initial load)
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          applyTheme(currentTheme);
        });
      }

      // Listen for storage changes (theme changes from other tabs/windows)
      window.addEventListener('storage', function(e) {
        if (e.key === 'theme' && e.newValue) {
          currentTheme = e.newValue;
          applyTheme(currentTheme);
        }
      });

      // Listen for custom theme change events (from same tab)
      // Producer: applyTheme() in src/utils/apply-theme.ts, which dispatches this
      // unconditionally. That matters for a visitor who declined functional
      // cookies — the StorageEvent applyTheme also fires IS consent-gated, so
      // this CustomEvent is the only signal they get (#1016).
      window.addEventListener('themechange', function(e) {
        if (e.detail && e.detail.theme) {
          currentTheme = e.detail.theme;
          applyTheme(currentTheme);
        }
      });

      // Fallback: watch for body element if it doesn't exist yet
      if (!document.body) {
        var observer = new MutationObserver(function(mutations) {
          if (document.body) {
            applyTheme(currentTheme);
            observer.disconnect();
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }

      // Listen for system theme changes
      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
          // Only apply system theme if the user has not chosen one. Reading
          // localStorage alone went blind for a declined visitor, so flipping
          // the OS theme overrode a choice they had explicitly made (#1016).
          if (!storedTheme()) {
            currentTheme = getSystemTheme();
            applyTheme(currentTheme);
          }
        });
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
