import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { buildRules, generate, parseFilterList, RULESETS } from "../scripts/build-rules.mjs";

const RESOURCES = new URL("../adblock Extension/Resources/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", RESOURCES), "utf8"));

test("plain domains become anchored url filters", () => {
    assert.deepEqual(parseFilterList("doubleclick.net\nads.example.co.uk"), ["||doubleclick.net^", "||ads.example.co.uk^"]);
});

test("lines starting with || are used verbatim", () => {
    assert.deepEqual(parseFilterList("||facebook.com/tr/"), ["||facebook.com/tr/"]);
});

test("comments, blank lines, case and duplicates are handled", () => {
    const text = "# comment\n\n  Example.COM  \nexample.com\n";
    assert.deepEqual(parseFilterList(text), ["||example.com^"]);
});

test("invalid entries are rejected with their line number", () => {
    assert.throws(() => parseFilterList("ok.com\nhttp://bad.com/ad", "list.txt"), /list\.txt:2: invalid entry/);
    assert.throws(() => parseFilterList("localhost"), /invalid entry/);
});

test("rules get sequential ids and never block top-level pages", () => {
    const rules = buildRules(["||a.com^", "||b.com^"]);
    assert.deepEqual(rules.map((rule) => rule.id), [1, 2]);
    for (const rule of rules) {
        assert.equal(rule.action.type, "block");
        assert.ok(!rule.condition.resourceTypes.includes("main_frame"));
    }
});

test("generated rulesets are up to date with filters/", () => {
    for (const { id, path, json } of generate()) {
        assert.equal(readFileSync(path, "utf8"), json, `rules_${id}.json is stale; run npm run build:rules`);
    }
});

test("manifest declares every ruleset and the files exist", () => {
    const resources = manifest.declarative_net_request.rule_resources;
    assert.deepEqual(resources.map((resource) => resource.id).sort(), Object.keys(RULESETS).sort());
    for (const resource of resources) {
        assert.ok(existsSync(new URL(resource.path, RESOURCES)), `${resource.path} is missing`);
        const rules = JSON.parse(readFileSync(new URL(resource.path, RESOURCES), "utf8"));
        assert.ok(rules.length > 0);
        assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length, "rule ids must be unique");
    }
});

test("manifest only references files that exist", () => {
    const files = [
        manifest.background.scripts,
        manifest.content_scripts.flatMap((script) => script.js),
        manifest.action.default_popup,
        manifest.action.default_icon,
        Object.values(manifest.icons),
    ].flat();
    for (const file of files) {
        assert.ok(existsSync(new URL(file, RESOURCES)), `${file} is missing`);
    }
});

test("every locale has the same messages and covers the popup", () => {
    const load = (locale) => JSON.parse(readFileSync(new URL(`_locales/${locale}/messages.json`, RESOURCES), "utf8"));
    const en = load("en");
    const nb = load("nb");
    assert.deepEqual(Object.keys(nb).sort(), Object.keys(en).sort());

    const popup = readFileSync(new URL("popup.html", RESOURCES), "utf8") + readFileSync(new URL("popup.js", RESOURCES), "utf8");
    const used = [...popup.matchAll(/data-i18n(?:-label)?="(\w+)"|t\("(\w+)"\)/g)].map((match) => match[1] || match[2]);
    assert.ok(used.length > 0);
    for (const key of used) {
        assert.ok(key in en, `missing message "${key}"`);
    }
});
