// Hides ad containers with a stylesheet built from COSMETIC_SELECTORS
// (cosmetic-filters.js), unless blocking is off or the site is paused.

(() => {
    const STYLE_ID = "adblock-cosmetic-filters";
    const host = location.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");

    // Keep in sync with isHostAllowlisted() in settings.js.
    function isAllowlisted(allowlist) {
        return allowlist.some((entry) => host === entry || host.endsWith(`.${entry}`));
    }

    function isActive(settings) {
        return settings.enabled !== false && !isAllowlisted(settings.allowlist || []);
    }

    // One rule per selector, so a selector the browser does not understand
    // only drops itself instead of the whole rule.
    const css = COSMETIC_SELECTORS.map((selector) => `${selector} { display: none !important; }`).join("\n");

    function setActive(active) {
        const existing = document.getElementById(STYLE_ID);
        if (active && !existing) {
            const style = document.createElement("style");
            style.id = STYLE_ID;
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
        } else if (!active && existing) {
            existing.remove();
        }
    }

    function countHidden() {
        if (!document.getElementById(STYLE_ID)) {
            return 0;
        }

        const hidden = new Set();
        for (const selector of COSMETIC_SELECTORS) {
            try {
                document.querySelectorAll(selector).forEach((element) => hidden.add(element));
            } catch {
                // Unsupported selector; it is not hiding anything either.
            }
        }
        return hidden.size;
    }

    let settings = { enabled: true, allowlist: [] };

    // Hide optimistically before storage answers to avoid a flash of ads,
    // then correct once the real settings are known.
    setActive(true);
    browser.storage.local.get(["enabled", "allowlist"]).then((stored) => {
        settings = { ...settings, ...stored };
        setActive(isActive(settings));
    });

    browser.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") {
            return;
        }
        for (const [key, { newValue }] of Object.entries(changes)) {
            settings[key] = newValue;
        }
        setActive(isActive(settings));
    });

    // Only the top frame answers the popup, so it gets one answer per tab.
    if (window === window.top) {
        browser.runtime.onMessage.addListener((request) => {
            if (request && request.type === "getPageInfo") {
                return Promise.resolve({ host, hiddenCount: countHidden() });
            }
        });
    }
})();
