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
      html += `<p style="color:var(--danger); font-weight:600;">Je bekijkt dit via localhost - QR-codes werken zo niet op telefoons. Open in plaats daarvan een van deze adressen:</p>`;
    } else if (!isLocalhost) {
      html += `<p style="color:var(--success); font-weight:600;">Goed zo - je zit op een netwerkadres. QR-codes die hier gegenereerd worden, werken op telefoons met dezelfde wifi.</p>`;
    }
    if (info.ips.length) {
      html += info.ips.map((ip) => `<div><a href="http://${ip}:${info.port}/admin.html">http://${ip}:${info.port}/admin.html</a></div>`).join('');
    } else {
      html += '<p>Geen netwerkadres gevonden. Zorg dat deze computer verbonden is met de wifi van de locatie.</p>';
    }
    el.innerHTML = html;
  } catch (e) {
    el.textContent = 'Kon netwerkinfo niet laden: ' + e.message;
  }
}

// ---------- drinks ----------

async function loadDrinks() {
  const drinks = await api('/api/drinks');
  const list = document.getElementById('drinks-list');
  if (drinks.length === 0) {
    list.innerHTML = '<div class="empty-state">Nog geen drankjes - voeg er hierboven een toe.</div>';
    return;
  }
  list.innerHTML = drinks.map((d) => `
    <div class="drink-list-item" data-id="${d.id}">
      <div>
        <strong>${escapeHtml(d.name)}</strong>
        ${d.price ? `<span class="muted small"> - €${d.price.toFixed(2)}</span>` : ''}
        ${!d.available ? '<span class="badge cancelled">verborgen</span>' : ''}
      </div>
      <div class="row">
        <button class="secondary toggle-drink-btn" data-id="${d.id}" data-available="${d.available}">${d.available ? 'Verbergen' : 'Tonen'}</button>
        <button class="danger delete-drink-btn" data-id="${d.id}">Verwijderen</button>
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
      if (!confirm('Dit drankje van de kaart verwijderen?')) return;
      await api(`/api/drinks/${btn.dataset.id}`, { method: 'DELETE' });
      loadDrinks();
    });
  });
}

document.getElementById('add-drink-btn').addEventListener('click', async () => {
  const nameEl = document.getElementById('drink-name');
  const priceEl = document.getElementById('drink-price');
  const name = nameEl.value.trim();
  if (!name) return toast('Vul een naam in voor het drankje');
  try {
    await api('/api/drinks', { method: 'POST', body: JSON.stringify({ name, price: priceEl.value }) });
    nameEl.value = '';
    priceEl.value = '';
    loadDrinks();
    toast('Drankje toegevoegd');
  } catch (e) {
    toast(e.message);
  }
});

// ---------- stands ----------

async function loadStands() {
  const stands = await api('/api/stands');
  const list = document.getElementById('stands-list');
  if (stands.length === 0) {
    list.innerHTML = '<div class="empty-state">Nog geen stands - voeg er hierboven een toe.</div>';
    return;
  }
  list.innerHTML = stands.map((s) => `
    <div class="stand-list-item" data-id="${s.id}">
      <div class="row" style="align-items:center;">
        <img class="qr-thumb" src="/api/stands/${s.id}/qrcode.png" alt="QR voor ${escapeHtml(s.name)}" />
        <div>
          <strong>${escapeHtml(s.name)}</strong>
          <div class="muted small"><a href="/order.html?stand=${s.id}" target="_blank">Bestelpagina bekijken</a></div>
        </div>
      </div>
      <div class="row">
        <a href="/api/stands/${s.id}/qrcode.png" download="qr-${escapeHtml(s.name)}.png"><button class="secondary">QR downloaden</button></a>
        <button class="danger delete-stand-btn" data-id="${s.id}">Verwijderen</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.delete-stand-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Deze stand verwijderen? De QR-code werkt dan niet meer.')) return;
      await api(`/api/stands/${btn.dataset.id}`, { method: 'DELETE' });
      loadStands();
    });
  });
}

document.getElementById('add-stand-btn').addEventListener('click', async () => {
  const nameEl = document.getElementById('stand-name');
  const name = nameEl.value.trim();
  if (!name) return toast('Vul een naam in voor de stand');
  try {
    await api('/api/stands', { method: 'POST', body: JSON.stringify({ name }) });
    nameEl.value = '';
    loadStands();
    toast('Stand toegevoegd');
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
