const AUTH_KEY = 'mumofx_session_v1';
const USERS_KEY = 'mumofx_users_v1';

function safeGet(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function safeSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function generateSalt() {
  return window.crypto.getRandomValues(new Uint8Array(16));
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setStatus(element, message, state) {
  if (!element) return;
  element.textContent = message;
  element.className = 'form-status ' + state;
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.querySelector('[name="name"]').value.trim();
  const email = form.querySelector('[name="email"]').value.trim();
  const password = form.querySelector('[name="password"]').value;
  const status = form.querySelector('.form-status');

  if (!name || !email || !password) {
    setStatus(status, 'Please complete all fields.', 'error');
    return;
  }

  if (!validateEmail(email)) {
    setStatus(status, 'Please enter a valid email address.', 'error');
    return;
  }

  if (password.length < 8) {
    setStatus(status, 'Password should be at least 8 characters long.', 'error');
    return;
  }

  const users = safeGet(USERS_KEY, []);
  if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    setStatus(status, 'An account with this email already exists.', 'error');
    return;
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = {
    name,
    email: email.toLowerCase(),
    passwordHash,
    salt: Array.from(salt),
    createdAt: new Date().toISOString()
  };

  users.push(user);
  safeSet(USERS_KEY, users);

  safeSet(AUTH_KEY, {
    name,
    email: user.email,
    token: crypto.randomUUID(),
    loggedInAt: Date.now()
  });

  setStatus(status, 'Account created. Redirecting...', 'success');
  window.setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 600);
}

async function handleSignin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
  const password = form.querySelector('[name="password"]').value;
  const status = form.querySelector('.form-status');

  const users = safeGet(USERS_KEY, []);
  const match = users.find((user) => user.email === email);

  if (!match) {
    setStatus(status, 'No user found for that email.', 'error');
    return;
  }

  const salt = new Uint8Array(match.salt);
  const hash = await hashPassword(password, salt);

  if (hash !== match.passwordHash) {
    setStatus(status, 'Incorrect password.', 'error');
    return;
  }

  safeSet(AUTH_KEY, {
    name: match.name,
    email: match.email,
    token: crypto.randomUUID(),
    loggedInAt: Date.now()
  });

  setStatus(status, 'Signed in successfully. Redirecting...', 'success');
  window.setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 600);
}

function requireAuth() {
  const session = safeGet(AUTH_KEY, null);
  if (!session) {
    window.location.href = 'signin.html';
    return null;
  }
  return session;
}

function bindAuthForms() {
  const signupForm = document.querySelector('#signupForm');
  if (signupForm) signupForm.addEventListener('submit', handleSignup);

  const signinForm = document.querySelector('#signinForm');
  if (signinForm) signinForm.addEventListener('submit', handleSignin);

  const logoutButton = document.querySelector('#logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem(AUTH_KEY);
      window.location.href = 'signin.html';
    });
  }

  const currentUserEl = document.querySelector('#currentUser');
  const session = safeGet(AUTH_KEY, null);
  if (currentUserEl && session) {
    currentUserEl.textContent = `Logged in as ${session.name}`;
  }

  const sessionStatus = document.querySelector('#sessionStatus');
  if (sessionStatus && session) {
    sessionStatus.textContent = `Authenticated • ${session.email}`;
  }
}

function initMenu() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav-links');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => nav.classList.toggle('open'));
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => nav.classList.remove('open'));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMenu();
  bindAuthForms();

  document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

  const body = document.body;
  if (body?.dataset?.auth === 'required') {
    requireAuth();
  }

  const tpChecks = [...document.querySelectorAll('#tpChecklist input')];
  if (tpChecks.length) {
    const countEl = document.getElementById('tpCount');
    const progressEl = document.getElementById('tpProgress');
    function updateTPProgress() {
      const done = tpChecks.filter((x) => x.checked).length;
      countEl.textContent = `${done}/${tpChecks.length}`;
      progressEl.style.width = `${(done / tpChecks.length) * 100}%`;
    }
    tpChecks.forEach((check) => check.addEventListener('change', updateTPProgress));
    updateTPProgress();
  }

  const btcPrice = document.getElementById('btcPrice');
  if (btcPrice) {
    async function getBTC() {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
        const data = await response.json();
        btcPrice.textContent = '$' + Number(data.price).toLocaleString('en-US', { maximumFractionDigits: 2 });
      } catch (error) {
        btcPrice.textContent = 'Unavailable';
      }
    }
    getBTC();
    setInterval(getBTC, 30000);
  }

  document.querySelectorAll('.filter-button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter-button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const category = button.dataset.filter || 'all';
      document.querySelectorAll('.bot-card').forEach((card) => {
        const visible = category === 'all' || card.dataset.category.includes(category);
        card.style.display = visible ? '' : 'none';
      });
    });
  });

  const botModal = document.getElementById('botModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalLink = document.getElementById('modalWhatsApp');
  if (botModal) {
    document.querySelectorAll('[data-bot]').forEach((button) => {
      button.addEventListener('click', () => {
        const botName = button.dataset.bot;
        modalTitle.textContent = botName;
        modalLink.href = `https://wa.me/254180225832?text=${encodeURIComponent(`Hello MUMOFX, I would like information about ${botName}.`)}`;
        botModal.classList.add('show');
      });
    });

    botModal.addEventListener('click', (event) => {
      if (event.target === botModal) botModal.classList.remove('show');
    });

    const close = document.querySelector('#botModal .modal-close');
    if (close) close.addEventListener('click', () => botModal.classList.remove('show'));
  }
});
