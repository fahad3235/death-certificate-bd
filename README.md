# Death Certificate BD

Free, fully offline, bilingual (English / বাংলা) guide to registering a death in Bangladesh — with a fee calculator, a documents checklist, and an application helper that builds a printable summary and cover letter to take to the registrar.

![Status](https://img.shields.io/badge/status-live-brightgreen)
![Offline](https://img.shields.io/badge/offline-yes-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## The problem

When a family member dies, a death certificate is needed sooner than most families expect — for the warish (heirship) certificate, bank accounts and savings certificates, pension and gratuity, insurance claims, land mutation, and closing a mobile number or a trade licence. But the process is scattered across offices and websites, the fee depends on how late you register, and the paperwork list depends on the case. This tool puts the whole process in one place, in English and Bangla, with nothing sent anywhere.

## Features

- **Step-by-step guide** — who can apply (father, mother, spouse, son, daughter), where to register (online at `bdris.gov.bd/dr/application`, or in person at the Union Parishad / Pourashava / City Corporation / Cantonment Board), and the 7 steps from documents to collection.
- **Fee calculator** — enter the date of death; the app works out the days since death and the fee band: free within 45 days, ৳25 from 45 days to 5 years, ৳50 after 5 years.
- **Documents checklist** — 8 items with per-item guidance and a persisted progress percentage.
- **Application helper** — one form for the deceased, the death details, the informant and the registrar's office. Validates 17-digit birth registration numbers, 10/13/17-digit NIDs, Bangladeshi mobile numbers and date logic (death not in the future, birth before death, burial not before death), then generates a printable summary table and cover letter. The draft is saved automatically.
- **FAQ** — online application, deadlines, deaths abroad, missing birth certificate, corrections.
- **Data** — JSON export / strict import, typed-`DELETE` erase-all, and clearly labelled demo data (never auto-loaded).
- **Bilingual** — full English / বাংলা toggle, persisted, with Bengali digits. Works at desktop and 390px mobile widths, with print CSS that prints only the summary and letter.

## Stack

- Plain HTML + CSS + JavaScript — no framework, no build step, no dependencies.
- `localStorage` for persistence. Zero network requests.

## Prerequisites

Any modern browser. For the tests: Node.js 18+ and the Playwright-cached `headless_shell` (used by the smoke test).

## Install & run

```bash
# Clone, then just open the file — there is no build step.
open index.html
# or serve it locally, e.g.:
npx serve .
```

## Development commands

```bash
node tests/test.js        # 48 unit tests (fee bands, validation, dates, digits)
node tests/smoke.mjs 1280 # 47 headless-Chrome smoke checks at desktop width
node tests/smoke.mjs 390  # 47 headless-Chrome smoke checks at mobile width
```

## Environment

No environment variables, no API keys, no backend. Everything runs in the browser.

## Testing

- **48/48 node unit tests pass** (`tests/test.js`): fee-band boundaries (45 / 46 / 1825 / 1826 days), BRN / NID / mobile validation, Bengali digit conversion, fee-date and full-form validation including date-order rules.
- **47/47 headless-Chrome smoke checks pass at 1280px and at 390px** (`tests/smoke.mjs`, raw CDP, `headless_shell-1187`): tab switching, fee calculator hand-checked at 10 days (free), 100 days (৳25) and 6 years (৳50), future-date rejection, checklist 1 of 8 = 13%, form validation (bad informant NID blocks generation), letter generation (Registrar address, subject, informant signature), EN/বাংলা toggle + persistence, reload persistence, XSS safety (markup in a name is rendered as text), export → erase (wrong text, then `DELETE`) → import round-trip, labelled demo data (4 of 8 documents = 50%), no horizontal overflow, 0 console/page errors, 0 failed network requests.
- One test-side fix during the run: a case-sensitive assertion on the import message (`imported` vs `Imported`). No app-logic bugs found.

## Deployment

GitHub Pages (main branch, root). Open `index.html` — the site is a static single-page app.

## Facts & sources (checked November 2026)

- Registration runs through **BDRIS** (Birth and Death Registration Information System) at `bdris.gov.bd/dr/application`, under the **Births and Deaths Registration Act, 2004**.
- Fee bands commonly cited in Bangladeshi guides: **free within 45 days; ৳25 from 45 days to 5 years; ৳50 after 5 years** (with a written explanation for the delay after 5 years).
- **Fee discrepancy, stated openly:** the US State Department reciprocity schedule for Bangladesh lists different figures (৳100 / ৳200 / ৳500). The app and this README tell the user to confirm the current fee at the local registrar's office before paying — the calculator is a guide, not an official fee schedule.

## Limitations

- This is a personal planning helper, **not an official government service and not legal advice**. Rules and fees change; confirm them at `bdris.gov.bd` or your local registrar's office before acting.
- The fee calculator uses the commonly cited bands (see above); the office's own figure governs.
- Nothing is submitted online by this tool — the generated letter must be taken to the registrar with the original documents.
- Data lives only in the browser's `localStorage`; clearing browser data loses it unless exported first.

## Status

Live. Ships empty (no preset personal data); demo data is available only through a labelled button.
