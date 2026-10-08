#!/usr/bin/env node
// Converts the domain lists in filters/*.txt into declarativeNetRequest
// rulesets that Safari loads from the extension bundle.
//
// Usage: node scripts/build-rules.mjs [--check]
//   --check  Exit with an error if the generated files are out of date.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RESOURCES = join(ROOT, "adblock Extension", "Resources");

// Ruleset id (must match manifest.json) -> source list.
export const RULESETS = {
    ads: "filters/ads.txt",
    trackers: "filters/trackers.txt",
};

// Everything except main_frame, so visiting a blocked domain directly still works.
export const RESOURCE_TYPES = [
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

const DOMAIN_PATTERN = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

export function parseFilterList(text, source = "filter list") {
    const filters = [];
    const seen = new Set();

    text.split("\n").forEach((rawLine, index) => {
        const line = rawLine.trim().toLowerCase();
        if (line === "" || line.startsWith("#")) {
            return;
        }

        let urlFilter;
        if (line.startsWith("||")) {
            urlFilter = line;
        } else if (DOMAIN_PATTERN.test(line)) {
            urlFilter = `||${line}^`;
        } else {
            throw new Error(`${source}:${index + 1}: invalid entry "${rawLine.trim()}"`);
        }

        if (!seen.has(urlFilter)) {
            seen.add(urlFilter);
            filters.push(urlFilter);
        }
    });

    return filters;
}

export function buildRules(urlFilters) {
    return urlFilters.map((urlFilter, index) => ({
        id: index + 1,
        priority: 1,
        action: { type: "block" },
        condition: {
            urlFilter,
            resourceTypes: RESOURCE_TYPES,
        },
    }));
}

export function rulesetPath(id) {
    return join(RESOURCES, `rules_${id}.json`);
}

export function generate() {
    return Object.entries(RULESETS).map(([id, source]) => {
        const text = readFileSync(join(ROOT, source), "utf8");
        const rules = buildRules(parseFilterList(text, source));
        return { id, path: rulesetPath(id), json: JSON.stringify(rules, null, 2) + "\n", count: rules.length };
    });
}

function main() {
    const check = process.argv.includes("--check");
    let stale = false;

    for (const { id, path, json, count } of generate()) {
        if (check) {
            let current = "";
            try {
                current = readFileSync(path, "utf8");
            } catch {}
            if (current !== json) {
                console.error(`rules_${id}.json is out of date. Run \`npm run build:rules\`.`);
                stale = true;
            }
        } else {
            writeFileSync(path, json);
            console.log(`rules_${id}.json: ${count} rules`);
        }
    }

    if (stale) {
        process.exit(1);
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
