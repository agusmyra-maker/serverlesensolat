# Solat TV — License Server

A small self-hosted server for issuing, activating, renewing, and revoking
numeric license codes for the Solat TV app — no Google Play Store or
Play Billing needed, since the app is sideloaded directly.

## How it works

1. **You generate a code** in the admin panel (choose masjid name + plan:
   Bulanan/Separuh Tahun/Tahunan) — a 9-digit code is created.
2. **You give that code** to the masjid (WhatsApp, printed slip, etc.)
   after they've paid.
3. **They type the code** into the Solat TV app's on-screen number pad
   (first launch, or whenever their subscription needs renewing).
4. The app calls this server once to activate — **the code gets bound to
   that specific TV/device** at that moment (one license = one device, so
   a code can't be shared across multiple TVs).
5. From then on, the app caches the expiry date locally and works fully
   offline day-to-day, only checking back in with this server occasionally
   to confirm it's still valid (or pick up a renewal).
6. When the subscription runs out, the app locks itself with a full-screen
   "Langganan Tamat Tempoh" message and asks for a new code — which is
   exactly where you'd give them a renewal code after they pay again.

## Running it

```bash
cd SolatLicenseServer
npm install
npm start
```

You'll see:
```
Solat TV License Server running at http://localhost:4000
Admin panel: http://localhost:4000/admin.html
```

Open the admin panel at `http://<IP-of-this-PC>:4000/admin.html`.
Default password: `admin123` — **change it** under "Tukar Kata Laluan Admin"
after your first login.

## Important: this server needs a public address

Unlike the Solat TV display server (which only needs to be reachable on
the masjid's own local network), **this license server needs to be
reachable from every masjid's TV over the internet**, since each one is a
different physical location. Options:

- Deploy it on a small always-on VPS (DigitalOcean, Vultr, a cheap Malaysian
  host, etc.) — a $5/month box is more than enough for this.
- Or use a free-tier platform like Render, Railway, or Fly.io.
- Whatever address you end up with (e.g. `https://license.yourdomain.com`),
  put it into the `LICENSE_SERVER_URL` constant near the top of the
  `<script>` section in `SolatTVWebApp/app/src/main/assets/index.html`
  **before building the APK** you distribute to customers.

## Admin panel — day to day use

- **Jana Lesen Baharu**: type the masjid's name (just for your own records),
  pick a plan, click "Jana Kod" — a 9-digit code appears. Give this to the
  masjid.
- **Senarai Lesen**: every code you've ever issued, with live status:
  - `Belum Aktif` — generated but not yet entered into any app
  - `Aktif` — currently valid, shows days remaining
  - `Tamat Tempoh` — expired, app will be locked
  - `Dibatalkan` — you manually revoked it (e.g. non-payment, dispute)
- **Perbaharui**: pick a plan and click — extends the expiry. If the
  license is still active, the new period is added on top of the
  remaining time (they don't lose unused days); if it's already expired,
  the new period starts from today.
- **Batal**: immediately invalidates a code (the app will lock out next
  time it phones home or restarts).
- **Padam**: permanently removes the record (can't be undone — use "Batal"
  instead if you might want to reinstate it later).

## Data storage

Everything lives in `data/licenses.json` — back this file up periodically
(it's your entire customer/licensing database). There's no external
database dependency; it's the same lightweight JSON-file approach used by
the rest of this project.

## Security notes

- This is intentionally simple (matching the scale of a small
  masjid-display business) — there's no HTTPS built in. If you deploy to a
  real domain, put it behind a reverse proxy (Caddy, Nginx, or the
  hosting platform's built-in HTTPS) so codes aren't sent in plain HTTP
  over the internet.
- The admin password protects the management panel only; the
  `/api/license/verify` endpoint is intentionally public (the app itself
  calls it) but only ever reveals whether a *given* code is valid — it
  doesn't expose the license list.
