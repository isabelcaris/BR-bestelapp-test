const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'data.json');

function makeId() {
  return crypto.randomBytes(6).toString('hex');
}

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        stands: parsed.stands || [],
        drinks: parsed.drinks || [],
        orders: parsed.orders || [],
      };
    } catch (e) {
      console.error('Could not read data.json, starting fresh:', e.message);
    }
  }
  return {
    stands: [],
    drinks: [
      { id: makeId(), name: 'Water', price: 0, available: true },
      { id: makeId(), name: 'Koffie', price: 0, available: true },
      { id: makeId(), name: 'Cola', price: 0, available: true },
      { id: makeId(), name: 'Sinaasappelsap', price: 0, available: true },
      { id: makeId(), name: 'Bier', price: 0, available: true },
    ],
    orders: [],
  };
}

let db = load();
let saveScheduled = false;

function save() {
  if (saveScheduled) return;
  saveScheduled = true;
  setImmediate(() => {
    saveScheduled = false;
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  });
}

module.exports = { db, save, makeId };
