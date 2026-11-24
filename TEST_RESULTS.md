# TEST RESULTS — death-certificate-bd

Date: 2026-11-24 (slot 15:00 Asia/Dhaka). Run by the factory worker.

## Unit tests — 48/48 pass

Command: `node tests/test.js`

- daysBetween: same day 0, 10 days ago, future date negative, leap-year span, year boundary.
- Fee bands: 0 days free; 45 days free (boundary); 46 days late ৳25 (boundary);
  100 days late ৳25; 1825 days late ৳25 (5-year boundary); 1826 days very late ৳50;
  2190 days very late ৳50.
- BRN: 17 digits valid; 16 digits, letters, empty invalid.
- NID: 10 / 13 / 17 digits valid; 11 digits, letters invalid.
- Mobile: 017 / 019 valid; 10 digits, 012 / 011 prefixes, letters invalid.
- Bengali digits: 0–9 conversion, mixed text; formatNumber EN/BN grouping; formatTaka EN/BN.
- Fee-date validation: empty required, future rejected, past ok.
- Full-form validation: valid data passes; empty data lists all 13 required errors;
  bad informant NID, bad mobile, future death date, bad BRN, bad deceased NID rejected;
  optional BRN/NID may be blank; DOB after death, DOB in future, burial before death
  rejected; burial after death ok.

## Headless-Chrome smoke — 47/47 pass at 1280x800 and 47/47 at 390x844

Command: `node tests/smoke.mjs 1280` and `node tests/smoke.mjs 390`
(Raw CDP, Playwright-cached headless_shell-1187, file:// URL with ?asof=2026-11-24.)

- Page title and heading render; guide panel visible, fee panel hidden at start;
  checklist starts at 0% with 8 items; 0 console/page errors and 0 failed requests on load.
- Fee calculator: empty date shows error; future date shows error; 10 days ago → 10 days,
  fee Free; 100 days ago → 100 days, fee ৳25; 6 years ago → fee ৳50.
- Checklist: 1 of 8 ticked → 13% and count "1 / 8".
- Application: empty form shows error and letter stays hidden; bad informant NID
  (98765) blocks generation; valid form generates the letter — summary names the
  deceased (Abdul Karim), shows the office (Dhaka South City Corporation) and the
  Free fee band; letter addresses "The Registrar", carries the subject line, and
  signs with the informant (Karim Uddin).
- Bangla toggle: html lang switches to bn, language persisted in localStorage,
  back to English.
- Persistence across reload: form draft (Abdul Karim) and checklist (13%) survive.
- XSS safety: `<b>hi</b>` entered as a name is rendered as text — no `<b>` element
  created in the summary.
- Data: export captures JSON with the name and office; erase with wrong text shows
  an error and data stays intact; erase with DELETE clears the form and checklist;
  import restores the name and 13% checklist; import success message shown.
- Demo data (labelled, never auto-loaded): fills the name and checks 4 of 8
  documents (50%).
- No horizontal overflow at either viewport; 0 console errors and 0 failed requests
  across the whole run.
- Screenshots: tests/smoke-1280.png, tests/smoke-390.png (both visually verified —
  Data tab end-state renders cleanly, Bengali toggle button renders).

## Repairs during testing

- 1 test-side fix: the import-success assertion checked for lowercase 'imported'
  while the app message reads 'Imported successfully.' — assertion corrected to
  'Imported'. No app-logic bugs found; 0 app repairs.
