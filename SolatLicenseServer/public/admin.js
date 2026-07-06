const el = (id) => document.getElementById(id);
let planLabels = {};
let planDays = {};

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function checkSession() {
  const { isAdmin } = await api('/api/admin/session');
  if (isAdmin) showAdmin(); else showLogin();
}

function showLogin() {
  el('loginScreen').classList.remove('hidden');
  el('adminScreen').classList.add('hidden');
}

async function showAdmin() {
  el('loginScreen').classList.add('hidden');
  el('adminScreen').classList.remove('hidden');
  await loadLicenses();
}

el('btnLogin').addEventListener('click', doLogin);
el('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  el('loginError').textContent = '';
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: el('loginPassword').value }) });
    showAdmin();
  } catch (err) {
    el('loginError').textContent = err.message;
  }
}

el('btnLogout').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' });
  showLogin();
});

el('btnRefresh').addEventListener('click', loadLicenses);

el('btnCreate').addEventListener('click', async () => {
  const masjidName = el('newMasjidName').value.trim();
  const plan = el('newPlan').value;
  const notes = el('newNotes').value.trim();
  try {
    const { license } = await api('/api/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({ masjidName, plan, notes })
    });
    el('createResult').innerHTML =
      `Kod baharu dijana: <span class="code-highlight">${formatCode(license.code)}</span> — berikan kod ini kepada masjid untuk aktifkan.`;
    el('newMasjidName').value = '';
    el('newNotes').value = '';
    loadLicenses();
  } catch (err) {
    el('createResult').textContent = `Gagal: ${err.message}`;
  }
});

el('btnChangePassword').addEventListener('click', async () => {
  const newPassword = el('inputNewPassword').value;
  try {
    await api('/api/admin/change-password', { method: 'POST', body: JSON.stringify({ newPassword }) });
    el('passwordStatus').textContent = 'Kata laluan berjaya ditukar.';
    el('inputNewPassword').value = '';
  } catch (err) {
    el('passwordStatus').textContent = `Gagal: ${err.message}`;
  }
});

async function loadLicenses() {
  const data = await api('/api/admin/licenses');
  planLabels = data.planLabels;
  planDays = data.planDays;
  renderTable(data.licenses);
}

function renderTable(licenses) {
  const tbody = el('licenseTableBody');
  tbody.innerHTML = '';

  if (!licenses.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:#888;">Tiada lesen lagi.</td></tr>';
    return;
  }

  licenses.forEach(lic => {
    const tr = document.createElement('tr');
    const isLifetime = lic.plan === 'lifetime';
    const expiresLabel = isLifetime ? 'Tiada Tamat Tempoh' : (lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString('ms-MY') : '-');
    const daysLeft = lic.expiresAt ? Math.ceil((new Date(lic.expiresAt) - new Date()) / 86400000) : null;
    const expiresExtra = (!isLifetime && lic.status === 'active' && daysLeft !== null) ? ` (${daysLeft} hari lagi)` : '';

    tr.innerHTML = `
      <td class="code-cell">${formatCode(lic.code)}</td>
      <td>${escapeHtml(lic.masjidName || '-')}</td>
      <td>${planLabels[lic.plan] || lic.plan}</td>
      <td><span class="status-badge status-${lic.status}">${statusLabel(lic.status)}</span></td>
      <td>${expiresLabel}${expiresExtra}</td>
      <td>${lic.deviceId ? '✅ Terikat' : '— Belum'}</td>
      <td class="row-actions">
        <select data-role="renewPlan">
          <option value="monthly">Bulanan</option>
          <option value="halfyearly">Separuh Tahun</option>
          <option value="yearly">Tahunan</option>
          <option value="lifetime">Lifetime</option>
        </select>
        <button data-action="renew" class="btn-primary">Perbaharui</button>
        <button data-action="revoke" class="btn-secondary">Batal</button>
        <button data-action="delete" class="btn-danger">Padam</button>
      </td>
    `;

    tr.querySelector('[data-action="renew"]').addEventListener('click', async () => {
      const plan = tr.querySelector('[data-role="renewPlan"]').value;
      try {
        await api(`/api/admin/licenses/${lic.code}/renew`, { method: 'POST', body: JSON.stringify({ plan }) });
        loadLicenses();
      } catch (err) {
        alert(`Gagal: ${err.message}`);
      }
    });

    tr.querySelector('[data-action="revoke"]').addEventListener('click', async () => {
      if (!confirm(`Batalkan lesen ${formatCode(lic.code)}?`)) return;
      await api(`/api/admin/licenses/${lic.code}/revoke`, { method: 'POST' });
      loadLicenses();
    });

    tr.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm(`Padam lesen ${formatCode(lic.code)} sepenuhnya? Ini tidak boleh dibatalkan.`)) return;
      await api(`/api/admin/licenses/${lic.code}`, { method: 'DELETE' });
      loadLicenses();
    });

    tbody.appendChild(tr);
  });
}

function statusLabel(status) {
  return { unused: 'Belum Aktif', active: 'Aktif', expired: 'Tamat Tempoh', revoked: 'Dibatalkan' }[status] || status;
}

function formatCode(code) {
  return code.replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

checkSession();
