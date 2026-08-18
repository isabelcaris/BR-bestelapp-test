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
    cardsEl.innerHTML = '<p class="muted">Nog geen stands toegevoegd. Voeg eerst stands toe op de beheerpagina.</p>';
    return;
  }

  cardsEl.innerHTML = stands.map((s) => `
    <div class="qr-card">
      <img src="/api/stands/${s.id}/qrcode.png" alt="QR-code voor ${escapeHtml(s.name)}" />
      <div class="stand-name">${escapeHtml(s.name)}</div>
      <div class="hint">Scan om drankjes te bestellen</div>
    </div>
  `).join('');
}

main();
