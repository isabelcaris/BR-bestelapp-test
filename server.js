const express = require('express');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');
const { db, save, makeId } = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------

function localIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

// ---------- server info ----------

app.get('/api/server-info', (req, res) => {
  res.json({ ips: localIps(), port: PORT, currentHost: req.get('host') });
});

// ---------- stands ----------

app.get('/api/stands', (req, res) => {
  res.json(db.stands);
});

app.get('/api/stands/:id', (req, res) => {
  const stand = db.stands.find((s) => s.id === req.params.id);
  if (!stand) return res.status(404).json({ error: 'Stand not found' });
  res.json(stand);
});

app.post('/api/stands', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const stand = { id: makeId(), name, createdAt: Date.now() };
  db.stands.push(stand);
  save();
  res.status(201).json(stand);
});

app.delete('/api/stands/:id', (req, res) => {
  const before = db.stands.length;
  db.stands = db.stands.filter((s) => s.id !== req.params.id);
  if (db.stands.length === before) return res.status(404).json({ error: 'Stand not found' });
  save();
  res.status(204).end();
});

app.get('/api/stands/:id/qrcode.png', async (req, res) => {
  const stand = db.stands.find((s) => s.id === req.params.id);
  if (!stand) return res.status(404).end();
  const url = `${baseUrl(req)}/order.html?stand=${stand.id}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 320, margin: 2 });
    res.type('png').send(png);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- drinks ----------

app.get('/api/drinks', (req, res) => {
  res.json(db.drinks);
});

app.post('/api/drinks', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const drink = {
    id: makeId(),
    name,
    price: Number(req.body.price) || 0,
    available: true,
  };
  db.drinks.push(drink);
  save();
  res.status(201).json(drink);
});

app.patch('/api/drinks/:id', (req, res) => {
  const drink = db.drinks.find((d) => d.id === req.params.id);
  if (!drink) return res.status(404).json({ error: 'Drink not found' });
  if (typeof req.body.name === 'string') drink.name = req.body.name.trim();
  if (req.body.price !== undefined) drink.price = Number(req.body.price) || 0;
  if (typeof req.body.available === 'boolean') drink.available = req.body.available;
  save();
  res.json(drink);
});

app.delete('/api/drinks/:id', (req, res) => {
  const before = db.drinks.length;
  db.drinks = db.drinks.filter((d) => d.id !== req.params.id);
  if (db.drinks.length === before) return res.status(404).json({ error: 'Drink not found' });
  save();
  res.status(204).end();
});

// ---------- orders ----------

app.get('/api/orders', (req, res) => {
  let orders = db.orders;
  if (req.query.status) orders = orders.filter((o) => o.status === req.query.status);
  if (req.query.since) {
    const since = Number(req.query.since);
    orders = orders.filter((o) => o.updatedAt > since);
  }
  res.json(orders.slice().sort((a, b) => a.createdAt - b.createdAt));
});

app.post('/api/orders', (req, res) => {
  const stand = db.stands.find((s) => s.id === req.body.standId);
  if (!stand) return res.status(400).json({ error: 'Unknown stand' });
  const itemsIn = Array.isArray(req.body.items) ? req.body.items : [];
  const items = itemsIn
    .map((it) => {
      const drink = db.drinks.find((d) => d.id === it.drinkId);
      const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
      if (!drink || qty <= 0) return null;
      return { drinkId: drink.id, name: drink.name, qty };
    })
    .filter(Boolean);
  if (items.length === 0) return res.status(400).json({ error: 'No drinks selected' });

  const note = (req.body.note || '').trim().slice(0, 200);
  const now = Date.now();
  const order = {
    id: makeId(),
    standId: stand.id,
    standName: stand.name,
    items,
    note,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  db.orders.push(order);
  save();
  res.status(201).json(order);
});

const VALID_STATUSES = ['pending', 'preparing', 'delivered', 'cancelled'];

app.patch('/api/orders/:id', (req, res) => {
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!VALID_STATUSES.includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  order.status = req.body.status;
  order.updatedAt = Date.now();
  save();
  res.json(order);
});

app.listen(PORT, () => {
  console.log(`\nJob fair drinks server running on port ${PORT}`);
  console.log(`  On this computer:  http://localhost:${PORT}/admin.html`);
  const ips = localIps();
  if (ips.length) {
    console.log('  On the venue wifi (use this for QR codes to work on phones):');
    ips.forEach((ip) => console.log(`    http://${ip}:${PORT}/admin.html`));
  } else {
    console.log('  Could not detect a LAN IP - make sure this computer is on the venue wifi.');
  }
  console.log('');
});
