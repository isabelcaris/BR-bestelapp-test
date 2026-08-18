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

function timeAgo(ts) {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

let audioCtx = null;
function playBeep() {
  if (!document.getElementById('sound-toggle').checked) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    // audio not available, ignore
  }
}

let knownIds = new Set();
let firstLoad = true;

function orderCard(order, actionsHtml) {
  return `
    <div class="order-card" data-id="${order.id}">
      <div class="stand-name">${escapeHtml(order.standName)}</div>
      <div class="time">${timeAgo(order.createdAt)}</div>
      <ul>${order.items.map((it) => `<li>${it.qty} x ${escapeHtml(it.name)}</li>`).join('')}</ul>
      ${order.note ? `<div class="note">"${escapeHtml(order.note)}"</div>` : ''}
      <div class="actions">${actionsHtml}</div>
    </div>
  `;
}

async function setStatus(id, status) {
  await api(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  refresh();
}
window.setStatus = setStatus;

const lastSignature = { pending: null, preparing: null, delivered: null };

function signatureOf(list) {
  // Bucket the age so the "Xm ago" text still refreshes periodically without
  // rebuilding the whole column (and losing in-flight clicks) every poll.
  const timeBucket = Math.floor(Date.now() / 30000);
  return list.map((o) => `${o.id}:${o.status}:${o.updatedAt}:${timeBucket}`).join('|');
}

function renderColumn(key, elId, list, actionsFn, emptyText) {
  const sig = signatureOf(list);
  if (sig === lastSignature[key]) return;
  lastSignature[key] = sig;
  document.getElementById(elId).innerHTML = list.length
    ? list.map((o) => orderCard(o, actionsFn(o))).join('')
    : `<div class="empty-state">${emptyText}</div>`;
}

async function refresh() {
  let orders;
  try {
    orders = await api('/api/orders');
  } catch (e) {
    return;
  }

  const pending = orders.filter((o) => o.status === 'pending');
  const preparing = orders.filter((o) => o.status === 'preparing');
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const delivered = orders
    .filter((o) => o.status === 'delivered' && o.updatedAt > oneHourAgo)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20);

  if (!firstLoad) {
    const newPending = pending.filter((o) => !knownIds.has(o.id));
    if (newPending.length > 0) playBeep();
  }
  knownIds = new Set(orders.map((o) => o.id));
  firstLoad = false;

  document.getElementById('count-pending').textContent = pending.length;
  document.getElementById('count-preparing').textContent = preparing.length;
  document.getElementById('count-delivered').textContent = delivered.length;

  renderColumn('pending', 'col-pending', pending, (o) => `
    <button onclick="setStatus('${o.id}', 'preparing')">Start preparing</button>
    <button class="secondary" onclick="setStatus('${o.id}', 'delivered')">Mark delivered</button>
    <button class="danger" onclick="setStatus('${o.id}', 'cancelled')">Cancel</button>
  `, 'No pending orders');

  renderColumn('preparing', 'col-preparing', preparing, (o) => `
    <button onclick="setStatus('${o.id}', 'delivered')">Mark delivered</button>
    <button class="danger" onclick="setStatus('${o.id}', 'cancelled')">Cancel</button>
  `, 'Nothing being prepared');

  renderColumn('delivered', 'col-delivered', delivered, () => '', 'Nothing delivered yet');

  document.getElementById('last-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
}

refresh();
setInterval(refresh, 3000);
