import { isHostAllowlisted, loadSettings, normalizeHost, saveSettings, setSiteAllowed } from "./settings.js";

const $ = (id) => document.getElementById(id);
const t = (key) => browser.i18n.getMessage(key);

let tab = null;
let host = "";

function localize() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
        element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-label]").forEach((element) => {
        element.setAttribute("aria-label", t(element.dataset.i18nLabel));
    });
}

async function getPageInfo() {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    tab = activeTab || null;
    if (!tab) {
        return { host: "", hiddenCount: 0 };
    }

    // The content script knows the host even when the extension has no
    // permission to read tab.url, and it is the one hiding elements.
    try {
        const info = await browser.tabs.sendMessage(tab.id, { type: "getPageInfo" });
        if (info) {
            return info;
        }
    } catch {}

    try {
        const url = new URL(tab.url);
        if (url.protocol === "http:" || url.protocol === "https:") {
            return { host: normalizeHost(url.hostname), hiddenCount: 0 };
        }
    } catch {}

    return { host: "", hiddenCount: 0 };
}

async function getBlockedCount() {
    const dnr = browser.declarativeNetRequest;
    if (!tab || typeof dnr.getMatchedRules !== "function") {
        return null;
    }

    try {
        const { rulesMatchedInfo } = await dnr.getMatchedRules({ tabId: tab.id });
        return rulesMatchedInfo.length;
    } catch {
        return null;
    }
}

function render(settings, { hiddenCount, blockedCount }) {
    const paused = Boolean(host) && isHostAllowlisted(host, settings.allowlist);

    document.body.classList.toggle("off", !settings.enabled);
    document.body.classList.toggle("paused", settings.enabled && paused);
    document.body.classList.toggle("no-site", !host);

    $("enabled").checked = settings.enabled;
    $("enabled").disabled = false;
    $("block-trackers").checked = settings.blockTrackers;
    $("block-trackers").disabled = !settings.enabled;

    $("status").textContent = !settings.enabled ? t("popup_disabled") : paused ? t("popup_paused") : t("popup_enabled");
    $("host").textContent = host || t("popup_no_site");

    $("hidden-count").textContent = hiddenCount;
    $("blocked-stat").hidden = blockedCount === null;
    $("blocked-count").textContent = blockedCount ?? 0;

    const siteToggle = $("site-toggle");
    siteToggle.textContent = paused ? t("popup_resume_site") : t("popup_pause_site");
    siteToggle.disabled = !settings.enabled;
    siteToggle.dataset.paused = String(paused);
}

async function refresh() {
    const [settings, info, blockedCount] = await Promise.all([loadSettings(), getPageInfo(), getBlockedCount()]);
    // Right after a reload the content script may not answer yet; keep the known host.
    host = normalizeHost(info.host) || host;
    render(settings, { hiddenCount: info.hiddenCount, blockedCount });
}

// Network rules only apply to new requests, so reload the page to show the result.
async function applyAndReload(change) {
    document.querySelectorAll("input, button").forEach((element) => (element.disabled = true));
    try {
        await change();
        if (tab && host) {
            await browser.tabs.reload(tab.id);
        }
    } finally {
        await refresh();
    }
}

$("enabled").addEventListener("change", (event) => {
    applyAndReload(() => saveSettings({ enabled: event.target.checked }));
});

$("block-trackers").addEventListener("change", (event) => {
    applyAndReload(() => saveSettings({ blockTrackers: event.target.checked }));
});

$("site-toggle").addEventListener("click", (event) => {
    const paused = event.currentTarget.dataset.paused === "true";
    applyAndReload(() => setSiteAllowed(host, !paused));
});

localize();
refresh().finally(() => document.body.classList.remove("loading"));
