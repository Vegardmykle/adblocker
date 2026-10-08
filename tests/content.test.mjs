import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const RESOURCES = new URL("../adblock Extension/Resources/", import.meta.url);
const filtersSource = readFileSync(new URL("cosmetic-filters.js", RESOURCES), "utf8");
const contentSource = readFileSync(new URL("content.js", RESOURCES), "utf8");

// Just enough DOM and extension API for content.js.
function load({ hostname = "www.example.com", stored = {}, matches = {} } = {}) {
    const elements = new Map();
    const storageListeners = [];
    const messageListeners = [];

    const documentElement = {
        appendChild(element) {
            elements.set(element.id, element);
            element.remove = () => elements.delete(element.id);
        },
    };

    const window = {};
    window.top = window;

    const context = vm.createContext({
        window,
        location: { hostname },
        document: {
            head: null,
            documentElement,
            getElementById: (id) => elements.get(id) || null,
            createElement: () => ({ id: "", textContent: "" }),
            querySelectorAll: (selector) => matches[selector] || [],
        },
        browser: {
            storage: {
                local: { get: async () => stored },
                onChanged: { addListener: (listener) => storageListeners.push(listener) },
            },
            runtime: {
                onMessage: { addListener: (listener) => messageListeners.push(listener) },
            },
        },
    });

    vm.runInContext(filtersSource, context);
    vm.runInContext(contentSource, context);

    return {
        style: () => elements.get("adblock-cosmetic-filters") || null,
        selectors: vm.runInContext("COSMETIC_SELECTORS", context),
        changeStorage: (changes) => storageListeners.forEach((listener) => listener(changes, "local")),
        send: (message) => messageListeners[0](message),
    };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("selectors are simple, unique and safe to drop into a CSS rule", () => {
    const { selectors } = load();
    assert.ok(selectors.length > 0);
    assert.equal(new Set(selectors).size, selectors.length, "duplicate selector");
    for (const selector of selectors) {
        assert.match(selector, /^[^{},;]+$/, `selector "${selector}" contains a forbidden character`);
    }
});

test("hides ads with one display:none rule per selector", async () => {
    const page = load();
    await settle();
    const css = page.style().textContent;
    assert.equal(css.split("\n").length, page.selectors.length);
    assert.match(css, /^ins\.adsbygoogle \{ display: none !important; \}/);
});

test("does nothing when blocking is off", async () => {
    const page = load({ stored: { enabled: false } });
    await settle();
    assert.equal(page.style(), null);
});

test("does nothing on a paused site or its subdomains", async () => {
    const page = load({ hostname: "pluss.vg.no", stored: { allowlist: ["vg.no"] } });
    await settle();
    assert.equal(page.style(), null);
});

test("still hides ads on a site whose name merely ends like a paused one", async () => {
    const page = load({ hostname: "notvg.no", stored: { allowlist: ["vg.no"] } });
    await settle();
    assert.notEqual(page.style(), null);
});

test("reacts to settings changes without a reload", async () => {
    const page = load({ hostname: "vg.no" });
    await settle();
    assert.notEqual(page.style(), null);

    page.changeStorage({ allowlist: { newValue: ["vg.no"] } });
    assert.equal(page.style(), null);

    page.changeStorage({ allowlist: { newValue: [] } });
    assert.notEqual(page.style(), null);

    page.changeStorage({ enabled: { newValue: false } });
    assert.equal(page.style(), null);
});

test("reports the host and counts each hidden element once", async () => {
    const ad = {};
    const other = {};
    const page = load({ matches: { "ins.adsbygoogle": [ad], ".adsbygoogle": [ad, other] } });
    await settle();
    assert.deepEqual({ ...(await page.send({ type: "getPageInfo" })) }, { host: "example.com", hiddenCount: 2 });
});

test("reports zero hidden elements when not active", async () => {
    const page = load({ stored: { enabled: false }, matches: { ".adsbygoogle": [{}] } });
    await settle();
    assert.equal((await page.send({ type: "getPageInfo" })).hiddenCount, 0);
});
