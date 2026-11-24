// Death Certificate BD — node unit tests for js/logic.js.
// Run: node tests/test.js   (exit 0 only if all pass)
const assert = require('node:assert');
const L = require('../js/logic.js');

let pass = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  PASS ' + name); }
  catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; }
}

const TODAY = '2026-11-24';

check('daysBetween: same day is 0', () => assert.strictEqual(L.daysBetween('2026-11-24', TODAY), 0));
check('daysBetween: 10 days ago', () => assert.strictEqual(L.daysBetween('2026-11-14', TODAY), 10));
check('daysBetween: future date is negative', () => assert.strictEqual(L.daysBetween('2026-11-25', TODAY), -1));
check('daysBetween: leap year span', () => assert.strictEqual(L.daysBetween('2024-02-28', '2024-03-01'), 2));
check('daysBetween: year boundary', () => assert.strictEqual(L.daysBetween('2025-12-31', '2026-01-01'), 1));

check('fee band: 0 days free', () => assert.deepStrictEqual(L.feeBandForDays(0), { band: 'free', fee: 0 }));
check('fee band: 45 days free (boundary)', () => assert.deepStrictEqual(L.feeBandForDays(45), { band: 'free', fee: 0 }));
check('fee band: 46 days late 25 (boundary)', () => assert.deepStrictEqual(L.feeBandForDays(46), { band: 'late', fee: 25 }));
check('fee band: 100 days late 25', () => assert.deepStrictEqual(L.feeBandForDays(100), { band: 'late', fee: 25 }));
check('fee band: 1825 days late 25 (5-year boundary)', () => assert.deepStrictEqual(L.feeBandForDays(1825), { band: 'late', fee: 25 }));
check('fee band: 1826 days very late 50', () => assert.deepStrictEqual(L.feeBandForDays(1826), { band: 'veryLate', fee: 50 }));
check('fee band: 2190 days very late 50', () => assert.deepStrictEqual(L.feeBandForDays(2190), { band: 'veryLate', fee: 50 }));

check('BRN: 17 digits valid', () => assert.strictEqual(L.isValidBRN('19550615123456789'), true));
check('BRN: 16 digits invalid', () => assert.strictEqual(L.isValidBRN('1955061512345678'), false));
check('BRN: letters invalid', () => assert.strictEqual(L.isValidBRN('1955061512345678A'), false));
check('BRN: empty invalid', () => assert.strictEqual(L.isValidBRN(''), false));
check('NID: 10 digits valid', () => assert.strictEqual(L.isValidNID('1234567890'), true));
check('NID: 13 digits valid', () => assert.strictEqual(L.isValidNID('1234567890123'), true));
check('NID: 17 digits valid', () => assert.strictEqual(L.isValidNID('12345678901234567'), true));
check('NID: 11 digits invalid', () => assert.strictEqual(L.isValidNID('12345678901'), false));
check('NID: letters invalid', () => assert.strictEqual(L.isValidNID('123456789a'), false));
check('mobile: 017 valid', () => assert.strictEqual(L.isValidMobile('01712345678'), true));
check('mobile: 019 valid', () => assert.strictEqual(L.isValidMobile('01987654321'), true));
check('mobile: 10 digits invalid', () => assert.strictEqual(L.isValidMobile('0171234567'), false));
check('mobile: 012 invalid (bad prefix)', () => assert.strictEqual(L.isValidMobile('01212345678'), false));
check('mobile: 011 invalid (bad prefix)', () => assert.strictEqual(L.isValidMobile('01112345678'), false));
check('mobile: letters invalid', () => assert.strictEqual(L.isValidMobile('0171234567a'), false));

check('BN digits: 0-9 convert', () => assert.strictEqual(L.toBnDigits('0123456789'), '০১২৩৪৫৬৭৮৯'));
check('BN digits: mixed text', () => assert.strictEqual(L.toBnDigits('Fee 25'), 'Fee ২৫'));
check('formatNumber EN: grouping', () => assert.strictEqual(L.formatNumber(1825, 'en'), '1,825'));
check('formatNumber BN: grouping + digits', () => assert.strictEqual(L.formatNumber(1825, 'bn'), '১,৮২৫'));
check('formatTaka EN', () => assert.strictEqual(L.formatTaka(25, 'en'), '৳25'));
check('formatTaka BN', () => assert.strictEqual(L.formatTaka(25, 'bn'), '৳২৫'));

