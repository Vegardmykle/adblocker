import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

function createBrowser() {
    const store = {};
    const enabledRulesets = new Set(["ads", "trackers"]);
    let dynamicRules = [];

    return {
        enabledRulesets,
        get dynamicRules() {
            return dynamicRules;
        },
        storage: {
            local: {
                async get(keys) {
                    return Object.fromEntries(keys.filter((key) => key in store).map((key) => [key, structuredClone(store[key])]));
                },
                async set(values) {
                    Object.assign(store, structuredClone(values));
                },
            },
        },
        declarativeNetRequest: {
            async updateEnabledRulesets({ enableRulesetIds = [], disableRulesetIds = [] }) {
                disableRulesetIds.forEach((id) => enabledRulesets.delete(id));
                enableRulesetIds.forEach((id) => enabledRulesets.add(id));
            },
            async getDynamicRules() {
                return structuredClone(dynamicRules);
            },
            async updateDynamicRules({ removeRuleIds = [], addRules = [] }) {
                const remaining = dynamicRules.filter((rule) => !removeRuleIds.includes(rule.id));
                for (const rule of addRules) {
                    assert.ok(!remaining.some((existing) => existing.id === rule.id), `duplicate rule id ${rule.id}`);
                }
                dynamicRules = [...remaining, ...structuredClone(addRules)];
            },
        },
    };
}

const settings = await import("../adblock Extension/Resources/settings.js");

beforeEach(() => {
    globalThis.browser = createBrowser();
});

test("normalizeHost lowercases and strips www. and trailing dots", () => {
    assert.equal(settings.normalizeHost("WWW.VG.no."), "vg.no");
    assert.equal(settings.normalizeHost("news.example.com"), "news.example.com");
    assert.equal(settings.normalizeHost(undefined), "");
});

test("isHostAllowlisted matches the site and its subdomains only", () => {
    const allowlist = ["vg.no"];
    assert.ok(settings.isHostAllowlisted("vg.no", allowlist));
    assert.ok(settings.isHostAllowlisted("www.vg.no", allowlist));
    assert.ok(settings.isHostAllowlisted("pluss.vg.no", allowlist));
    assert.ok(!settings.isHostAllowlisted("notvg.no", allowlist));
    assert.ok(!settings.isHostAllowlisted("vg.no.evil.com", allowlist));
});

test("defaults are used when nothing is stored", async () => {
    assert.deepEqual(await settings.loadSettings(), { enabled: true, blockTrackers: true, allowlist: [] });
});

test("turning blocking off disables every ruleset, and on restores them", async () => {
    await settings.saveSettings({ enabled: false });
    assert.deepEqual([...browser.enabledRulesets], []);

    await settings.saveSettings({ enabled: true });
    assert.deepEqual([...browser.enabledRulesets].sort(), ["ads", "trackers"]);
});

test("the tracker switch only affects the tracker ruleset", async () => {
    await settings.saveSettings({ blockTrackers: false });
    assert.deepEqual([...browser.enabledRulesets], ["ads"]);

    // Re-enabling blocking keeps trackers off.
    await settings.saveSettings({ enabled: false });
    await settings.saveSettings({ enabled: true });
    assert.deepEqual([...browser.enabledRulesets], ["ads"]);
});

test("pausing a site adds a high-priority allow rule for it", async () => {
    const result = await settings.setSiteAllowed("www.VG.no", true);
    assert.deepEqual(result.allowlist, ["vg.no"]);

    const [rule] = browser.dynamicRules;
    assert.equal(browser.dynamicRules.length, 1);
    assert.equal(rule.action.type, "allow");
    assert.ok(rule.priority > 1);
    assert.deepEqual(rule.condition.initiatorDomains, ["vg.no"]);
    assert.ok(rule.condition.resourceTypes.includes("script"));
});

test("pausing and resuming several sites keeps rules in sync without id clashes", async () => {
    await settings.setSiteAllowed("b.com", true);
    await settings.setSiteAllowed("a.com", true);
    await settings.setSiteAllowed("a.com", true);
    assert.deepEqual((await settings.loadSettings()).allowlist, ["a.com", "b.com"]);
    assert.deepEqual(browser.dynamicRules.map((rule) => rule.condition.initiatorDomains[0]), ["a.com", "b.com"]);

    await settings.setSiteAllowed("a.com", false);
    assert.deepEqual((await settings.loadSettings()).allowlist, ["b.com"]);
    assert.deepEqual(browser.dynamicRules.map((rule) => rule.condition.initiatorDomains[0]), ["b.com"]);
});

test("an empty host is ignored", async () => {
    await settings.setSiteAllowed("", true);
    assert.deepEqual((await settings.loadSettings()).allowlist, []);
    assert.deepEqual(browser.dynamicRules, []);
});
