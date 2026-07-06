const express = require('express');
const session = require('express-session');
const path = require('path');

const store = require('./utils/licenseStore');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'solat-tv-license-local-secret-change-if-you-want',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 } // 30 days
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ ok: false, error: 'Not authenticated' });
}

// ---------- Public: called by the Solat TV app itself ----------
app.post('/api/license/verify', (req, res) => {
  const { code, deviceId } = req.body;
  if (!code || !deviceId) {
    return res.status(400).json({ ok: false, error: 'code dan deviceId diperlukan' });
  }
  const result = store.verifyAndBind(String(code).trim(), String(deviceId).trim());
  res.json(result);
});

// One-time 10-day demo, automatically requested by the app on first launch
// (no code needed) — tracked by deviceId so it can't be reset by reinstalling.
app.post('/api/demo/start', (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) {
    return res.status(400).json({ ok: false, error: 'deviceId diperlukan' });
  }
  const result = store.startDemo(String(deviceId).trim());
  res.json(result);
});

// ---------- Admin auth ----------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password && password === store.getAdminPassword()) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'Kata laluan salah' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/session', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ ok: false, error: 'Kata laluan mesti sekurang-kurangnya 4 aksara' });
  }
  store.setAdminPassword(newPassword);
  res.json({ ok: true });
});

// ---------- Admin: manage licenses ----------
app.get('/api/admin/licenses', requireAdmin, (req, res) => {
  res.json({ licenses: store.listLicenses(), planDays: store.PLAN_DAYS, planLabels: store.PLAN_LABELS });
});

app.post('/api/admin/licenses', requireAdmin, (req, res) => {
  const { masjidName, plan, notes } = req.body;
  if (!plan || !store.PLAN_DAYS[plan] || plan === 'demo') {
    return res.status(400).json({ ok: false, error: 'Pelan tidak sah' });
  }
  const license = store.createLicense({ masjidName, plan, notes });
  res.json({ ok: true, license });
});

app.post('/api/admin/licenses/:code/renew', requireAdmin, (req, res) => {
  const { plan } = req.body;
  if (!plan || !store.PLAN_DAYS[plan] || plan === 'demo') {
    return res.status(400).json({ ok: false, error: 'Pelan tidak sah' });
  }
  const result = store.renewLicense(req.params.code, plan);
  res.json(result);
});

app.post('/api/admin/licenses/:code/revoke', requireAdmin, (req, res) => {
  res.json(store.revokeLicense(req.params.code));
});

app.delete('/api/admin/licenses/:code', requireAdmin, (req, res) => {
  res.json(store.deleteLicense(req.params.code));
});

app.listen(PORT, () => {
  console.log(`Solat TV License Server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});
