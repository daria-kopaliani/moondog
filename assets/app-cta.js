/* Moon Dog — report App Store clicks to GoatCounter.
 *
 * WHY (2026-09-09): 219 pages on this site carried an App Store link and not one
 * of them was measured — no click event, no campaign token. The affiliate sites
 * had the same blind spot and closing it is what made that channel legible
 * (dupenotedp-20 vs dupenote-20 is only readable because the click is counted).
 *
 * Fires an event named  out/app/<appleId><page path>  so a click is attributable
 * to the exact page that produced it, the same shape as the aff-* click events.
 *
 * Progressive enhancement only: the link works with this file absent or blocked.
 */
(function () {
  function track(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href*="apps.apple.com"]') : null;
    if (!a) return;
    if (!window.goatcounter || typeof window.goatcounter.count !== 'function') return;
    var m = a.href.match(/id(\d+)/);
    try {
      window.goatcounter.count({
        path: 'out/app/' + (m ? m[1] : 'unknown') + window.location.pathname,
        title: 'App Store click',
        event: true
      });
    } catch (err) { /* never let counting break the link */ }
  }
  document.addEventListener('click', track, true);
  document.addEventListener('auxclick', track, true);
})();
