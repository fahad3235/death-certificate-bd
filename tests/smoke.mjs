// Headless-Chrome smoke test for Death Certificate BD.
// Drives the Playwright-cached headless_shell over CDP with Node's built-in
// WebSocket (no npm deps). Run from the project root:
//   node tests/smoke.mjs [1280|390]
// Exits 0 only if every check passes.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const PORT = 9232;
const WIDTH = parseInt(process.argv[2] || '1280', 10);
const HEIGHT = WIDTH <= 480 ? 844 : 800;
const URL = 'file://' + path.join(ROOT, 'index.html') + '?asof=2026-11-24';

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 15000, label = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await fn()) return true; } catch { /* retry */ }
    await sleep(150);
  }
  throw new Error('timeout waiting for ' + label);
}

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=' + PORT,
  '--window-size=' + WIDTH + ',' + HEIGHT,
  'about:blank',
], { stdio: 'ignore' });

let ws;
try {
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      targets = await res.json();
      break;
    } catch { await sleep(250); }
  }
  if (!targets) throw new Error('DevTools endpoint never came up');

  const pageTarget = targets.find((t) => t.type === 'page');
  ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  const failedReqs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
    }
    if (msg.method === 'Network.loadingFailed') {
      failedReqs.push(msg.params.errorText);
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('page JS error: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH <= 480 });
  await send('Page.navigate', { url: URL });
  await waitFor(async () => (await evalJs('document.readyState')) === 'complete', 15000, 'page load');
  await sleep(500);

  const isoDaysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const isoTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const setVal = async (id, v) => {
    await evalJs(`document.getElementById(${JSON.stringify(id)}).value = ${JSON.stringify(v)}`);
  };

  console.log(`smoke @ ${WIDTH}x${HEIGHT}: ${URL}`);
  check('page title', (await evalJs('document.title')).includes('Death Certificate BD'));
  check('app heading rendered', (await evalJs('document.getElementById("appTitle").textContent')).includes('Death Certificate BD'));
  check('guide panel visible at start', (await evalJs('document.getElementById("tab-guide").hidden')) === false);
  check('fee panel hidden at start', (await evalJs('document.getElementById("tab-fee").hidden')) === true);
  check('docs start at 0%', (await evalJs('document.getElementById("docsPct").textContent')) === '0%');
  check('8 checklist items rendered', (await evalJs('document.querySelectorAll("#docsList li").length')) === 8);
  check('no console errors on load', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('no failed requests on load', failedReqs.length === 0, failedReqs.join(' | '));

  // --- Fee calculator ---
  await evalJs('document.querySelector(\'[data-tab="fee"]\').click()');
  await sleep(200);
  check('fee panel visible after tab click', (await evalJs('document.getElementById("tab-fee").hidden')) === false);
  await evalJs('document.getElementById("feeBtn").click()');
  await sleep(200);
  check('empty death date shows error', (await evalJs('document.getElementById("feeError").hidden')) === false);
  await setVal('deathDateInput', isoTomorrow());
  await evalJs('document.getElementById("feeBtn").click()');
  await sleep(200);
  check('future death date shows error', (await evalJs('document.getElementById("feeError").hidden')) === false);
  await setVal('deathDateInput', isoDaysAgo(10));
  await evalJs('document.getElementById("feeBtn").click()');
  await sleep(300);
  check('10 days ago: 10 days shown', (await evalJs('document.getElementById("feeDaysOut").textContent')) === '10',
    await evalJs('document.getElementById("feeDaysOut").textContent'));
  check('10 days ago: fee is Free', (await evalJs('document.getElementById("feeAmountOut").textContent')).includes('Free'),
    await evalJs('document.getElementById("feeAmountOut").textContent'));
  await setVal('deathDateInput', isoDaysAgo(100));
  await evalJs('document.getElementById("feeBtn").click()');
  await sleep(300);
  check('100 days ago: 100 days shown', (await evalJs('document.getElementById("feeDaysOut").textContent')) === '100');
  check('100 days ago: fee is ৳25', (await evalJs('document.getElementById("feeAmountOut").textContent')).includes('25'),
    await evalJs('document.getElementById("feeAmountOut").textContent'));
  await setVal('deathDateInput', isoDaysAgo(2190));
  await evalJs('document.getElementById("feeBtn").click()');
  await sleep(300);
  check('6 years ago: fee is ৳50', (await evalJs('document.getElementById("feeAmountOut").textContent')).includes('50'),
    await evalJs('document.getElementById("feeAmountOut").textContent'));

  // --- Checklist: 1 of 8 = 13% ---
  await evalJs('document.querySelector(\'[data-tab="checklist"]\').click()');
  await sleep(200);
  await evalJs('document.querySelector("#docsList li input[type=checkbox]").click()');
  await sleep(300);
  check('checklist 1 of 8 = 13%', (await evalJs('document.getElementById("docsPct").textContent')) === '13%',
    await evalJs('document.getElementById("docsPct").textContent'));
  check('checklist count shows 1 / 8', (await evalJs('document.getElementById("docsCount").textContent')) === '1 / 8');

  // --- Application: validation then valid generation ---
  await evalJs('document.querySelector(\'[data-tab="apply"]\').click()');
  await sleep(200);
  await evalJs('document.getElementById("genBtn").click()');
  await sleep(300);
  check('empty form shows error', (await evalJs('document.getElementById("applyError").hidden')) === false);
  check('letter stays hidden on invalid form', (await evalJs('document.getElementById("letterBox").hidden')) === true);

  const fill = async (id, v) => {
    await setVal(id, v);
    await evalJs(`document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('input',{bubbles:true}))`);
  };
  await fill('fName', 'Abdul Karim');
  await fill('fFather', 'Rahim Uddin');
  await fill('fMother', 'Amina Begum');
  await fill('fSex', 'male');
  await fill('fDob', '1955-06-15');
  await fill('fBrn', '19550615123456789');
  await fill('fNid', '1234567890');
  await fill('fDeathDate', isoDaysAgo(10));
  await fill('fDeathPlace', 'Dhaka Medical College Hospital, Dhaka');
  await fill('fCause', 'Cardiac arrest');
  await fill('fInfName', 'Karim Uddin');
  await fill('fInfRel', 'son');
  await fill('fInfNid', '98765');
  await fill('fInfMobile', '01712345678');
  await fill('fOfficeType', 'city');
  await fill('fOfficeName', 'Dhaka South City Corporation');
  await evalJs('document.getElementById("genBtn").click()');
  await sleep(300);
  check('bad informant NID blocks generation', (await evalJs('document.getElementById("applyError").hidden')) === false);
  await fill('fInfNid', '9876543210');
  await evalJs('document.getElementById("genBtn").click()');
  await sleep(400);
  check('valid form generates letter', (await evalJs('document.getElementById("letterBox").hidden')) === false);
  const summaryText = await evalJs('document.getElementById("summaryTable").textContent');
  check('summary names the deceased', summaryText.includes('Abdul Karim'), summaryText);
  check('summary shows office', summaryText.includes('Dhaka South City Corporation'), summaryText);
  check('summary shows free fee band', summaryText.includes('Free'), summaryText);
  const letterText = await evalJs('document.getElementById("letterText").textContent');
  check('letter addresses the Registrar', letterText.includes('The Registrar'), letterText);
  check('letter has the subject line', letterText.includes('Subject: Application for registration of death'), letterText);
  check('letter signs with informant', letterText.includes('Karim Uddin'), letterText);

  // --- Bangla toggle ---
  await evalJs('document.getElementById("langBtn").click()');
  await sleep(300);
  check('html lang switches to bn', (await evalJs('document.documentElement.lang')) === 'bn');
  check('BN lang persisted', (await evalJs('localStorage.getItem("death-certificate-bd:v1")')).includes('"lang":"bn"'));
  await evalJs('document.getElementById("langBtn").click()');
  await sleep(300);
  check('back to English', (await evalJs('document.documentElement.lang')) === 'en');

  // --- Persistence across reload ---
  await send('Page.navigate', { url: URL });
  await waitFor(async () => (await evalJs('document.readyState')) === 'complete', 15000, 'reload');
  await sleep(500);
  check('form draft persists after reload', (await evalJs('document.getElementById("fName").value')) === 'Abdul Karim');
  check('checklist persists after reload', (await evalJs('document.getElementById("docsPct").textContent')) === '13%');

  // --- XSS safety: markup in a name is rendered as text ---
  await evalJs('document.querySelector(\'[data-tab="apply"]\').click()');
  await sleep(200);
  await fill('fName', '<b>hi</b>');
  await evalJs('document.getElementById("genBtn").click()');
  await sleep(400);
  check('markup name stored as text, no element created',
    (await evalJs('document.querySelectorAll("#summaryTable b").length')) === 0 &&
    (await evalJs('document.getElementById("summaryTable").textContent')).includes('<b>hi</b>'));
  await fill('fName', 'Abdul Karim');

  // --- Export -> erase (wrong text, then DELETE) -> import round-trip ---
  await evalJs('document.querySelector(\'[data-tab="data"]\').click()');
  await sleep(200);
  await evalJs('document.getElementById("exportBtn").click()');
  await sleep(300);
  const exported = await evalJs('window.__dcbdExported');
  check('export captures JSON with name and office', typeof exported === 'string' && exported.includes('Abdul Karim') && exported.includes('Dhaka South City Corporation'));
  await evalJs('document.getElementById("eraseBtn").click()');
  await sleep(200);
  await evalJs('document.getElementById("eraseInput").value = "delete"');
  await evalJs('document.getElementById("eraseConfirmBtn").click()');
  await sleep(200);
  check('wrong erase text shows error, data intact', (await evalJs('document.getElementById("eraseError").hidden')) === false &&
    (await evalJs('document.getElementById("fName").value')) === 'Abdul Karim');
  await evalJs('document.getElementById("eraseInput").value = "DELETE"');
  await evalJs('document.getElementById("eraseConfirmBtn").click()');
  await sleep(300);
  check('erase with DELETE clears form', (await evalJs('document.getElementById("fName").value')) === '');
  check('erase clears checklist', (await evalJs('document.getElementById("docsPct").textContent')) === '0%');
  await evalJs(`(function(){var dt=new DataTransfer();dt.items.add(new File([window.__dcbdExported],'death-certificate-bd.json',{type:'application/json'}));var inp=document.getElementById('importFile');inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await sleep(600);
  check('import restores name', (await evalJs('document.getElementById("fName").value')) === 'Abdul Karim');
  check('import restores checklist 13%', (await evalJs('document.getElementById("docsPct").textContent')) === '13%');
  check('import success message shown', (await evalJs('document.getElementById("dataMsg").textContent')).includes('Imported'));

  // --- Demo data (labelled, never auto-loaded) ---
  await evalJs('document.getElementById("eraseBtn").click()');
  await sleep(200);
  await evalJs('document.getElementById("eraseInput").value = "DELETE"');
  await evalJs('document.getElementById("eraseConfirmBtn").click()');
  await sleep(300);
  check('cleared before demo load', (await evalJs('document.getElementById("fName").value')) === '');
  await evalJs('document.getElementById("demoBtn").click()');
  await sleep(300);
  check('demo fills the name', (await evalJs('document.getElementById("fName").value')).includes('Abdul Karim'));
  check('demo checks 4 of 8 documents', (await evalJs('document.getElementById("docsPct").textContent')) === '50%',
    await evalJs('document.getElementById("docsPct").textContent'));

  // --- No horizontal overflow at this viewport ---
  const overflow = await evalJs('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  check('no horizontal overflow', overflow === 0, 'overflow=' + overflow);

  check('no console errors during whole run', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('no failed requests during whole run', failedReqs.length === 0, failedReqs.join(' | '));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result?.data) {
    fs.writeFileSync(path.join(ROOT, `tests/smoke-${WIDTH}.png`), Buffer.from(shot.result.data, 'base64'));
    console.log(`  screenshot: tests/smoke-${WIDTH}.png`);
  }
} catch (e) {
  fail++;
  console.log('  FAIL harness error: ' + (e && e.message));
} finally {
  if (ws) ws.close();
  chrome.kill();
}

console.log(`\n${pass} passed, ${fail} failed (viewport ${WIDTH}x${HEIGHT})`);
process.exit(fail === 0 ? 0 : 1);
