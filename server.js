const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'mumofx-dev-secret';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@mumofx.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MumofxAdmin@2026!';
const DATA_DIR = path.join(__dirname, '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]), 'utf8');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  extensions: ['html']
}));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function ensureAdminUser() {
  const users = readUsers();
  const admin = users.find((user) => user.email === ADMIN_EMAIL);
  if (admin) return;

  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  users.push({
    id: `admin-${Date.now()}`,
    name: 'System Administrator',
    email: ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
    createdAt: new Date().toISOString()
  });

  writeUsers(users);
}

ensureAdminUser();

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/signin.html');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

app.get('/api/market/overview', async (req, res) => {
  try {
    const [btc, eth, fxRates] = await Promise.all([
      fetchJson('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
      fetchJson('https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT'),
      fetchJson('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY')
    ]);

    res.json({
      symbols: [
        { symbol: 'BTC/USD', price: Number(btc.lastPrice), changePct: Number(btc.priceChangePercent), source: 'Binance' },
        { symbol: 'ETH/USD', price: Number(eth.lastPrice), changePct: Number(eth.priceChangePercent), source: 'Binance' },
        { symbol: 'EUR/USD', price: Number(fxRates.rates.EUR), changePct: 0, source: 'Frankfurter' },
        { symbol: 'GBP/USD', price: Number(fxRates.rates.GBP), changePct: 0, source: 'Frankfurter' },
        { symbol: 'USD/JPY', price: Number(fxRates.rates.JPY), changePct: 0, source: 'Frankfurter' }
      ]
    });
  } catch (error) {
    res.status(502).json({ message: 'Unable to fetch live market data.', error: error.message });
  }
});

app.get('/api/market/chart', async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '1h', limit = 24 } = req.query;

  try {
    const data = await fetchJson(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${Number(limit)}`);
    const points = data.map((entry) => ({
      time: entry[0],
      open: Number(entry[1]),
      high: Number(entry[2]),
      low: Number(entry[3]),
      close: Number(entry[4]),
      volume: Number(entry[5])
    }));

    res.json({ symbol, interval, points });
  } catch (error) {
    res.status(502).json({ message: 'Unable to fetch live chart data.', error: error.message });
  }
});

app.get('/api/session', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: {
      id: req.session.user.id,
      name: req.session.user.name,
      email: req.session.user.email,
      role: req.session.user.role
    }
  });
});

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
  if (!validEmail) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  const users = readUsers();
  const normalizedEmail = String(email).trim().toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  const newUser = {
    id: `user-${Date.now()}`,
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'member',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeUsers(users);

  req.session.user = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role
  };

  res.status(201).json({
    message: 'Account created successfully.',
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    }
  });
});

app.post('/api/signin', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const users = readUsers();
  const user = users.find((entry) => entry.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const passwordMatches = await bcrypt.compare(String(password), user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'member'
  };

  res.json({
    message: 'Signed in successfully.',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'member'
    }
  });
});

app.post('/api/signout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Signed out successfully.' });
  });
});

app.post('/api/reset-demo', requireAuth, requireAdmin, async (req, res) => {
  const users = readUsers();
  const admins = users.filter((user) => user.email.toLowerCase() === ADMIN_EMAIL);
  const admin = admins[0] || {
    id: `admin-${Date.now()}`,
    name: 'System Administrator',
    email: ADMIN_EMAIL,
    passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 12),
    role: 'admin',
    createdAt: new Date().toISOString()
  };

  const cleanUsers = [admin];
  writeUsers(cleanUsers);

  res.json({
    message: 'Demo member data reset. Only the admin account remains.',
    users: cleanUsers.map(({ id, name, email, role, createdAt }) => ({ id, name, email, role, createdAt }))
  });
});

app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const users = readUsers().map(({ id, name, email, role, createdAt }) => ({ id, name, email, role, createdAt }));
  res.json({ users });
});

app.get('/admin.html', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/signin.html', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard.html');
  }
  res.sendFile(path.join(__dirname, 'signin.html'));
});

app.get('/signup.html', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard.html');
  }
  res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MUMOFX app running on http://localhost:${PORT}`);
});
