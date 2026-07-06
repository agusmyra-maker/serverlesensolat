const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'licenses.json');
const DEFAULT_PATH = path.join(DATA_DIR, 'licenses.default.json');

const PLAN_DAYS = {
  monthly: 30,
  halfyearly: 182,
  yearly: 365
};

const PLAN_LABELS = {
  monthly: 'Bulanan',
  halfyearly: 'Separuh Tahun',
  yearly: 'Tahunan'
};

function ensureDbExists() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, fs.readFileSync(DEFAULT_PATH, 'utf-8'), 'utf-8');
  }
}

function readDb() {
  ensureDbExists();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

/** Generates a unique 9-digit numeric code not already in use. */
function generateUniqueCode(db) {
  let code;
  do {
    code = String(Math.floor(100000000 + Math.random() * 900000000));
  } while (db.licenses.some(l => l.code === code));
  return code;
}

function createLicense({ masjidName, plan, notes }) {
  const db = readDb();
  const license = {
    code: generateUniqueCode(db),
    masjidName: masjidName || '',
    plan,
    deviceId: null,
    activatedAt: null,
    expiresAt: null,
    status: 'unused', // unused -> active -> expired / revoked
    createdAt: new Date().toISOString(),
    notes: notes || ''
  };
  db.licenses.push(license);
  writeDb(db);
  return license;
}

function findLicense(code) {
  const db = readDb();
  return db.licenses.find(l => l.code === code) || null;
}

function listLicenses() {
  return readDb().licenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Called by the app itself. First call for a code binds it to that device
 * and starts the expiry countdown; subsequent calls just re-validate.
 */
function verifyAndBind(code, deviceId) {
  const db = readDb();
  const license = db.licenses.find(l => l.code === code);

  if (!license) return { ok: false, error: 'Kod lesen tidak sah' };
  if (license.status === 'revoked') return { ok: false, error: 'Lesen ini telah dibatalkan' };

  if (!license.deviceId) {
    // First activation — bind to this device and start the clock.
    license.deviceId = deviceId;
    license.activatedAt = new Date().toISOString();
    license.expiresAt = addDays(new Date(), PLAN_DAYS[license.plan]).toISOString();
    license.status = 'active';
    writeDb(db);
    return { ok: true, expiresAt: license.expiresAt, plan: license.plan, masjidName: license.masjidName };
  }

  if (license.deviceId !== deviceId) {
    return { ok: false, error: 'Kod ini telah digunakan pada peranti lain' };
  }

  if (new Date(license.expiresAt) < new Date()) {
    if (license.status !== 'expired') {
      license.status = 'expired';
      writeDb(db);
    }
    return { ok: false, error: 'Langganan telah tamat tempoh', expiresAt: license.expiresAt };
  }

  return { ok: true, expiresAt: license.expiresAt, plan: license.plan, masjidName: license.masjidName };
}

/** Renews a license: extends from "now" if already expired, or extends
 *  from its current expiry if still active (so unused time isn't lost). */
function renewLicense(code, plan) {
  const db = readDb();
  const license = db.licenses.find(l => l.code === code);
  if (!license) return { ok: false, error: 'Lesen tidak dijumpai' };

  const base = (license.expiresAt && new Date(license.expiresAt) > new Date())
    ? new Date(license.expiresAt)
    : new Date();

  license.plan = plan;
  license.expiresAt = addDays(base, PLAN_DAYS[plan]).toISOString();
  license.status = 'active';
  writeDb(db);
  return { ok: true, license };
}

function revokeLicense(code) {
  const db = readDb();
  const license = db.licenses.find(l => l.code === code);
  if (!license) return { ok: false, error: 'Lesen tidak dijumpai' };
  license.status = 'revoked';
  writeDb(db);
  return { ok: true };
}

function deleteLicense(code) {
  const db = readDb();
  db.licenses = db.licenses.filter(l => l.code !== code);
  writeDb(db);
  return { ok: true };
}

function getAdminPassword() {
  return readDb().adminPassword;
}

function setAdminPassword(newPassword) {
  const db = readDb();
  db.adminPassword = newPassword;
  writeDb(db);
}

module.exports = {
  PLAN_DAYS, PLAN_LABELS,
  createLicense, findLicense, listLicenses,
  verifyAndBind, renewLicense, revokeLicense, deleteLicense,
  getAdminPassword, setAdminPassword
};
