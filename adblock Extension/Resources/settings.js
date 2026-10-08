// Shared settings logic for background.js and popup.js.
//
// Settings live in browser.storage.local so content scripts can read them too.
// applySettings() turns them into declarativeNetRequest state: which static
// rulesets are enabled, plus one dynamic "allow" rule per paused site.

export const RULESET_ADS = "ads";
export const RULESET_TRACKERS = "trackers";

export const DEFAULT_SETTINGS = {
    enabled: true,
    blockTrackers: true,
    allowlist: [],
};

// Above the priority of the static block rules.
const ALLOW_RULE_PRIORITY = 100;

const ALLOW_RULE_RESOURCE_TYPES = [
    "main_frame",
    "sub_frame",
    "script",
    "stylesheet",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "media",
    "websocket",
    "other",
];

export function normalizeHost(host) {
    return String(host || "").trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

// Keep in sync with isAllowlisted() in content.js.
export function isHostAllowlisted(host, allowlist) {
    const normalized = normalizeHost(host);
    return allowlist.some((entry) => normalized === entry || normalized.endsWith(`.${entry}`));
}

export async function loadSettings() {
    const stored = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));
    return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(changes) {
    await browser.storage.local.set(changes);
    const settings = await loadSettings();
    await applySettings(settings);
    return settings;
}

export async function setSiteAllowed(host, allowed) {
    const normalized = normalizeHost(host);
    if (!normalized) {
        return loadSettings();
    }

    const { allowlist } = await loadSettings();
    const next = allowlist.filter((entry) => entry !== normalized);
    if (allowed) {
        next.push(normalized);
        next.sort();
    }

    return saveSettings({ allowlist: next });
}

export function buildAllowRules(allowlist) {
    return allowlist.map((host, index) => ({
        id: index + 1,
        priority: ALLOW_RULE_PRIORITY,
        action: { type: "allow" },
        condition: {
            initiatorDomains: [host],
            resourceTypes: ALLOW_RULE_RESOURCE_TYPES,
        },
    }));
}

export async function applySettings(settings) {
    const dnr = browser.declarativeNetRequest;

    const wanted = new Set();
    if (settings.enabled) {
        wanted.add(RULESET_ADS);
        if (settings.blockTrackers) {
            wanted.add(RULESET_TRACKERS);
        }
    }

    const all = [RULESET_ADS, RULESET_TRACKERS];
    await dnr.updateEnabledRulesets({
        enableRulesetIds: all.filter((id) => wanted.has(id)),
        disableRulesetIds: all.filter((id) => !wanted.has(id)),
    });

    const existing = await dnr.getDynamicRules();
    await dnr.updateDynamicRules({
        removeRuleIds: existing.map((rule) => rule.id),
        addRules: buildAllowRules(settings.allowlist),
    });
}
