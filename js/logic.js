// Death Certificate BD — pure logic (no DOM). Shared by the browser app
// (loaded before app.js) and the node unit tests.
(function (root) {
  'use strict';

  var BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

  function toBnDigits(value) {
    return String(value).replace(/[0-9]/g, function (d) { return BN_DIGITS[Number(d)]; });
  }

  function formatNumber(n, lang) {
    var s = Number(n).toLocaleString('en-US');
    return lang === 'bn' ? toBnDigits(s) : s;
  }

  function formatTaka(n, lang) {
    return '৳' + formatNumber(n, lang);
  }

  // Whole days from dateStr (YYYY-MM-DD) to todayStr (YYYY-MM-DD).
  // Negative when dateStr is in the future. Uses UTC to avoid DST issues.
  function daysBetween(dateStr, todayStr) {
    var a = dateStr.split('-').map(Number);
    var b = todayStr.split('-').map(Number);
    var ms = Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2]);
    return Math.floor(ms / 86400000);
  }

  function todayStr(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  // Fee bands (commonly cited figures): free within 45 days, ৳25 from
  // 46 days to 5 years, ৳50 after 5 years. 5 years = 1825 days.
  function feeBandForDays(days) {
    if (days <= 45) return { band: 'free', fee: 0 };
    if (days <= 1825) return { band: 'late', fee: 25 };
    return { band: 'veryLate', fee: 50 };
  }

  function isValidBRN(s) { return /^\d{17}$/.test(String(s || '').trim()); }
  function isValidNID(s) { return /^(\d{10}|\d{13}|\d{17})$/.test(String(s || '').trim()); }
  function isValidMobile(s) { return /^01[3-9]\d{8}$/.test(String(s || '').trim()); }

  // Validate the application form. Returns an array of error keys (empty = ok).
  // data: flat object of field ids -> values. today: YYYY-MM-DD string.
  function validateForm(data, today) {
    var errs = [];
    var v = function (k) { return String(data[k] || '').trim(); };
    if (!v('fName')) errs.push('errName');
    if (!v('fFather')) errs.push('errFather');
    if (!v('fMother')) errs.push('errMother');
    if (!v('fSex')) errs.push('errSex');
    if (!v('fDeathDate')) errs.push('errDeathDate');
    else if (daysBetween(v('fDeathDate'), today) < 0) errs.push('errDeathDateFuture');
    if (!v('fDeathPlace')) errs.push('errDeathPlace');
    if (!v('fCause')) errs.push('errCause');
    if (!v('fInfName')) errs.push('errInfName');
    if (!v('fInfRel')) errs.push('errInfRel');
    if (!isValidNID(v('fInfNid'))) errs.push('errInfNid');
    if (!isValidMobile(v('fInfMobile'))) errs.push('errMobile');
    if (!v('fOfficeType')) errs.push('errOfficeType');
    if (!v('fOfficeName')) errs.push('errOfficeName');
    if (v('fBrn') && !isValidBRN(v('fBrn'))) errs.push('errBrn');
    if (v('fNid') && !isValidNID(v('fNid'))) errs.push('errNid');
    if (v('fDob')) {
      if (daysBetween(v('fDob'), today) < 0) errs.push('errDobFuture');
      else if (v('fDeathDate') && daysBetween(v('fDob'), v('fDeathDate')) <= 0) errs.push('errDobAfterDeath');
    }
    if (v('fBurialDate') && v('fDeathDate') && daysBetween(v('fDeathDate'), v('fBurialDate')) < 0) {
      errs.push('errBurialBeforeDeath');
    }
    return errs;
  }

  function validateFeeDate(dateStr, today) {
    if (!dateStr) return 'errFeeDateRequired';
    if (daysBetween(dateStr, today) < 0) return 'errFeeDateFuture';
    return null;
  }

  var api = {
    toBnDigits: toBnDigits,
    formatNumber: formatNumber,
    formatTaka: formatTaka,
    daysBetween: daysBetween,
    todayStr: todayStr,
    feeBandForDays: feeBandForDays,
    isValidBRN: isValidBRN,
    isValidNID: isValidNID,
    isValidMobile: isValidMobile,
    validateForm: validateForm,
    validateFeeDate: validateFeeDate,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DcbdLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
