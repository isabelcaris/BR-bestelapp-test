function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function main() {
  const cardsEl = document.getElementById('cards');
  const res = await fetch('/api/stands');
  const stands = await res.json();

  if (stands.length === 0) {
    cardsEl.innerHTML = '<p class="muted">No stands added yet. Add stands on the Admin page first.</p>';
    return;
  }

  cardsEl.innerHTML = stands.map((s) => `
    <div class="qr-card">
      <img src="/api/stands/${s.id}/qrcode.png" alt="QR code for ${escapeHtml(s.name)}" />
      <div class="stand-name">${escapeHtml(s.name)}</div>
      <div class="hint">Scan to order drinks</div>
    </div>
  `).join('');
}

main();
