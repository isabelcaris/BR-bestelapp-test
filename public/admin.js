function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- network info ----------

async function loadNetworkInfo() {
  const el = document.getElementById('network-info');
  try {
    const info = await api('/api/server-info');
    const isLocalhost = /^localhost(:\d+)?$/.test(info.currentHost) || info.currentHost.startsWith('127.0.0.1');
    let html = '';
    if (isLocalhost && info.ips.length) {
      html += `<p style="color:var(--danger); font-weight:600;">You're viewing this via localhost - QR codes won't work on phones. Open one of these instead:</p>`;
    } else if (!isLocalhost) {
      html += `<p style="color:var(--success); font-weight:600;">Good - you're on a network address. QR codes generated from here will work on phones on the same wifi.</p>`;
    }
    if (info.ips.length) {
      html += info.ips.map((ip) => `<div><a href="http://${ip}:${info.port}/admin.html">http://${ip}:${info.port}/admin.html</a></div>`).join('');
    } else {
      html += '<p>No network address detected. Make sure this computer is connected to the venue wifi.</p>';
    }
    el.innerHTML = html;
  } catch (e) {
    el.textContent = 'Could not load network info: ' + e.message;
  }
}

// ---------- drinks ----------

async function loadDrinks() {
  const drinks = await api('/api/drinks');
  const list = document.getElementById('drinks-list');
  if (drinks.length === 0) {
    list.innerHTML = '<div class="empty-state">No drinks yet - add your first one above.</div>';
    return;
  }
  list.innerHTML = drinks.map((d) => `
    <div class="drink-list-item" data-id="${d.id}">
      <div>
        <strong>${escapeHtml(d.name)}</strong>
        ${d.price ? `<span class="muted small"> - €${d.price.toFixed(2)}</span>` : ''}
        ${!d.available ? '<span class="badge cancelled">hidden</span>' : ''}
      </div>
      <div class="row">
        <button class="secondary toggle-drink-btn" data-id="${d.id}" data-available="${d.available}">${d.available ? 'Hide' : 'Show'}</button>
        <button class="danger delete-drink-btn" data-id="${d.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.toggle-drink-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const available = btn.dataset.available === 'true';
      await api(`/api/drinks/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ available: !available }) });
      loadDrinks();
    });
  });
  list.querySelectorAll('.delete-drink-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this drink from the menu?')) return;
      await api(`/api/drinks/${btn.dataset.id}`, { method: 'DELETE' });
      loadDrinks();
    });
  });
}

document.getElementById('add-drink-btn').addEventListener('click', async () => {
  const nameEl = document.getElementById('drink-name');
  const priceEl = document.getElementById('drink-price');
  const name = nameEl.value.trim();
  if (!name) return toast('Enter a drink name');
  try {
    await api('/api/drinks', { method: 'POST', body: JSON.stringify({ name, price: priceEl.value }) });
    nameEl.value = '';
    priceEl.value = '';
    loadDrinks();
    toast('Drink added');
  } catch (e) {
    toast(e.message);
  }
});

// ---------- stands ----------

async function loadStands() {
  const stands = await api('/api/stands');
  const list = document.getElementById('stands-list');
  if (stands.length === 0) {
    list.innerHTML = '<div class="empty-state">No stands yet - add your first one above.</div>';
    return;
  }
  list.innerHTML = stands.map((s) => `
    <div class="stand-list-item" data-id="${s.id}">
      <div class="row" style="align-items:center;">
        <img class="qr-thumb" src="/api/stands/${s.id}/qrcode.png" alt="QR for ${escapeHtml(s.name)}" />
        <div>
          <strong>${escapeHtml(s.name)}</strong>
          <div class="muted small"><a href="/order.html?stand=${s.id}" target="_blank">Preview order page</a></div>
        </div>
      </div>
      <div class="row">
        <a href="/api/stands/${s.id}/qrcode.png" download="qr-${escapeHtml(s.name)}.png"><button class="secondary">Download QR</button></a>
        <button class="danger delete-stand-btn" data-id="${s.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.delete-stand-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this stand? Its QR code will stop working.')) return;
      await api(`/api/stands/${btn.dataset.id}`, { method: 'DELETE' });
      loadStands();
    });
  });
}

document.getElementById('add-stand-btn').addEventListener('click', async () => {
  const nameEl = document.getElementById('stand-name');
  const name = nameEl.value.trim();
  if (!name) return toast('Enter a stand name');
  try {
    await api('/api/stands', { method: 'POST', body: JSON.stringify({ name }) });
    nameEl.value = '';
    loadStands();
    toast('Stand added');
  } catch (e) {
    toast(e.message);
  }
});

['drink-name', 'stand-name'].forEach((id) => {
  document.getElementById(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById(id === 'drink-name' ? 'add-drink-btn' : 'add-stand-btn').click();
  });
});

loadNetworkInfo();
loadDrinks();
loadStands();
