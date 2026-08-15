/**
 * Recover a page whose stylesheets 404'd (#650).
 *
 * THE FAILURE THIS ENDS. GitHub Pages serves HTML with `cache-control: max-age=600`
 * and cannot be configured otherwise, while every deploy replaces content-hashed
 * CSS. A returning visitor can therefore hold HTML whose stylesheets no longer
 * exist: white page, no nav, the logo at its natural size, DOM perfectly correct.
 * Reported from live production eight times — #438, #467, #476, #548, #650, and
 * three more through 2026-08-15.
 *
 * `scripts/retain-previous-assets.mjs` carries old assets forward and is why this is
 * rare. It is now bounded in DAYS rather than deploys (#751), which fixes a real
 * mis-measurement but still leaves a bound — a visitor gone longer than the window
 * is outside it. This has no bound: it notices the page is unstyled and fetches the
 * current HTML, whatever the reason the assets went away.
 *
 * ONE RECOVERY PER HOUR, not per tab (#752). The original limit was per tab for the
 * life of the tab, which disarmed the visitors most exposed to the bug — a tab open
 * long enough for its assets to expire is one that has probably recovered before.
 *
 * WHY THE DETECTOR COUNTS RULES. Two earlier detectors were written and a browser
 * refuted both before either shipped:
 *
 *   1. Read a CSS custom property and recover if empty. `--color-base-100`, the
 *      obvious candidate, is NOT in the shipped CSS at all — dead on arrival, with
 *      nothing to notice.
 *   2. Compare `<link rel=stylesheet>` elements against `document.styleSheets` and
 *      treat absent ones as failed. Measured: a 404'd stylesheet IS present in
 *      `document.styleSheets`, with its href, and `cssRules.length === 0`.
 *
 * Both passed the healthy case and failed the broken one. Only a negative control
 * caught them. The real signal is an EMPTY rule list on a sheet that has an href.
 *
 * `document.styleSheets.length` alone is NOT usable: inline `<style>` and the
 * framework's own injected sheets inflate it, so it is never 0 even when every
 * external sheet is gone.
 *
 * DELIBERATELY CONSERVATIVE: it recovers only when EVERY same-origin sheet is empty
 * — the "no styles at all" page that was actually reported. One dead sheet among
 * several is rarer, is not obviously fixed by refetching, and a false reload is a
 * worse failure than a partially-styled page. Cross-origin sheets throw on
 * `cssRules`; those count as healthy because we cannot see them and they are not
 * ours to judge.
 *
 * Verified by `scripts/check-stale-html.mjs`, which runs in the required
 * `accessibility` check, reads the string below out of this file so the test cannot
 * drift from what ships, and is mutation-proven: disabling the guard fails it.
 */
const stylesheetGuard = `
(function () {
  try {
    // At most one recovery per HOUR per tab (#752). A reload loop is strictly
    // worse than an unstyled page — a visitor can at least read an unstyled page
    // — so a second attempt is refused while the first is still recent.
    //
    // This used to be once per TAB, forever, which stranded exactly the visitors
    // the guard exists for: holding a document for days is what makes its assets
    // expire, and a tab open for days is one that has likely recovered before.
    // Recovering on Monday must not disarm Friday.
    //
    // An hour separates the two cases cleanly. A genuine loop re-fires in
    // seconds and is still stopped after one attempt; no real deploy-and-return
    // cycle repeats inside an hour.
    var KEY = 'sh-stylesheet-recovered';
    var last = Number(sessionStorage.getItem(KEY) || 0);
    if (last && Date.now() - last < 3600000) return;

    // On 'load', deliberately: at DOMContentLoaded a stylesheet may still be in
    // flight and would read as missing, turning a slow network into a reload.
    window.addEventListener('load', function () {
      // A 404'd sheet is still listed, with its href, and zero rules. That empty
      // rule list is the signal — see the note above for two detectors that
      // looked right and could never fire.
      var external = 0;
      var empty = 0;
      for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        if (!sheet.href) continue; // inline <style>, not ours to judge
        external++;
        var rules = null;
        try {
          rules = sheet.cssRules;
        } catch (err) {
          continue; // cross-origin: unreadable, so assume healthy
        }
        if (!rules || rules.length === 0) empty++;
      }

      // Only when EVERY same-origin sheet is dead. See the note above.
      if (!external || empty < external) return;

      sessionStorage.setItem(KEY, String(Date.now()));

      // The service worker is network-first, so it is unlikely to be the cause,
      // but a stale entry would survive the navigation below.
      if (window.caches && caches.keys) {
        caches
          .keys()
          .then(function (names) {
            return Promise.all(
              names.map(function (n) {
                return caches.delete(n);
              })
            );
          })
          .catch(function () {});
      }

      // A NEW URL, not location.reload(). Reload can re-serve the same cached
      // document, which is precisely what is broken; a URL the cache has never
      // seen forces a fresh fetch. replace() keeps it out of history.
      var u = new URL(window.location.href);
      u.searchParams.set('_r', String(Date.now()));
      window.location.replace(u.toString());
    });
  } catch (e) {
    // Never let recovery logic break a page that merely lacks sessionStorage.
  }
})();
`;

/**
 * Inline script that recovers a page whose stylesheets were deleted by a deploy.
 *
 * @category subatomic
 */
export default function StylesheetGuard() {
  return <script dangerouslySetInnerHTML={{ __html: stylesheetGuard }} />;
}
