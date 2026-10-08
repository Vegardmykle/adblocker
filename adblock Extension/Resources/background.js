import { applySettings, loadSettings } from "./settings.js";

async function sync() {
    try {
        await applySettings(await loadSettings());
    } catch (error) {
        console.error("adblock: could not apply settings", error);
    }

    // Show the number of blocked requests on the toolbar icon where supported.
    try {
        await browser.declarativeNetRequest.setExtensionActionOptions?.({ displayActionCountAsBadgeText: true });
    } catch {}
}

browser.runtime.onInstalled.addListener(sync);
browser.runtime.onStartup.addListener(sync);
