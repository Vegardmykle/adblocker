function show(enabled, useSettingsInsteadOfPreferences) {
    if (!useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('state-on')[0].innerText = "Adblock er slått på. Du kan slå den av i Safari-valgene under Utvidelser.";
        document.getElementsByClassName('state-off')[0].innerText = "Adblock er slått av. Slå den på i Safari-valgene under Utvidelser, og gi den tilgang til «Alle nettsteder» for å skjule reklamefelt.";
        document.getElementsByClassName('state-unknown')[0].innerText = "Du kan slå på Adblock i Safari-valgene under Utvidelser.";
        document.getElementsByClassName('open-preferences')[0].innerText = "Avslutt og åpne Safari-valg …";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
