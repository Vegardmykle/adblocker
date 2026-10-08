// CSS selectors for ad containers that content.js hides.
//
// Requests to ad servers are already blocked by the declarativeNetRequest
// rulesets; these selectors remove the empty boxes and the ad slots that are
// served first-party. Keep them specific: a broad selector like [class*="ad"]
// hides real content on many sites.

const COSMETIC_SELECTORS = [
    // Google AdSense / Ad Manager
    "ins.adsbygoogle",
    ".adsbygoogle",
    "[id^='div-gpt-ad']",
    "[id^='google_ads_iframe']",
    "[id^='google_ads_frame']",
    "[data-google-query-id]",
    "iframe[src*='doubleclick.net']",
    "iframe[src*='googlesyndication.com']",
    "iframe[name^='google_ads_iframe']",

    // AMP ads
    "amp-ad",
    "amp-embed[type='taboola']",
    "amp-embed[type='outbrain']",
    "amp-sticky-ad",

    // Content recommendation widgets
    "[id^='taboola-']",
    ".trc_related_container",
    ".OUTBRAIN",

    // Other ad networks
    "iframe[src*='adnxs.com']",
    "iframe[src*='amazon-adsystem.com']",
    "iframe[src*='adform.net']",
    "iframe[src*='criteo.com']",

    // Common, unambiguous ad container names
    ".ad-banner",
    ".ad-container",
    ".ad-slot",
    ".ad-wrapper",
    ".ad-unit",
    ".banner-ad",
    ".advertisement",
    ".sponsored-ad",
    "[id^='ad-slot-']",
    "[data-ad-slot]",
    "[data-ad-unit]",
    "[data-adunit]",
    "[aria-label='Advertisement']",
    "[aria-label='Annonse']",
    "[aria-label='Reklame']",
];
