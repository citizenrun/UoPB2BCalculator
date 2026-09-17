/**
 * Cookieless, no-op-by-default analytics.
 *
 * Set SITE below to your GoatCounter subdomain to switch it on. Until then this
 * file does nothing — no requests, no storage, no consent banner needed.
 *
 * What it may record: page views and named events (a button pressed, a tab
 * opened). What it must never record: anything the user typed. Salary, payslip
 * figures and licence keys stay in the browser. Keep it that way — the privacy
 * posture is a feature of this product, not an accident.
 *
 * GoatCounter is chosen because it stores no cookies and no personal data, so
 * it needs no consent prompt under GDPR/ePrivacy. Self-hosted Umami is an
 * equivalent swap: replace the endpoint in send().
 */
(function () {
  'use strict';

  var SITE = '';            // e.g. 'uopcalc' → https://uopcalc.goatcounter.com
  var DNT_RESPECT = true;   // honour Do Not Track / Global Privacy Control

  function disabled() {
    if (!SITE) return true;
    if (!DNT_RESPECT) return false;
    try {
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
      if (navigator.globalPrivacyControl === true) return true;
    } catch (e) { /* ignore */ }
    return false;
  }

  function send(params) {
    if (disabled()) return;
    var url = 'https://' + SITE + '.goatcounter.com/count'
      + '?p=' + encodeURIComponent(params.path)
      + '&t=' + encodeURIComponent(params.title || '')
      + (params.event ? '&e=1' : '')
      + '&r=' + encodeURIComponent(document.referrer || '');
    var img = new Image();
    img.src = url;
  }

  var Analytics = {
    /** A page view. Called once on load. */
    pageview: function () {
      send({ path: location.pathname, title: document.title });
    },
    /**
     * A named event. Pass a fixed, non-identifying name only — never a value
     * the user typed.
     * @param {string} name e.g. 'calc-uop', 'recon-locked-cta'
     */
    event: function (name) {
      if (typeof name !== 'string' || !/^[a-z0-9-]{1,40}$/.test(name)) return;
      send({ path: name, title: name, event: true });
    },
    enabled: function () { return !disabled(); }
  };

  if (typeof window !== 'undefined') {
    window.Analytics = Analytics;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', Analytics.pageview);
    } else {
      Analytics.pageview();
    }
  }
})();
