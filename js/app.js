// Death Certificate BD — app logic (DOM + i18n + persistence).
// All user-visible text comes from STRINGS (js/i18n.js); all user-entered
// text is rendered with textContent (no innerHTML for user data).
(function () {
  'use strict';
  var L = window.DcbdLogic;
  var STORE_KEY = 'death-certificate-bd:v1';
  var APP_ID = 'death-certificate-bd';
  var DOC_COUNT = 8;
  var FIELD_IDS = ['fName', 'fFather', 'fMother', 'fSpouse', 'fSex', 'fDob', 'fBrn', 'fNid',
    'fDeathDate', 'fDeathPlace', 'fCause', 'fDoctor', 'fDoctorReg', 'fBurialPlace', 'fBurialDate',
    'fInfName', 'fInfRel', 'fInfNid', 'fInfMobile', 'fOfficeType', 'fOfficeName'];

  var state = { lang: 'en', docs: [], form: {}, feeDate: '' };
  var feeShown = null; // {days, band, fee} or null
  var letterShown = false;

  function $(id) { return document.getElementById(id); }
  function t(key) {
    var s = STRINGS[state.lang] && STRINGS[state.lang][key];
    if (s === undefined) s = STRINGS.en[key];
    return s === undefined ? key : s;
  }
  function esc(s) { return String(s == null ? '' : s); }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.lang === 'en' || parsed.lang === 'bn') state.lang = parsed.lang;
          if (Array.isArray(parsed.docs)) state.docs = parsed.docs.filter(function (d) { return d === true || d === false; });
          if (parsed.form && typeof parsed.form === 'object') state.form = parsed.form;
          if (typeof parsed.feeDate === 'string') state.feeDate = parsed.feeDate;
        }
      }
    } catch (e) { /* corrupted storage: start fresh */ }
    while (state.docs.length < DOC_COUNT) state.docs.push(false);
    state.docs = state.docs.slice(0, DOC_COUNT);
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }

  // ---------- language ----------
  function applyLang() {
    document.documentElement.lang = state.lang;
    $('langBtn').textContent = state.lang === 'en' ? 'বাংলা' : 'English';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.title = t('appTitle') + ' — ' + t('tagline');
    renderDocs();
    renderFeeResult();
    if (letterShown) renderLetter();
    updateDocsProgress();
  }
  $('langBtn').addEventListener('click', function () {
    state.lang = state.lang === 'en' ? 'bn' : 'en';
    save();
    applyLang();
  });

  // ---------- tabs ----------
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.querySelectorAll('.panel').forEach(function (p) { p.hidden = true; });
      $('tab-' + btn.getAttribute('data-tab')).hidden = false;
    });
  });

  // ---------- fee calculator ----------
  function renderFeeResult() {
    var box = $('feeResult');
    if (!feeShown) { box.hidden = true; return; }
    box.hidden = false;
    $('feeDaysOut').textContent = L.formatNumber(feeShown.days, state.lang);
    $('feeBandOut').textContent = t('feeBand' + feeShown.band[0].toUpperCase() + feeShown.band.slice(1));
    $('feeAmountOut').textContent = feeShown.fee === 0 ? t('feeFree') : L.formatTaka(feeShown.fee, state.lang);
    $('feeNote').textContent = t('feeNote' + feeShown.band[0].toUpperCase() + feeShown.band.slice(1));
  }
  $('feeBtn').addEventListener('click', function () {
    var dateStr = $('deathDateInput').value;
    var err = L.validateFeeDate(dateStr, L.todayStr());
    var errEl = $('feeError');
    if (err) {
      errEl.textContent = t(err);
      errEl.hidden = false;
      feeShown = null;
      renderFeeResult();
      return;
    }
    errEl.hidden = true;
    var days = L.daysBetween(dateStr, L.todayStr());
    var band = L.feeBandForDays(days);
    feeShown = { days: days, band: band.band, fee: band.fee };
    state.feeDate = dateStr;
    save();
    renderFeeResult();
  });

  // ---------- documents checklist ----------
  function renderDocs() {
    var list = $('docsList');
    list.innerHTML = '';
    for (var i = 0; i < DOC_COUNT; i++) {
      (function (idx) {
        var li = document.createElement('li');
        if (state.docs[idx]) li.className = 'done';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = state.docs[idx];
        cb.setAttribute('aria-label', t('doc' + (idx + 1) + 't'));
        cb.addEventListener('change', function () {
          state.docs[idx] = cb.checked;
          save();
          renderDocs();
          updateDocsProgress();
        });
        var div = document.createElement('div');
        var title = document.createElement('div');
        title.className = 'doc-title';
        title.textContent = t('doc' + (idx + 1) + 't');
        var hint = document.createElement('div');
        hint.className = 'doc-hint';
        hint.textContent = t('doc' + (idx + 1) + 'h');
        div.appendChild(title);
        div.appendChild(hint);
        li.appendChild(cb);
        li.appendChild(div);
        list.appendChild(li);
      })(i);
    }
  }
  function updateDocsProgress() {
    var done = state.docs.filter(Boolean).length;
    var pct = Math.round((done / DOC_COUNT) * 100);
    $('docsPct').textContent = L.formatNumber(pct, state.lang) + '%';
    $('docsCount').textContent = L.formatNumber(done, state.lang) + ' / ' + L.formatNumber(DOC_COUNT, state.lang);
    $('docsBar').style.width = pct + '%';
  }

  // ---------- application form ----------
  function gatherForm() {
    var data = {};
    FIELD_IDS.forEach(function (id) { data[id] = $(id).value; });
    return data;
  }
  function fillForm(data) {
    FIELD_IDS.forEach(function (id) { if (data[id] !== undefined) $(id).value = data[id]; });
  }
  function restoreForm() { fillForm(state.form); }
  FIELD_IDS.forEach(function (id) {
    $(id).addEventListener('input', function () {
      state.form[id] = $(id).value;
      save();
    });
    $(id).addEventListener('change', function () {
      state.form[id] = $(id).value;
      save();
    });
  });

  function officeTypeLabel(v) {
    var map = { union: 'offUnion', pourashava: 'offPoura', city: 'offCity', cantonment: 'offCant', mission: 'offMission' };
    return map[v] ? t(map[v]) : esc(v);
  }
  function sexLabel(v) {
    var map = { male: 'optMale', female: 'optFemale', other: 'optOther' };
    return map[v] ? t(map[v]) : esc(v);
  }
  function relLabel(v) {
    var map = { father: 'relFather', mother: 'relMother', spouse: 'relSpouse', son: 'relSon', daughter: 'relDaughter', other: 'relOther' };
    return map[v] ? t(map[v]) : esc(v);
  }
  function showVal(v) { return v && String(v).trim() ? String(v).trim() : t('valNotGiven'); }

  function buildSummaryRows(data) {
    var rows = [];
    function add(labelKey, value) { rows.push([t(labelKey), value]); }
    add('lblName', showVal(data.fName));
    add('lblFather', showVal(data.fFather));
    add('lblMother', showVal(data.fMother));
    add('lblSpouse', showVal(data.fSpouse));
    add('lblSex', data.fSex ? sexLabel(data.fSex) : t('valNotGiven'));
    add('lblDob', showVal(data.fDob));
    add('lblBrn', showVal(data.fBrn));
    add('lblNid', showVal(data.fNid));
    add('lblDeathDate', showVal(data.fDeathDate));
    add('lblDeathPlace', showVal(data.fDeathPlace));
    add('lblCause', showVal(data.fCause));
    add('lblDoctor', showVal(data.fDoctor));
    add('lblDoctorReg', showVal(data.fDoctorReg));
    add('lblBurialPlace', showVal(data.fBurialPlace));
    add('lblBurialDate', showVal(data.fBurialDate));
    add('lblInfName', showVal(data.fInfName));
    add('lblInfRel', data.fInfRel ? relLabel(data.fInfRel) : t('valNotGiven'));
    add('lblInfNid', showVal(data.fInfNid));
    add('lblInfMobile', showVal(data.fInfMobile));
    add('lblOfficeType', data.fOfficeType ? officeTypeLabel(data.fOfficeType) : t('valNotGiven'));
    add('lblOfficeName', showVal(data.fOfficeName));
    if (data.fDeathDate) {
      var days = L.daysBetween(data.fDeathDate, L.todayStr());
      if (days >= 0) {
        var band = L.feeBandForDays(days);
        add('summaryFee', t('feeBand' + band.band[0].toUpperCase() + band.band.slice(1)) +
          (band.fee === 0 ? ' — ' + t('feeFree') : ' — ' + L.formatTaka(band.fee, state.lang)));
      }
    }
    return rows;
  }

  function buildLetterText(data) {
    var lines = [];
    lines.push(t('letterTo'));
    lines.push(t('letterRegistrar'));
    lines.push(officeTypeLabel(data.fOfficeType) + ', ' + data.fOfficeName.trim());
    lines.push('');
    lines.push(t('letterDate') + ': ' + L.todayStr());
    lines.push('');
    lines.push(t('letterSubject'));
    lines.push('');
    lines.push('Sir/Madam,');
    lines.push(t('letterBody1'));
    lines.push(t('letterBody2'));
    lines.push('');
    lines.push(t('letterFaithfully'));
    lines.push(data.fInfName.trim());
    lines.push(t('letterInformant') + ' — ' + relLabel(data.fInfRel));
    lines.push(t('letterMobile') + ': ' + data.fInfMobile.trim());
    return lines.join('\n');
  }

  function renderLetter() {
    var data = gatherForm();
    var table = $('summaryTable');
    table.innerHTML = '';
    var tbl = document.createElement('table');
    tbl.className = 'summary-table';
    buildSummaryRows(data).forEach(function (row) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      td1.textContent = row[0];
      var td2 = document.createElement('td');
      td2.textContent = row[1];
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbl.appendChild(tr);
    });
    table.appendChild(tbl);
    $('letterText').textContent = buildLetterText(data);
  }

  $('genBtn').addEventListener('click', function () {
    var data = gatherForm();
    var errs = L.validateForm(data, L.todayStr());
    var errEl = $('applyError');
    if (errs.length) {
      errEl.textContent = errs.map(function (k) { return t(k); }).join(' ');
      errEl.hidden = false;
      $('letterBox').hidden = true;
      letterShown = false;
      return;
    }
    errEl.hidden = true;
    state.form = data;
    save();
    letterShown = true;
    renderLetter();
    $('letterBox').hidden = false;
  });
  $('clearFormBtn').addEventListener('click', function () {
    FIELD_IDS.forEach(function (id) { $(id).value = ''; });
    state.form = {};
    save();
    $('applyError').hidden = true;
    $('letterBox').hidden = true;
    letterShown = false;
  });
  $('printBtn').addEventListener('click', function () { window.print(); });

  // ---------- data tab ----------
  function showMsg(key) {
    var el = $('dataMsg');
    el.textContent = t(key);
    el.hidden = false;
  }
  $('exportBtn').addEventListener('click', function () {
    var payload = { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), state: state };
    var json = JSON.stringify(payload, null, 2);
    window.__dcbdExported = json;
    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'death-certificate-bd.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    showMsg('msgExported');
  });
  $('importFile').addEventListener('change', function () {
    var file = $('importFile').files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || parsed.app !== APP_ID || !parsed.state || typeof parsed.state !== 'object') throw new Error('bad export');
        var s = parsed.state;
        if (s.lang === 'en' || s.lang === 'bn') state.lang = s.lang;
        if (Array.isArray(s.docs)) {
          state.docs = s.docs.filter(function (d) { return d === true || d === false; });
          while (state.docs.length < DOC_COUNT) state.docs.push(false);
          state.docs = state.docs.slice(0, DOC_COUNT);
        }
        if (s.form && typeof s.form === 'object') state.form = s.form;
        if (typeof s.feeDate === 'string') state.feeDate = s.feeDate;
        save();
        fillForm(state.form);
        $('deathDateInput').value = state.feeDate || '';
        feeShown = null;
        renderFeeResult();
        $('letterBox').hidden = true;
        letterShown = false;
        applyLang();
        showMsg('msgImported');
      } catch (e) {
        showMsg('msgImportFailed');
      }
      $('importFile').value = '';
    };
    reader.readAsText(file);
  });
  $('demoBtn').addEventListener('click', function () {
    var demo = {
      fName: t('demoName'), fFather: 'Rahim Uddin', fMother: 'Amina Begum',
      fSpouse: 'Fatema Khatun', fSex: 'male', fDob: '1955-06-15',
      fBrn: '19550615123456789', fNid: '1234567890',
      fDeathDate: '2026-11-10', fDeathPlace: 'Dhaka Medical College Hospital, Dhaka',
      fCause: 'Cardiac arrest', fDoctor: 'Dr. Tanvir Ahmed', fDoctorReg: 'BMDC-12345',
      fBurialPlace: 'Azimpur Graveyard, Dhaka', fBurialDate: '2026-11-11',
      fInfName: 'Karim Uddin', fInfRel: 'son', fInfNid: '9876543210',
      fInfMobile: '01712345678', fOfficeType: 'city', fOfficeName: 'Dhaka South City Corporation',
    };
    state.form = demo;
    state.docs = [true, true, true, false, true, false, false, false];
    save();
    fillForm(demo);
    $('deathDateInput').value = demo.fDeathDate;
    $('letterBox').hidden = true;
    letterShown = false;
    applyLang();
    showMsg('msgDemo');
  });
  $('eraseBtn').addEventListener('click', function () {
    $('eraseBox').hidden = false;
    $('eraseInput').value = '';
    $('eraseError').hidden = true;
  });
  $('eraseConfirmBtn').addEventListener('click', function () {
    if ($('eraseInput').value !== 'DELETE') {
      $('eraseError').textContent = t('errEraseWrong');
      $('eraseError').hidden = false;
      return;
    }
    localStorage.removeItem(STORE_KEY);
    state = { lang: state.lang, docs: [], form: {}, feeDate: '' };
    while (state.docs.length < DOC_COUNT) state.docs.push(false);
    FIELD_IDS.forEach(function (id) { $(id).value = ''; });
    $('deathDateInput').value = '';
    $('feeError').hidden = true;
    feeShown = null;
    renderFeeResult();
    $('letterBox').hidden = true;
    letterShown = false;
    $('eraseBox').hidden = true;
    applyLang();
    showMsg('msgErased');
  });

  // ---------- init ----------
  load();
  if (state.feeDate) $('deathDateInput').value = state.feeDate;
  restoreForm();
  applyLang();
})();