check('fee date validation: empty required', () => assert.strictEqual(L.validateFeeDate('', TODAY), 'errFeeDateRequired'));
check('fee date validation: future rejected', () => assert.strictEqual(L.validateFeeDate('2026-11-25', TODAY), 'errFeeDateFuture'));
check('fee date validation: past ok', () => assert.strictEqual(L.validateFeeDate('2026-11-10', TODAY), null));

const good = {
  fName: 'Abdul Karim', fFather: 'Rahim Uddin', fMother: 'Amina Begum', fSpouse: '',
  fSex: 'male', fDob: '1955-06-15', fBrn: '19550615123456789', fNid: '1234567890',
  fDeathDate: '2026-11-10', fDeathPlace: 'Dhaka', fCause: 'Cardiac arrest',
  fDoctor: '', fDoctorReg: '', fBurialPlace: '', fBurialDate: '',
  fInfName: 'Karim Uddin', fInfRel: 'son', fInfNid: '9876543210', fInfMobile: '01712345678',
  fOfficeType: 'city', fOfficeName: 'Dhaka South City Corporation',
};
check('form: valid data passes', () => assert.deepStrictEqual(L.validateForm(good, TODAY), []));
check('form: empty data lists all required errors', () => {
  const errs = L.validateForm({}, TODAY);
  ['errName', 'errFather', 'errMother', 'errSex', 'errDeathDate', 'errDeathPlace',
   'errCause', 'errInfName', 'errInfRel', 'errInfNid', 'errMobile',
   'errOfficeType', 'errOfficeName'].forEach((k) => assert.ok(errs.includes(k), 'missing ' + k));
});
check('form: bad informant NID rejected', () => {
  const d = Object.assign({}, good, { fInfNid: '12345' });
  assert.ok(L.validateForm(d, TODAY).includes('errInfNid'));
});
check('form: bad mobile rejected', () => {
  const d = Object.assign({}, good, { fInfMobile: '01212345678' });
  assert.ok(L.validateForm(d, TODAY).includes('errMobile'));
});
check('form: future death date rejected', () => {
  const d = Object.assign({}, good, { fDeathDate: '2026-12-01' });
  assert.ok(L.validateForm(d, TODAY).includes('errDeathDateFuture'));
});
check('form: bad BRN rejected', () => {
  const d = Object.assign({}, good, { fBrn: '123' });
  assert.ok(L.validateForm(d, TODAY).includes('errBrn'));
});
check('form: bad deceased NID rejected', () => {
  const d = Object.assign({}, good, { fNid: '12345678901' });
  assert.ok(L.validateForm(d, TODAY).includes('errNid'));
});
check('form: optional BRN/NID may be blank', () => {
  const d = Object.assign({}, good, { fBrn: '', fNid: '' });
  assert.deepStrictEqual(L.validateForm(d, TODAY), []);
});
check('form: DOB after death rejected', () => {
  const d = Object.assign({}, good, { fDob: '2026-11-11' });
  assert.ok(L.validateForm(d, TODAY).includes('errDobAfterDeath'));
});
check('form: DOB in future rejected', () => {
  const d = Object.assign({}, good, { fDob: '2027-01-01' });
  assert.ok(L.validateForm(d, TODAY).includes('errDobFuture'));
});
check('form: burial before death rejected', () => {
  const d = Object.assign({}, good, { fBurialDate: '2026-11-09' });
  assert.ok(L.validateForm(d, TODAY).includes('errBurialBeforeDeath'));
});
check('form: burial after death ok', () => {
  const d = Object.assign({}, good, { fBurialDate: '2026-11-11' });
  assert.deepStrictEqual(L.validateForm(d, TODAY), []);
});

console.log('\n' + pass + ' passed');
