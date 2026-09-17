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

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatus(status, 'Please enter a valid email address.', 'error');
    return;
  }

  if (password.length < 8) {
    setStatus(status, 'Password should be at least 8 characters long.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus(status, payload.message || 'Signup failed.', 'error');
      return;
    }

    setStatus(status, 'Account created. Redirecting...', 'success');
    setTimeout(() => window.location.href = '/dashboard.html', 600);
  } catch (error) {
    setStatus(status, 'Signup failed. Please try again.', 'error');
  }
}

async function handleSignin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.querySelector('[name="email"]').value.trim();
  const password = form.querySelector('[name="password"]').value;
  const status = form.querySelector('.form-status');

  try {
    const response = await fetch('/api/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus(status, payload.message || 'Sign in failed.', 'error');
      return;
    }

    setStatus(status, 'Signed in successfully. Redirecting...', 'success');
    setTimeout(() => window.location.href = '/dashboard.html', 600);
  } catch (error) {
    setStatus(status, 'Sign in failed. Please try again.', 'error');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/signout', { method: 'POST' });
    window.location.href = '/signin.html';
  } catch (error) {
    window.location.href = '/signin.html';
  }
}

async function loadSession() {
  try {
    const response = await fetch('/api/session');
    const data = await response.json();
    if (!data.authenticated) return null;

    const currentUserEl = document.querySelector('#currentUser');
    const sessionStatus = document.querySelector('#sessionStatus');
    if (currentUserEl) currentUserEl.textContent = data.user.name;
    if (sessionStatus) sessionStatus.textContent = `Authenticated • ${data.user.email}`;

    return data.user;
  } catch (error) {
    return null;
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

function renderLineChart(svgId, points, color = '#00e5ff') {
  const svg = document.getElementById(svgId);
  if (!svg || !points || !points.length) return;

  const width = 500;
  const height = 180;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const path = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 20) - 10;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  svg.innerHTML = `
    <defs>
      <linearGradient id="${svgId}-fill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.4"></stop>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.05"></stop>
      </linearGradient>
    </defs>
    <path d="${path} L ${width} ${height} L 0 ${height} Z" fill="url(#${svgId}-fill)" opacity="0.8"></path>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
  `;
}

async function loadMarketData() {
  try {
    const response = await fetch('/api/market/overview');
    const data = await response.json();
    const rows = data.symbols || [];
    const tableBody = document.getElementById('marketTableBody');
    if (tableBody) {
      tableBody.innerHTML = rows.map((symbol) => `
        <tr>
          <td class="symbol">${symbol.symbol}</td>
          <td>${Number(symbol.price).toLocaleString(undefined, { maximumFractionDigits: symbol.symbol.includes('/') ? 4 : 2 })}</td>
          <td class="${symbol.changePct >= 0 ? 'up' : 'down'}">${symbol.changePct >= 0 ? '+' : ''}${symbol.changePct.toFixed(2)}%</td>
          <td class="${symbol.changePct >= 0 ? 'up' : 'down'}">${symbol.changePct >= 0 ? 'Bullish' : 'Bearish'}</td>
        </tr>
      `).join('');
    }

    const averageChange = rows.reduce((total, item) => total + Number(item.changePct || 0), 0) / Math.max(rows.length, 1);
    const sentimentValue = Math.max(0, Math.min(100, Math.round(50 + averageChange * 2.5)));
    const marketSentiment = document.getElementById('marketSentiment');
    const marketSentimentText = document.getElementById('marketSentimentText');
    const volatilityStatus = document.getElementById('volatilityStatus');

    if (marketSentiment) marketSentiment.textContent = `${sentimentValue}%`;
    if (marketSentimentText) marketSentimentText.textContent = averageChange >= 0 ? '▲ Live bullish pressure' : '▼ Live bearish pressure';
    if (volatilityStatus) volatilityStatus.textContent = Math.abs(averageChange) > 1 ? 'High' : 'Moderate';

    const btcChartData = await fetch('/api/market/chart?symbol=BTCUSDT&interval=1h&limit=24').then((res) => res.json());
    const ethChartData = await fetch('/api/market/chart?symbol=ETHUSDT&interval=1h&limit=24').then((res) => res.json());
    renderLineChart('btcChart', (btcChartData.points || []).map((point) => point.close), '#00e5ff');
    renderLineChart('ethChart', (ethChartData.points || []).map((point) => point.close), '#8b5cf6');
  } catch (error) {
    const tableBody = document.getElementById('marketTableBody');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="4">Live market feed unavailable.</td></tr>';
    }
    const marketSentimentText = document.getElementById('marketSentimentText');
    if (marketSentimentText) marketSentimentText.textContent = '● Feed unavailable';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initMenu();
  document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

  const signupForm = document.querySelector('#signupForm');
  if (signupForm) signupForm.addEventListener('submit', handleSignup);

  const signinForm = document.querySelector('#signinForm');
  if (signinForm) signinForm.addEventListener('submit', handleSignin);

  const logoutButton = document.querySelector('#logoutButton');
  if (logoutButton) logoutButton.addEventListener('click', handleLogout);

  const body = document.body;
  if (body?.dataset?.auth === 'required') {
    const session = await loadSession();
    if (!session) {
      window.location.href = '/signin.html';
      return;
    }
  }

  if (document.getElementById('marketTableBody')) {
    await loadMarketData();
    setInterval(loadMarketData, 30000);
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
