# Adblock for Safari

En Safari-utvidelse som fjerner reklame på nettsider:

- **Blokkerer forespørsler** til kjente reklame- og sporingsservere med `declarativeNetRequest`
  (regelsett i `filters/ads.txt` og `filters/trackers.txt`).
- **Skjuler reklamefelt** (tomme bokser, AdSense, Taboola/Outbrain osv.) med CSS fra
  `adblock Extension/Resources/cosmetic-filters.js`.
- **Popup** i verktøylinjen: slå blokkering av/på, pause på nettstedet du er på, slå
  sporingsblokkering av/på, og se hvor mye som er blokkert/skjult på siden.

## Kom i gang

1. Åpne `adblock.xcodeproj` i Xcode og trykk **Run** (⌘R). Appen starter og viser et vindu.
2. I Safari: **Innstillinger → Utvidelser**, huk av for **Adblock**.
   - Kjører du en usignert utviklerbygg, må du først slå på
     **Innstillinger → Avansert → Vis funksjoner for nettutviklere**, og deretter
     **Utvikle → Tillat usignerte utvidelser**.
3. Gi utvidelsen tilgang til **Alle nettsteder**. Nettverksblokkeringen virker uten dette,
   men skjuling av reklamefelt og tellerne i popupen trenger tilgang til sidene.

## Legge til eller fjerne domener

Rediger `filters/ads.txt` eller `filters/trackers.txt` (ett domene per linje, underdomener
blokkeres også), og bygg regelsettene på nytt:

```sh
npm run build:rules
```

De genererte filene `rules_ads.json` og `rules_trackers.json` sjekkes inn, så Xcode trenger
ikke Node for å bygge.

## Tester

```sh
npm test
```

Testene sjekker regelgenereringen, at de genererte reglene er oppdatert, manifestet,
oversettelsene, innstillingslogikken og innholdsskriptet.

## Struktur

| Fil | Hva den gjør |
| --- | --- |
| `adblock Extension/Resources/manifest.json` | Manifest (MV3) med regelsett, innholdsskript og popup |
| `adblock Extension/Resources/settings.js` | Lagrer innstillinger og oversetter dem til aktive regelsett og «tillat»-regler for pausede nettsteder |
| `adblock Extension/Resources/background.js` | Bruker innstillingene ved installasjon og oppstart |
| `adblock Extension/Resources/content.js` | Legger inn CSS som skjuler reklamefelt |
| `adblock Extension/Resources/popup.*` | Popupen i verktøylinjen |
| `scripts/build-rules.mjs` | Genererer regelsettene fra `filters/` |
