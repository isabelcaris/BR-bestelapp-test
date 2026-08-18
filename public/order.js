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

const params = new URLSearchParams(location.search);
const standId = params.get('stand');
const app = document.getElementById('app');
const quantities = {};

function statusLabel(status) {
  return { pending: 'Order received', preparing: 'Being prepared', delivered: 'Delivered', cancelled: 'Cancelled' }[status] || status;
}

async function main() {
  if (!standId) {
    app.innerHTML = '<div class="card"><p>No stand specified. Please scan the QR code at your stand.</p></div>';
    return;
  }

  let stand, drinks;
  try {
    [stand, drinks] = await Promise.all([
      api(`/api/stands/${standId}`),
      api('/api/drinks'),
    ]);
  } catch (e) {
    app.innerHTML = `<div class="card"><p>Could not load this stand's order page: ${escapeHtml(e.message)}</p></div>`;
    return;
  }

  document.getElementById('stand-title').textContent = `🍹 ${stand.name}`;
  drinks = drinks.filter((d) => d.available);
  drinks.forEach((d) => { quantities[d.id] = 0; });

  render(stand, drinks);
}

function render(stand, drinks) {
  if (drinks.length === 0) {
    app.innerHTML = '<div class="card"><p>No drinks are available to order right now.</p></div>';
    return;
  }

  app.innerHTML = `
    <div class="card">
      <h2>Ordering for: ${escapeHtml(stand.name)}</h2>
      <p class="muted small">Pick your drinks and send the order to the bar - someone will bring it to your stand.</p>
      <div id="drinks-form"></div>
      <div style="margin-top:14px;">
        <input type="text" id="note" placeholder="Note for the bar (optional, e.g. 'no ice')" />
      </div>
      <div style="margin-top:16px;">
        <button id="submit-btn" style="width:100%;">Send order</button>
      </div>
    </div>
  `;

  const form = document.getElementById('drinks-form');
  form.innerHTML = drinks.map((d) => `
    <div class="drink-list-item" data-id="${d.id}">
      <div>
        <strong>${escapeHtml(d.name)}</strong>
        ${d.price ? `<span class="muted small"> - €${d.price.toFixed(2)}</span>` : ''}
      </div>
      <div class="row" style="align-items:center;">
        <button class="secondary qty-minus" data-id="${d.id}" style="width:40px;">-</button>
        <span class="qty-value" data-id="${d.id}" style="min-width:24px; text-align:center; font-weight:700;">0</span>
        <button class="secondary qty-plus" data-id="${d.id}" style="width:40px;">+</button>
      </div>
    </div>
  `).join('');

  form.querySelectorAll('.qty-plus').forEach((btn) => {
    btn.addEventListener('click', () => {
      quantities[btn.dataset.id]++;
      updateQtyDisplay(btn.dataset.id);
    });
  });
  form.querySelectorAll('.qty-minus').forEach((btn) => {
    btn.addEventListener('click', () => {
      quantities[btn.dataset.id] = Math.max(0, quantities[btn.dataset.id] - 1);
      updateQtyDisplay(btn.dataset.id);
    });
  });

  document.getElementById('submit-btn').addEventListener('click', () => submitOrder(stand, drinks));
}

function updateQtyDisplay(id) {
  document.querySelector(`.qty-value[data-id="${id}"]`).textContent = quantities[id];
}

async function submitOrder(stand, drinks) {
  const items = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([drinkId, qty]) => ({ drinkId, qty }));

  if (items.length === 0) {
    toast('Select at least one drink');
    return;
  }

  const note = document.getElementById('note').value;
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const order = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ standId: stand.id, items, note }),
    });
    showConfirmation(stand, drinks, order);
  } catch (e) {
    toast(e.message);
    btn.disabled = false;
    btn.textContent = 'Send order';
  }
}

function showConfirmation(stand, drinks, order) {
  app.innerHTML = `
    <div class="card">
      <h2>Order sent!</h2>
      <p>The bar has been notified. Here's what you ordered:</p>
      <ul>
        ${order.items.map((it) => `<li>${it.qty} x ${escapeHtml(it.name)}</li>`).join('')}
      </ul>
      <p><span class="badge pending" id="status-badge">Order received</span></p>
      <button id="new-order-btn" class="secondary" style="margin-top:10px;">Place another order</button>
    </div>
  `;
  document.getElementById('new-order-btn').addEventListener('click', () => render(stand, drinks));
  pollStatus(order.id);
}

async function pollStatus(orderId) {
  const badge = document.getElementById('status-badge');
  if (!badge) return; // user navigated away (placed another order)
  try {
    const orders = await api('/api/orders');
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      badge.textContent = statusLabel(order.status);
      badge.className = `badge ${order.status}`;
      if (order.status === 'delivered' || order.status === 'cancelled') return;
    }
  } catch (e) {
    // ignore transient errors, keep polling
  }
  setTimeout(() => pollStatus(orderId), 4000);
}

main();
