import { databasePage } from './database.js';

const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const dialog = $('#modal');
const state = { user: null, csrf: '', data: null, page: 'overview', filter: 'All', search: '', authMode: 'login', role: 'student', modal: null, booking: null, busy: false, pollError: false, database: null, dbTable: 'student', dbPage: 1, dbLoading: false, dbError: '' };
let renderedSignature = '';
const dashboardSignature = () => JSON.stringify({ ...state.data, server_time: state.data.server_time.slice(0, 10), connectionPaused: state.pollError, database: state.page === 'database' ? state.database : null, databaseLoading: state.page === 'database' && state.dbLoading });
const paths = {
  drop: '<path d="M12 3C9.5 7.7 5 10.8 5 15a7 7 0 0 0 14 0c0-4.2-4.5-7.3-7-12Z"/><path d="M8.5 15a3.5 3.5 0 0 0 3.5 3.5"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2"/>',
  wallet: '<path d="M20 8H5a2 2 0 0 1-2-2m0 0a2 2 0 0 1 2-2h13v4M3 6v13a2 2 0 0 0 2 2h15V8m0 5h-5v4h5"/><path d="M16 15h.01"/>',
  sparkle: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6Z"/>',
  broom: '<path d="m17 3-7 10m-3 0 6 4 3-5-6-4m-3 5-4 5 7 4 3-5m-7 1 3 2"/>',
  leaf: '<path d="M20 4c-9-1-16 2-16 9a7 7 0 0 0 7 7c7 0 10-7 9-16ZM4 20 15 9"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  users: '<path d="M16 21v-2a6 6 0 0 0-12 0v2m16 0v-2a6 6 0 0 0-3-5.2"/><circle cx="10" cy="6" r="4"/><path d="M17 2a4 4 0 0 1 0 8"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-11 9a3 3 0 0 0 6 0"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 3m0 3h.01"/>',
  logout: '<path d="M9 4H4v16h5m5-4 4-4-4-4m-7 4h11"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m3 3 18 18M10.5 5.1 12 5c6 0 10 7 10 7a21 21 0 0 1-3 4M6.5 6.5C3.5 9 2 12 2 12s4 7 10 7a12 12 0 0 0 5.5-1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 2M4 17l2 2a8 8 0 0 0 13-2"/>',
  building: '<path d="M4 21V3h16v18M2 21h20M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.sparkle}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);
const rupees = value => `₹${money(value)}`;
const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const toDate = raw => new Date(String(raw).replace(' ', 'T') + (/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? '' : '+05:30'));
const fmt = (raw, options) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...options }).format(toDate(raw));
const dateText = raw => fmt(raw.length === 10 ? `${raw}T12:00:00` : raw, { day: 'numeric', month: 'short', year: 'numeric' });
const timeText = raw => fmt(raw, { hour: 'numeric', minute: '2-digit', hour12: true });
const slotText = time => timeText(`2026-01-01T${time}:00`);
const today = () => (state.data?.server_time || new Date(Date.now() + 19800000).toISOString()).slice(0, 10);
const addDays = (day, number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + number); return date.toISOString().slice(0, 10); };
const isStaff = () => state.user?.role === 'staff';
const activeBookings = () => (state.data?.bookings || []).filter(b => ['Assigned', 'In Progress'].includes(b.status)).sort((a, b) => a.scheduled_start_time.localeCompare(b.scheduled_start_time));
const serviceIcon = service => service.price >= 100 ? 'sparkle' : service.price > 50 ? 'leaf' : 'broom';
const statusClass = status => ({ Assigned: 'assigned', 'In Progress': 'progress', Completed: 'completed', Cancelled: 'cancelled' }[status] || 'neutral');
const badge = status => `<span class="pill ${statusClass(status)}">${esc(status === 'Assigned' ? 'Scheduled' : status)}</span>`;
const brand = () => `<a class="brand" href="#overview" aria-label="Tidy home"><span class="brand-mark">${icon('drop')}</span><div><div class="brand-word">tidy</div><div class="brand-subtitle">a little room care</div></div></a>`;
const waterArt = () => `<div class="hero-art" aria-hidden="true"><div class="water-shadow"></div><div class="water-orbit second"></div><div class="water-orbit"></div><div class="glass-drop"></div><div class="glass-drop small"></div><span class="art-spark">${icon('sparkle')}</span><div class="glass-label">${icon('checkCircle')} a fresh start, every time</div></div>`;
const btn = (label, action, type = 'primary', extra = '', iconName = '') => {
  const moreClasses = extra.match(/class="([^"]*)"/)?.[1] || '';
  return `<button class="btn btn-${type} ${moreClasses}" data-action="${action}" ${extra.replace(/class="[^"]*"/, '')}>${iconName ? icon(iconName) : ''}${label}</button>`;
};
const empty = (title, description, iconName = 'sparkle', action = '', compact = false) => `<div class="empty-state ${compact ? 'compact' : ''}"><div class="empty-icon">${icon(iconName)}</div><h3>${title}</h3><p>${description}</p>${action}</div>`;

async function api(path, data) {
  let response;
  try {
    response = await fetch(`/api${path}`, { method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(data === undefined ? {} : { 'X-CSRF-Token': state.csrf }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  } catch { throw new Error('We couldn’t reach the room desk. Check that the local server is running and try again.'); }
  const result = await response.json().catch(() => ({ message: 'Something went wrong. Please try again.' }));
  if (response.status === 401 && state.user) {
    state.user = null; state.data = null; dialog.close(); state.modal = null; state.booking = null; renderAuth();
  }
  if (!response.ok) throw new Error(result.message || 'Something went wrong. Please try again.');
  if (result.csrf_token) state.csrf = result.csrf_token;
  return result;
}

function toast(message, error = false) {
  const region = $('#toast-region');
  const item = document.createElement('div');
  item.className = `toast${error ? ' error' : ''}`;
  item.innerHTML = `${icon(error ? 'info' : 'checkCircle')}<span>${esc(message)}</span><button aria-label="Dismiss notification">${icon('close')}</button>`;
  item.querySelector('button').addEventListener('click', () => item.remove());
  region.replaceChildren(item);
  setTimeout(() => item.remove(), 6500);
}

function renderAuth() {
  const register = state.authMode === 'register';
  app.innerHTML = `<div class="auth-screen ${register ? 'auth-register' : ''}">
    <aside class="auth-story"><div class="story-ring"></div><div class="story-ring second"></div>${brand()}
      <div class="auth-story-copy"><div class="eyebrow">Your room. Your little retreat.</div><h1>Less mess.<br>More room<br><em>for you.</em></h1><p>Between lectures, late nights and everything in between, leave a little room for clean.</p></div>
      ${waterArt()}<div class="auth-story-foot">${icon('leaf')} Made for hostel life. A fresher everyday.</div>
    </aside>
    <main class="auth-main" id="main-content"><div class="auth-form-wrap">
      <div class="eyebrow">VIT hostel room care</div><h2>${register ? 'Make yourself at home.' : 'Welcome back.'}</h2>
      <p class="muted">${register ? 'Create your account and give your room a fresh start.' : 'A clean room is one less thing to think about.<br>Let’s get you settled in.'}</p>
      ${!register ? `<div class="auth-tabs" aria-label="Account type"><button data-action="auth-role" data-role="student" class="${state.role === 'student' ? 'active' : ''}" aria-pressed="${state.role === 'student'}">Student</button><button data-action="auth-role" data-role="staff" class="${state.role === 'staff' ? 'active' : ''}" aria-pressed="${state.role === 'staff'}">Hostel staff</button></div>` : ''}
      <form id="auth-form"><div id="auth-error" class="inline-error" role="alert"></div>
        ${register ? `<div class="field-row"><div class="field"><label for="full-name">Full name</label><input id="full-name" name="name" autocomplete="name" placeholder="Your full name" maxlength="70" minlength="2" required></div><div class="field"><label for="reg-number">Registration number</label><input id="reg-number" name="reg_no" autocomplete="off" placeholder="e.g. 24BCE1234" pattern="[a-zA-Z0-9]{6,15}" maxlength="15" required></div></div>` : ''}
        <div class="field"><label for="email">${state.role === 'staff' && !register ? 'Staff email' : 'VIT email address'}</label><input id="email" name="email" type="email" autocomplete="username" placeholder="${state.role === 'staff' && !register ? 'staff@vit.ac.in' : 'you@vit.ac.in'}" maxlength="200" required></div>
        <div class="field"><label for="password">${register ? 'Create a password' : 'Password'}</label><div class="password-wrap"><input id="password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="${register ? 'At least 8 characters' : 'Enter your password'}" minlength="${register ? 8 : 1}" maxlength="256" required><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Show password">${icon('eye')}</button></div></div>
        ${register ? `<div class="field-row"><div class="field"><label for="block">Hostel block</label><select id="block" name="block_id" required><option value="">Choose block</option></select></div><div class="field"><label for="room-number">Room number</label><input id="room-number" name="room_number" type="number" min="1" max="9999" placeholder="e.g. 305" required></div></div><div class="field"><label for="join-code">Room code <span class="muted">· if a roommate is already registered</span></label><input id="join-code" name="join_code" placeholder="Ask your roommate, or leave blank for a new room" maxlength="30" autocomplete="off"><small>New rooms get a shared wallet and a private invite code.</small></div>` : ''}
        <button type="submit" class="btn btn-primary btn-full">${register ? 'Create account' : 'Sign in'}${icon('arrow')}</button>
      </form>
      <p class="auth-switch">${register ? 'Already have an account?' : 'New to Tidy?'} <button data-action="auth-mode">${register ? 'Sign in' : 'Create an account'}</button></p>
      ${!register ? `<div class="demo-login">${btn(`Explore the ${state.role === 'staff' ? 'staff' : 'student'} demo`, 'demo-login', 'secondary', 'class="btn-full"', 'sparkle')}<p>No setup needed. Demo password: <strong>pass123</strong><br>${state.role === 'staff' ? 'staff@vit.ac.in' : 'pradyun@vit.ac.in'}</p></div>` : ''}
      <p class="auth-note">Local prototype for VIT hostel life.<br>${register ? 'Accounts are local. Campus identity verification is not connected.' : 'Demo credits only. No real payments.'}</p>
    </div></main></div>`;
  if (register) api('/blocks').then(result => {
    if ($('#block')) $('#block').innerHTML += result.blocks.map(b => `<option value="${b.block_id}">${esc(b.block_name)}</option>`).join('');
  }).catch(error => showFormError('auth-error', error));
}

function showFormError(id, error) {
  const container = document.getElementById(id);
  if (container) { container.className = 'inline-error error-box'; container.textContent = error.message; container.scrollIntoView({ block: 'nearest' }); }
  else toast(error.message, true);
}

async function signIn(data, register = false) {
  if (state.busy) return;
  state.busy = true;
  const submit = $('#auth-form button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = register ? 'Creating your account…' : 'Signing you in…'; }
  try {
    const result = await api(register ? '/register' : '/login', data);
    state.user = result.user; state.page = 'overview'; state.filter = 'All'; state.search = '';
    history.replaceState(null, '', '#overview');
    await loadDashboard();
    window.scrollTo({ top: 0 });
  } catch (error) { showFormError('auth-error', error); }
  finally {
    state.busy = false;
    if (submit?.isConnected) { submit.disabled = false; submit.innerHTML = `${register ? 'Create account' : 'Sign in'}${icon('arrow')}`; }
  }
}

const pageNames = { overview: 'Overview', requests: 'My requests', wallet: 'Room wallet', room: 'My room', help: 'Help & FAQs', team: 'Care team', database: 'Database demo' };
function renderApp() {
  if (!state.user || !state.data) return;
  const staff = isStaff(), data = state.data;
  const pages = staff ? [['overview', 'grid', 'Overview'], ['requests', 'calendar', 'All requests'], ['team', 'users', 'Care team'], ['database', 'database', 'Database demo']] : [['overview', 'grid', 'Overview'], ['requests', 'calendar', 'My requests'], ['wallet', 'wallet', 'Room wallet'], ['room', 'home', 'My room']];
  if (![...pages.map(p => p[0]), 'help'].includes(state.page)) state.page = 'overview';
  const name = state.page === 'requests' && staff ? 'All requests' : pageNames[state.page];
  app.innerHTML = `<div class="app-shell"><div class="sidebar-overlay" data-action="close-menu"></div><aside class="sidebar" aria-label="Main navigation">${brand()}
    <div class="nav-section"><div class="nav-caption">${staff ? 'Hostel desk' : 'Your space'}</div><nav>${pages.map(([page, i, label]) => `<a href="#${page}" class="nav-item ${state.page === page ? 'active' : ''}" ${state.page === page ? 'aria-current="page"' : ''}>${icon(i)}${label}${page === 'requests' && activeBookings().length ? `<span class="nav-count">${activeBookings().length}</span>` : ''}</a>`).join('')}</nav></div>
    ${staff ? `<div class="sidebar-room"><div class="eyebrow">A little team care</div><h3>Good spaces.<br>Better days.</h3><p>Keep every room feeling like home.</p></div>` : `<div class="sidebar-room"><div class="eyebrow">Your little corner</div><h3>${esc(data.room.block_name)} · ${data.room.room_number}</h3><p>Floor ${data.room.floor} · ${data.room.beds}-sharing room</p><div class="avatar-stack">${data.roommates.slice(0, 3).map(r => `<span class="avatar" title="${esc(r.name)}">${initials(r.name)}</span>`).join('')}<small>${data.roommates.length} ${data.roommates.length === 1 ? 'resident' : 'roommates'}</small></div></div>`}
    <div class="sidebar-bottom"><a href="#help" class="nav-item ${state.page === 'help' ? 'active' : ''}" ${state.page === 'help' ? 'aria-current="page"' : ''}>${icon('help')}Help & FAQs</a><button class="nav-item" data-action="logout">${icon('logout')}Sign out</button><div class="sidebar-foot"><span>A little care goes a long way.</span>Made for VIT hostel life.</div></div>
  </aside><header class="topbar"><div class="row"><button class="icon-button mobile-menu" data-action="open-menu" aria-label="Open navigation">${icon('menu')}</button><div class="breadcrumb"><span>${staff ? 'Hostel care' : 'My space'}</span>${icon('chevron')}<strong>${name}</strong></div></div><div class="topbar-right"><span class="local-chip"><span class="live-dot"></span>Local preview</span><span class="room-pill">${icon(staff ? 'shield' : 'building')}${staff ? 'Staff console' : `${esc(data.room.block_name)} · ${data.room.room_number}`}</span><button class="icon-button" data-action="notifications" aria-label="Activity notifications${unreadCount() ? `, ${unreadCount()} unread` : ''}">${icon('bell')}${unreadCount() ? '<span class="notification-dot"></span>' : ''}</button><button class="avatar" data-action="profile" aria-label="${esc(state.user.name)}, view account">${initials(state.user.name)}</button></div></header>
    <main class="main" id="main-content" tabindex="-1">${state.pollError ? '<div class="poll-error" role="status">Updates paused. We’ll reconnect automatically, or you can refresh the page.</div>' : ''}${renderPage()}<footer class="app-footer"><span class="row">${icon('drop')} a little room care, a lot more headspace.</span><span>Local prototype · Demo credits only</span></footer></main></div>`;
  document.title = `${name} · Tidy`;
  renderedSignature = dashboardSignature();
}

function intro(title, subtitle, action = '') {
  return `<div class="page-intro spread"><div><h1>${title}</h1><p>${subtitle}</p></div>${action || `<div class="date-label">${icon('calendar')}${fmt(`${today()}T12:00:00`, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>`}</div>`;
}
function stat(label, value, foot, i, shade = '') {
  return `<div class="stat-card"><div class="stat-icon ${shade}">${icon(i)}</div><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div></div>`;
}
function renderPage() {
  if (state.page === 'overview') return isStaff() ? staffOverview() : overview();
  if (state.page === 'requests') return requestsPage();
  if (state.page === 'wallet') return walletPage();
  if (state.page === 'room') return roomPage();
  if (state.page === 'team') return teamPage();
  if (state.page === 'database') return databasePage(state.database, state.dbLoading, state.dbError, { esc, icon, btn });
  return helpPage();
}

function overview() {
  const data = state.data, active = activeBookings(), completed = data.bookings.filter(b => b.status === 'Completed');
  const next = active[0];
  return `${intro(`A little fresher, ${esc(state.user.name.split(' ')[0])}.`, 'Your room, taken care of. So you can get on with your day.')}
    <section class="hero" aria-label="Book room care"><div class="hero-copy"><div class="eyebrow">Room care, on your terms</div><h2>Less mess.<br>More room <em>for you.</em></h2><p>Give your space a little reset.<br>Book a clean, and leave the rest to us.</p><div class="row">${btn('Book a cleaning', 'new-booking', 'primary', '', 'plus')}<span class="hero-note">From ₹50 · made for hostel life</span></div></div>${waterArt()}</section>
    <section class="stats-grid" aria-label="Room at a glance">${stat('Upcoming cleanings', active.length.toString().padStart(2, '0'), active.length ? 'A fresher room is on its way' : 'A fresh start is a tap away', 'calendar')}${stat('Room wallet', `₹${money(data.room.room_balance)}`, 'Shared with your roommates', 'wallet', 'blue')}${stat('Fresh starts', completed.length.toString().padStart(2, '0'), 'Completed room cleanings', 'sparkle', 'peach')}</section>
    <div class="section-heading"><div><h2>A clean for every kind of day.</h2><p>A quick refresh or a proper reset. You choose.</p></div><span class="section-label">Our services</span></div>
    <section class="service-grid" aria-label="Cleaning services">${data.services.map(service => `<article class="service-card ${service.price === 90 ? 'recommended' : ''}">${service.price === 90 ? '<span class="service-badge">The sweet spot</span>' : ''}<div class="service-icon">${icon(serviceIcon(service))}</div><h3>${esc(service.type_name)}</h3><p class="description">${esc(service.description)}</p><div class="spread"><div class="service-price">${rupees(service.price)}<small>/ ${service.duration} min</small></div><button class="circle-arrow" data-action="new-booking" data-id="${service.type_id}" aria-label="Book ${esc(service.type_name)}">${icon('arrow')}</button></div></article>`).join('')}</section>
    <div class="two-columns"><section class="panel"><div class="panel-heading"><h2>Your next little reset</h2>${next ? badge(next.status) : '<span class="pill neutral">All clear</span>'}</div>${next ? `<div class="next-booking"><div class="date-tile"><small>${fmt(next.scheduled_start_time, { month: 'short' })}</small><strong>${fmt(next.scheduled_start_time, { day: 'numeric' })}</strong></div><div><h3>${esc(next.type_name)}</h3><p>${timeText(next.scheduled_start_time)} · ${next.duration} minutes</p><p>with ${esc(next.cleaner_name || 'your care team')}</p></div></div><div class="booking-bottom"><span>Request #${String(next.booking_id).padStart(4, '0')}</span><button class="link-button" data-action="details" data-id="${next.booking_id}">View request ${icon('arrow')}</button></div>` : `<div class="empty-next"><div class="empty-icon">${icon('calendar')}</div><div><h3>Room for a fresh start.</h3><p>No cleanings lined up yet. Find a time that fits around your day.</p></div></div><div class="booking-bottom"><span>9:00 am–6:00 pm, every day</span><button class="link-button" data-action="new-booking">Find a slot ${icon('arrow')}</button></div>`}</section>
    <section class="panel wallet-mini"><div class="panel-heading"><h2>A shared space. A shared wallet.</h2>${icon('wallet')}</div><div class="wallet-amount"><span>₹</span>${money(data.room.room_balance)}</div><p>Your room balance · ${data.roommates.length} residents</p>${btn('Add demo credits', 'topup', 'secondary', 'class="btn-small"', 'plus')}</section></div>
    <div class="section-heading"><h2>Room activity</h2><a class="link-button" href="#requests">See all requests ${icon('arrow')}</a></div>
    ${data.bookings.length ? bookingTable(data.bookings.slice(0, 4)) : `<div class="table-wrap">${empty('Your room’s story starts here.', 'Your cleaning requests and updates will show up right here.', 'leaf', '', true)}</div>`}
    <div class="room-tip">${icon('leaf')}<p><strong>A little tip for a better clean.</strong> Clear your desk and keep valuables tucked away before your cleaner arrives.</p></div>`;
}

function bookingTable(bookings) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Service</th><th>${isStaff() ? 'Room' : 'Date & time'}</th><th>${isStaff() ? 'Date & time' : 'Roommate'}</th><th>Status</th><th>Amount</th><th><span class="muted">Details</span></th></tr></thead><tbody>${bookings.map(b => `<tr><td><div class="service-cell"><div class="tiny-icon">${icon(serviceIcon({ price: b.amount_charged }))}</div><div><strong>${esc(b.type_name)}</strong><small>#${String(b.booking_id).padStart(4, '0')} · ${b.duration} min</small></div></div></td><td>${isStaff() ? `${esc(b.block_name)} · ${b.room_number}` : `${dateText(b.scheduled_start_time)}<small>${timeText(b.scheduled_start_time)}</small>`}</td><td>${isStaff() ? `${dateText(b.scheduled_start_time)}<small>${timeText(b.scheduled_start_time)}</small>` : `${esc(b.student_name.split(' ')[0])}${b.reg_no === state.user.reg_no ? '<small>You booked this</small>' : '<small>Your roommate</small>'}`}</td><td>${badge(b.status)}</td><td>${rupees(b.amount_charged)}</td><td><button class="link-button" data-action="details" data-id="${b.booking_id}" aria-label="View request ${b.booking_id}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>`;
}

function requestsPage() {
  const staff = isStaff();
  return `${intro(staff ? 'A little care, room by room.' : 'Your room, on the record.', staff ? 'Manage requests, follow the schedule and keep things moving.' : 'Upcoming resets, completed cleans and every little update in between.', staff ? btn('Refresh', 'refresh', 'secondary', '', 'refresh') : btn('Book a cleaning', 'new-booking', 'primary', '', 'plus'))}
    <div class="filter-bar"><div class="filter-tabs" aria-label="Filter requests">${['All', 'Upcoming', 'In progress', 'Completed', 'Cancelled'].map(f => `<button data-action="filter" data-filter="${f}" class="${state.filter === f ? 'active' : ''}" aria-pressed="${state.filter === f}">${f}</button>`).join('')}</div><div class="search-wrap">${icon('search')}<input class="input" id="request-search" type="search" aria-label="Search requests" placeholder="${staff ? 'Search room, service or resident…' : 'Search service or request ID…'}" value="${esc(state.search)}"></div></div><div id="request-results">${requestResults()}</div>`;
}
function requestResults() {
  const mapped = { Upcoming: 'Assigned', 'In progress': 'In Progress', Completed: 'Completed', Cancelled: 'Cancelled' };
  let list = state.data.bookings.filter(b => state.filter === 'All' || b.status === mapped[state.filter]);
  const query = state.search.trim().toLowerCase();
  if (query) list = list.filter(b => `${b.type_name} ${b.booking_id} ${String(b.booking_id).padStart(4, '0')} ${b.block_name} ${b.room_number} ${b.student_name} ${b.cleaner_name}`.toLowerCase().includes(query));
  if (state.filter === 'Upcoming') list.sort((a, b) => a.scheduled_start_time.localeCompare(b.scheduled_start_time));
  return `<div class="results-label" aria-live="polite">${list.length} ${list.length === 1 ? 'request' : 'requests'}${state.filter !== 'All' ? ` · ${state.filter.toLowerCase()}` : ''}</div>${list.length ? `<div class="request-list">${list.map(requestCard).join('')}</div>` : `<div class="panel">${empty(query ? 'No requests found.' : state.filter === 'All' ? 'A clean slate. Literally.' : 'Nothing here just yet.', query ? 'Try another service name, room number or request ID.' : state.filter === 'All' ? 'Book your first cleaning and we’ll take it from here.' : 'Your requests will appear here when their status matches this filter.', 'calendar', !query && !isStaff() && state.filter === 'All' ? btn('Find a slot', 'new-booking', 'primary', '', 'plus') : '')}</div>`}`;
}
function canStaffStart(b) {
  return Boolean(b.can_start);
}
function staffStartButton(b, small = false) {
  const scheduled = canStaffStart(b), demo = !scheduled && state.data.demo_mode;
  return btn(scheduled ? 'Start cleaning' : demo ? 'Start now · demo' : 'Start cleaning', 'staff-status', scheduled ? 'primary' : 'secondary',
    `data-id="${b.booking_id}" data-status="In Progress" ${demo ? 'data-demo="true" title="Local presentation: starts this saved request now without dispatching a cleaner"' : ''} ${small ? 'class="btn-small"' : ''} ${!scheduled && !demo ? 'disabled title="Available on the scheduled day, 15 minutes before the slot"' : ''}`, 'broom');
}
function requestCard(b) {
  const staff = isStaff();
  return `<article class="request-card"><div class="request-card-top"><div class="request-title"><div class="stat-icon">${icon(serviceIcon({ price: b.amount_charged }))}</div><div><h3>${esc(b.type_name)}</h3><p>#${String(b.booking_id).padStart(4, '0')} · ${staff ? `${esc(b.block_name)} · Room ${b.room_number}` : `Booked by ${b.reg_no === state.user.reg_no ? 'you' : esc(b.student_name.split(' ')[0])}`}</p></div></div>${badge(b.status)}</div>
    <div class="request-meta"><div class="meta-item">${icon('calendar')}<div><span>Scheduled for</span><strong>${dateText(b.scheduled_start_time)}</strong></div></div><div class="meta-item">${icon('clock')}<div><span>Time · IST</span><strong>${timeText(b.scheduled_start_time)} · ${b.duration} min</strong></div></div><div class="meta-item">${icon('user')}<div><span>Your care team</span><strong>${esc(b.cleaner_name || 'Not assigned')}</strong></div></div><div class="request-card-actions">${b.rating ? `<span class="rating-display" aria-label="Rated ${b.rating} out of 5">${'★'.repeat(b.rating)}${'☆'.repeat(5 - b.rating)}</span>` : !staff && b.status === 'Completed' ? btn('Rate your clean', 'feedback', 'secondary', `data-id="${b.booking_id}" class="btn-small"`, 'star') : ''}${staff && b.status === 'Assigned' ? staffStartButton(b, true) : ''}${staff && b.status === 'In Progress' ? btn('Mark complete', 'staff-status', 'primary', `data-id="${b.booking_id}" data-status="Completed" class="btn-small"`, 'check') : ''}${btn('View details', 'details', 'secondary', `data-id="${b.booking_id}" class="btn-small"`)}</div></div>${b.notes && staff ? `<p class="notes-preview">Note: ${esc(b.notes)}</p>` : ''}</article>`;
}

function walletPage() {
  const data = state.data, transactions = data.transactions;
  const spent = -transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);
  const refunds = transactions.filter(t => t.description === 'Cancellation refund').reduce((sum, t) => sum + t.amount, 0);
  return `${intro('A little in. A lot taken care of.', 'One wallet for your room. Every credit and cleaning, easy to keep track of.')}
    <div class="wallet-page-grid"><section class="wallet-big"><div><div class="eyebrow">Your shared room wallet</div><div class="wallet-amount"><span>₹</span>${money(data.room.room_balance)}</div></div><div class="spread"><span class="row">${icon('users')}${esc(data.room.block_name)} · ${data.room.room_number}<br>Shared by ${data.roommates.length} residents</span>${btn('Add demo credits', 'topup', 'secondary', '', 'plus')}</div></section>
    <section class="panel"><div class="panel-heading"><h2>Room care, by the numbers</h2>${icon('leaf')}</div><div class="wallet-legend"><div><span>Cleaning charges</span><strong>${rupees(spent)}</strong></div><div><span>Refunded</span><strong>${rupees(refunds)}</strong></div></div><p class="muted wallet-caption">Based on the latest ${transactions.length} wallet entries. Everyone in your room sees the same balance.</p></section></div>
    <div class="banner warning">${icon('info')}<p><strong>A practice wallet, for now.</strong> Credits are for this local demo only. Adding credits doesn’t take a payment or move real money.</p></div>
    <div class="section-heading"><h2>The little details</h2><span class="section-label">Wallet activity</span></div>
    ${transactions.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Transaction</th><th>Date</th><th>Added / booked by</th><th>Amount</th></tr></thead><tbody>${transactions.map(t => `<tr><td><strong>${esc(t.description)}</strong><small>${t.booking_id ? `Request #${String(t.booking_id).padStart(4, '0')}` : `Transaction #${t.transaction_id}`}</small></td><td>${dateText(t.created_at)}<small>${timeText(t.created_at)}</small></td><td>${esc(t.student_name || 'Room wallet')}</td><td><strong class="transaction-amount ${t.amount >= 0 ? 'credit' : 'debit'}">${t.amount >= 0 ? '+' : '−'}${rupees(Math.abs(t.amount))}</strong></td></tr>`).join('')}</tbody></table></div>` : `<div class="panel">${empty('A fresh wallet.', 'Add some demo credits to book your first cleaning.', 'wallet', btn('Add demo credits', 'topup', 'primary'))}</div>`}`;
}

function roomPage() {
  const { room, roommates } = state.data;
  return `${intro('Your little corner of campus.', 'A shared space, a few familiar faces, and a little room care.')}
    <div class="room-grid"><div class="stack"><section class="room-card-hero"><div class="eyebrow">${esc(room.block_name)} · VIT hostel</div><div class="room-number">${room.room_number}</div><div class="room-line">A little place to call your own.</div><div class="room-illustration" aria-hidden="true">${icon('building')}</div><div class="room-details"><div><small>Floor</small><strong>${room.floor}</strong></div><div><small>Room type</small><strong>${room.beds}-sharing</strong></div><div><small>Residents</small><strong>${roommates.length} of ${room.beds}</strong></div></div></section>
    <section class="subtle-panel"><h3>Better together.</h3><p class="muted room-invite-copy">A roommate joining Tidy? Share this room code so they can join your space and shared wallet.</p><div class="invite-code"><strong>${esc(room.join_code)}</strong><button class="icon-button" data-action="copy-code" aria-label="Copy room code">${icon('copy')}</button></div><p class="room-code-note">Only share this with your actual roommates.</p></section></div>
    <div class="stack"><section class="panel"><div class="panel-heading"><h2>The room crew</h2><span class="pill neutral">${roommates.length} residents</span></div><div class="roommate-list">${roommates.map(r => `<div class="roommate-item"><span class="avatar">${initials(r.name)}</span><div><h3>${esc(r.name)}</h3><p>${esc(r.reg_no)}</p></div>${r.reg_no === state.user.reg_no ? '<span class="you-tag">You</span>' : ''}</div>`).join('')}</div></section>
    <section class="panel"><div class="panel-heading"><h2>Your account</h2>${icon('user')}</div><dl class="profile-details"><div><dt>Name</dt><dd>${esc(state.user.name)}</dd></div><div><dt>Registration</dt><dd>${esc(state.user.reg_no)}</dd></div><div><dt>VIT email</dt><dd>${esc(state.user.email)}</dd></div></dl><hr class="divider"><p class="muted account-note">Need a room or account correction? This prototype keeps room assignments fixed after registration.</p></section></div></div>
    <div class="room-tip">${icon('users')}<p><strong>One room, one team.</strong> All roommates share requests and wallet credits. Check your upcoming cleanings before making a new booking.</p></div>`;
}

function helpPage() {
  const faqs = [
    ['How do I book a cleaning?', 'Choose Book a cleaning, pick a service, and select an available date and time. Review your details before confirming. The amount comes from your shared room wallet, and an available cleaner in your block is assigned automatically.'],
    ['What time can I book?', 'Cleaning runs from 9:00 am to 6:00 pm IST, every day. Slots start every 30 minutes, with at least 10 minutes’ notice, and must finish by 6:00 pm. You can book up to 14 days ahead. Crossed-out slots have passed or are unavailable for your room or the block’s care team.'],
    ['Can I cancel a request?', 'Yes. Open your request details and choose Cancel request at least 5 minutes before your scheduled time. The entire charge returns to your shared room wallet. A cleaning that has already started or finished cannot be cancelled by a student.'],
    ['How does the shared wallet work?', 'Everyone registered in the same room shares one balance. Booking deducts the service charge once; cancellation refunds it once. For this local prototype, Add demo credits lets you try the flow without making a real payment.'],
    ['How do my roommates join?', 'Your My room page has a private room code. A roommate can create an account with the same hostel block and room number and enter that code. They will see the shared room requests and wallet. Keep the code within your room.'],
    ['How are cleaning updates added?', 'The hostel staff console moves requests from Scheduled to In Progress to Completed. Students see those updates automatically while this page is open. Normally, staff can start on the scheduled day, up to 15 minutes before the slot. For this database project, the explicitly labelled Start now · demo action allows a presentation at any time and records that fact in the status history. No real cleaner is dispatched.'],
    ['What should I do before the cleaner arrives?', 'Please make sure someone can provide room access, clear loose items from the floor and reachable surfaces, and keep valuables tucked away. Use the booking note for access instructions or areas needing a little extra attention.'],
    ['Is this connected to VIT or real payments?', 'This is an independent localhost prototype for the project. It is not connected to VIT’s identity, hostel management, notification or payment systems. New accounts are local and email addresses are checked for format only. Demo credits have no monetary value.'],
  ];
  return `${intro('A little help goes a long way.', 'Everything you need for a smoother, fresher hostel day.')}<div class="faq-layout"><section class="faq-list" aria-label="Frequently asked questions">${faqs.map(([q, a], i) => `<details ${i === 0 ? 'open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('')}</section><aside class="help-card"><div class="stat-icon">${icon('help')}</div><h3>Here for the little things.</h3><p>Need help with a room or a cleaning? Start with your hostel’s housekeeping desk. Tidy keeps your request details together so they’re easy to share.</p><div class="row">${icon('clock')}Cleaning hours · 9 am–6 pm IST</div><div class="row">${icon('calendar')}Book up to 14 days ahead</div><div class="row">${icon('wallet')}Full refund before the cutoff</div><hr class="divider"><p>No support messages are sent from this prototype. Your request ID is available in My requests.</p><a href="#requests" class="link-button">Find a request ${icon('arrow')}</a></aside></div>`;
}

function staffOverview() {
  const data = state.data, bookings = data.bookings, active = activeBookings();
  const inProgress = bookings.filter(b => b.status === 'In Progress');
  const completed = bookings.filter(b => b.status === 'Completed' && b.completed_at?.slice(0, 10) === today());
  return `${intro('A fresh day for every room.', 'A little coordination. A lot of well-cared-for spaces.')}
    <section class="hero"><div class="hero-copy"><div class="eyebrow">The hostel care desk</div><h2>Good spaces.<br><em>Better days.</em></h2><p>Keep the day flowing, one room at a time.<br>Your care team’s schedule lives right here.</p><a href="#requests" class="btn btn-primary">View all requests ${icon('arrow')}</a></div>${waterArt()}</section>
    <div class="stats-grid">${stat('Scheduled', active.filter(b => b.status === 'Assigned').length.toString().padStart(2, '0'), 'Requests waiting for room care', 'calendar')}${stat('In progress', inProgress.length.toString().padStart(2, '0'), 'A little care happening now', 'broom', 'blue')}${stat('Completed today', completed.length.toString().padStart(2, '0'), 'Fresh rooms, happy residents', 'checkCircle', 'peach')}</div>
    <div class="section-heading"><h2>${inProgress.length ? 'A little care in progress' : 'Next on the room-care list'}</h2><a class="link-button" href="#requests">All requests ${icon('arrow')}</a></div>${(inProgress.length ? inProgress : active).length ? `<div class="request-list">${(inProgress.length ? inProgress : active).slice(0, 4).map(requestCard).join('')}</div>` : `<div class="panel">${empty('All caught up.', 'New student requests will appear here automatically.', 'checkCircle')}</div>`}
    <div class="room-tip">${icon('info')}<p><strong>A little timing note.</strong> Start requests on the scheduled day, up to 15 minutes before the slot. Mark them complete when the room is ready.${data.demo_mode ? ' For a class presentation, Start now · demo records an immediate start at any time. No real cleaner is dispatched.' : ''}</p></div>`;
}
function teamPage() {
  return `${intro('The people behind the fresh starts.', 'Your block care teams, with their current room-care workload.')}<div class="staff-team">${state.data.cleaners.map(c => {
    const active = state.data.bookings.filter(b => b.cleaner_id === c.cleaner_id && ['Assigned', 'In Progress'].includes(b.status));
    const working = active.some(b => b.status === 'In Progress');
    return `<article class="team-card"><div class="avatar">${initials(c.name)}</div><h3>${esc(c.name)}</h3><p>${esc(c.block_name)}</p><div class="spread"><span>${active.length} active ${active.length === 1 ? 'request' : 'requests'}</span><span class="pill ${working ? 'progress' : 'completed'}">${working ? 'Cleaning' : c.status}</span></div></article>`;
  }).join('')}</div><div class="room-tip">${icon('users')}<p>Cleaners are assigned within their block. Overlapping room and cleaner slots are checked before every booking.</p></div>`;
}

async function loadDashboard(render = true) {
  const data = await api(isStaff() ? '/staff/dashboard' : '/dashboard');
  state.data = data; state.user = data.user; state.pollError = false;
  if (render) renderApp();
  if (render && state.page === 'database' && isStaff()) await loadDatabase();
}

let databaseVersion = 0;
async function loadDatabase(render = true) {
  const version = ++databaseVersion;
  const table = state.dbTable, page = state.dbPage;
  if (render) { state.dbLoading = true; state.dbError = ''; renderApp(); }
  try {
    const data = await api(`/staff/database?table=${encodeURIComponent(table)}&page=${page}`);
    if (version !== databaseVersion || !isStaff()) return;
    state.database = data; state.dbPage = data.page; state.dbError = '';
  } catch (error) {
    if (version === databaseVersion) state.dbError = error.message;
    if (!render) throw error;
  } finally {
    if (version === databaseVersion) { state.dbLoading = false; if (render && state.page === 'database') renderApp(); }
  }
}

function navigate(page) {
  if (!state.user) return;
  state.page = page; state.filter = 'All'; state.search = '';
  renderApp(); window.scrollTo({ top: 0 });
  if (state.page === 'database' && isStaff()) loadDatabase();
}
window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'overview'));

function modalShell(title, subtitle, body, footer = '', eyebrow = 'A little room care') {
  return `<div class="modal-head"><div><div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body"><div id="modal-error" class="inline-error" role="alert"></div>${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}`;
}
function openModal(type, id) {
  state.modal = { type, id: Number(id), amount: 250, rating: 0, feedback: '' };
  renderModal();
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
function closeModal() {
  if (state.busy) return;
  dialog.close(); state.modal = null; state.booking = null;
}
dialog.addEventListener('cancel', event => { if (state.busy) event.preventDefault(); else { state.modal = null; state.booking = null; } });
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal();
});

function renderModal() {
  if (!state.modal) return;
  const { type, id } = state.modal;
  if (type === 'booking') return renderBooking();
  const booking = state.data.bookings.find(b => b.booking_id === id);
  if (type === 'topup') {
    dialog.innerHTML = modalShell('A little top-up.', 'More room care, just around the corner.', `<div class="banner warning">${icon('info')}<p><strong>Demo credits only.</strong> No payment is taken. This adds practice credits to your shared room wallet.</p></div><div class="topup-picks">${[100, 250, 500].map(amount => `<button class="topup-pick ${state.modal.amount === amount ? 'selected' : ''}" data-action="choose-topup" data-amount="${amount}" aria-pressed="${state.modal.amount === amount}">${rupees(amount)}<small>demo credits</small></button>`).join('')}</div><div class="review-item"><span>Current room balance</span><strong>${rupees(state.data.room.room_balance)}</strong></div><div class="review-total"><span>Balance after top-up</span><strong>${rupees(state.data.room.room_balance + state.modal.amount)}</strong></div>`, `<p>Shared with everyone in your room.</p>${btn(`Add ${rupees(state.modal.amount)} demo credits`, 'confirm-topup', 'primary', '', 'plus')}`);
  } else if (type === 'details' && booking) {
    dialog.innerHTML = modalShell(esc(booking.type_name), `Request #${String(booking.booking_id).padStart(4, '0')} · ${esc(booking.block_name)} · Room ${booking.room_number}`, `${badge(booking.status)}<div class="detail-spacer"></div><div class="review-list"><div class="review-item"><span>Date & time · IST</span><strong>${dateText(booking.scheduled_start_time)} · ${timeText(booking.scheduled_start_time)}</strong></div><div class="review-item"><span>Care team</span><strong>${esc(booking.cleaner_name || 'Not assigned')}</strong></div><div class="review-item"><span>Booked by</span><strong>${esc(booking.student_name)}</strong></div><div class="review-item"><span>Duration & charge</span><strong>${booking.duration} min · ${rupees(booking.amount_charged)}</strong></div></div>${booking.notes ? `<p class="detail-note">${esc(booking.notes)}</p>` : ''}<hr class="divider"><h3>Every little update</h3><ol class="timeline">${booking.events.map(e => `<li><strong>${esc(e.status === 'Assigned' ? 'Cleaning scheduled' : e.status)}</strong><p>${esc(e.note)}</p><time>${dateText(e.created_at)} · ${timeText(e.created_at)}</time></li>`).join('')}</ol>${booking.rating ? `<div class="receipt"><div class="rating-display" aria-label="${booking.rating} out of 5 stars">${'★'.repeat(booking.rating)}${'☆'.repeat(5 - booking.rating)}</div>${booking.feedback ? `<p>${esc(booking.feedback)}</p>` : '<p>Thanks for sharing a little feedback.</p>'}</div>` : ''}`, `${isStaff() && booking.status === 'Assigned' ? btn('Cancel & refund', 'cancel-confirm', 'danger', `data-id="${id}"`) : !isStaff() && booking.can_cancel ? btn('Cancel request', 'cancel-confirm', 'danger', `data-id="${id}"`) : `<p>${booking.status === 'Cancelled' ? 'Full charge refunded to the room wallet.' : booking.status === 'Assigned' && !isStaff() ? 'Cancellation closes 5 minutes before your slot.' : 'A little care, every step of the way.'}</p>`}${isStaff() && booking.status === 'Assigned' ? staffStartButton(booking) : isStaff() && booking.status === 'In Progress' ? btn('Mark complete', 'staff-status', 'primary', `data-id="${id}" data-status="Completed"`) : !isStaff() && booking.status === 'Completed' && !booking.rating ? btn('Rate your clean', 'feedback', 'primary', `data-id="${id}"`, 'star') : btn('Done', 'close-modal', 'secondary')}`);
  } else if (type === 'cancel' && booking) {
    dialog.innerHTML = modalShell('A change of plans?', `Request #${String(id).padStart(4, '0')} · ${esc(booking.type_name)}`, `<p class="modal-copy">Cancel your ${dateText(booking.scheduled_start_time)} cleaning at ${timeText(booking.scheduled_start_time)}? The full <strong>${rupees(booking.amount_charged)}</strong> will go back to your shared room wallet.</p><div class="banner">${icon('wallet')}<p>No cancellation fee. You can always find a new slot later.</p></div>`, `${btn('Keep request', 'details', 'secondary', `data-id="${id}"`)}${btn('Cancel & refund', 'do-cancel', 'danger', `data-id="${id}"`)}`);
  } else if (type === 'feedback' && booking) {
    dialog.innerHTML = modalShell('How’s your little corner?', `${esc(booking.type_name)} · ${dateText(booking.scheduled_start_time)}`, `<p class="feedback-prompt">A little feedback makes the next clean even better.</p><div class="stars" aria-label="Rate this cleaning">${[1, 2, 3, 4, 5].map(n => `<button class="star-button ${state.modal.rating >= n ? 'selected' : ''}" data-action="choose-rating" data-rating="${n}" aria-pressed="${state.modal.rating === n}" aria-label="${n} ${n === 1 ? 'star' : 'stars'}">${icon('star')}</button>`).join('')}</div><div class="field"><label for="feedback-text">Anything else? <span class="muted">· optional</span></label><textarea id="feedback-text" maxlength="500" placeholder="What went well, or what could be a little better?">${esc(state.modal.feedback)}</textarea></div>`, `<p>One rating per room request.</p>${btn('Send feedback', 'submit-feedback', 'primary', state.modal.rating ? '' : 'disabled', 'arrow')}`);
  } else if (type === 'notifications') {
    const list = notifications().slice(0, 15);
    dialog.innerHTML = modalShell('The latest little updates.', 'Room care, kept in the loop.', list.length ? list.map(n => `<div class="notification-item"><div class="stat-icon">${icon(n.status === 'Completed' ? 'checkCircle' : n.status === 'Cancelled' ? 'wallet' : 'calendar')}</div><div class="grow"><h3>${esc(n.title)}</h3><p>${esc(n.note)}</p><time>${dateText(n.created_at)} · ${timeText(n.created_at)}</time><button class="link-button" data-action="details" data-id="${n.booking_id}">View request ${icon('arrow')}</button></div></div>`).join('') : empty('All quiet in your corner.', 'Booking confirmations and cleaning updates will appear here.', 'bell', '', true), `${btn('All caught up', 'close-modal', 'primary')}`);
  } else if (type === 'profile') {
    dialog.innerHTML = modalShell('Your Tidy account.', isStaff() ? 'The hostel care desk.' : 'A little place for the essentials.', `<div class="row profile-hero"><span class="avatar">${initials(state.user.name)}</span><div><h3>${esc(state.user.name)}</h3><p>${esc(state.user.email)}</p></div></div><div class="review-list"><div class="review-item"><span>Account type</span><strong>${isStaff() ? 'Hostel staff' : 'Student'}</strong></div>${!isStaff() ? `<div class="review-item"><span>Registration number</span><strong>${esc(state.user.reg_no)}</strong></div><div class="review-item"><span>Room</span><strong>${esc(state.data.room.block_name)} · ${state.data.room.room_number}</strong></div>` : ''}</div>`, `${btn('Sign out', 'logout', 'secondary', '', 'logout')}${btn('Done', 'close-modal', 'primary')}`);
  }
}

function newBooking(id) {
  state.booking = { step: 1, type_id: Number(id) || state.data.services[0].type_id, date: addDays(today(), 1), time: '', notes: '', cleaner_id: '', slots: null, slotsLoading: false, slotError: '', loadedFor: '' };
  openModal('booking');
}
const currentService = () => state.data.services.find(s => s.type_id === state.booking.type_id);
function stepIndicator() {
  return `<div class="step-indicator" aria-label="Booking progress">${['Your clean', 'Your time', 'A little check'].map((label, i) => `${i ? '<span class="step-line"></span>' : ''}<div class="step-item ${state.booking.step === i + 1 ? 'current' : state.booking.step > i + 1 ? 'done' : ''}" ${state.booking.step === i + 1 ? 'aria-current="step"' : ''}><span>${state.booking.step > i + 1 ? '✓' : i + 1}</span>${label}</div>`).join('')}</div>`;
}
function renderBooking() {
  const b = state.booking, service = currentService();
  if (b.step === 4) {
    dialog.innerHTML = modalShell('A fresh start, all set.', '', `<div class="modal-success"><div class="success-icon">${icon('check')}</div><h3>You’re on the list.</h3><p>We’ll take it from here. Your room’s next little reset is booked, and your roommates can see it too.</p><div class="receipt"><strong>${esc(service.type_name)}</strong>${dateText(b.date)} · ${slotText(b.time)} IST<br>Request #${String(b.booking_id).padStart(4, '0')}</div></div>`, `<p>${rupees(service.price)} charged to your room wallet.</p>${btn('View request', 'details', 'primary', `data-id="${b.booking_id}"`, 'arrow')}`);
    return;
  }
  let body = stepIndicator();
  let footer = '';
  if (b.step === 1) {
    body += state.data.services.map(s => `<button class="service-choice ${s.type_id === b.type_id ? 'selected' : ''}" data-action="choose-service" data-id="${s.type_id}" aria-pressed="${s.type_id === b.type_id}"><span class="selection-dot"></span><div class="stat-icon">${icon(serviceIcon(s))}</div><div class="grow"><h3>${esc(s.type_name)}</h3><p>${esc(s.description)}</p></div><div class="choice-price">${rupees(s.price)}<small>${s.duration} minutes</small></div></button>`).join('');
    body += `<div class="banner">${icon('wallet')}<p>Paid from your shared room wallet. Current balance: <strong>${rupees(state.data.room.room_balance)}</strong>.</p></div>`;
    footer = `<p>A little care, starting at ₹50.</p>${btn('Choose a time', 'booking-next', 'primary', '', 'arrow')}`;
  } else if (b.step === 2) {
    const selectedSlot = b.slots?.find(s => s.time === b.time);
    body += `<div class="spread"><span class="field-label">Find your little window.</span><span class="muted booking-hours">9 am–6 pm · IST</span></div><div class="date-picks">${Array.from({ length: 7 }, (_, i) => addDays(today(), i)).map(day => `<button class="date-pick ${day === b.date ? 'selected' : ''}" data-action="choose-date" data-date="${day}" aria-pressed="${day === b.date}" aria-label="${dateText(day)}"><small>${fmt(`${day}T12:00:00`, { weekday: 'short' })}</small><strong>${day.slice(-2)}</strong></button>`).join('')}</div><div class="field"><label for="booking-date">Or choose another date</label><input id="booking-date" type="date" value="${b.date}" min="${today()}" max="${addDays(today(), 14)}" required></div><span class="field-label">Available times · ${dateText(b.date)}</span>
    ${b.slotsLoading ? '<p class="slot-status" role="status">Finding a little room in the schedule…</p>' : b.slotError ? `<div class="error-box">${esc(b.slotError)}</div>${btn('Try again', 'reload-slots', 'secondary')}` : b.slots ? `<div class="slot-grid">${b.slots.map(s => `<button class="slot ${s.time === b.time ? 'selected' : ''}" data-action="choose-slot" data-time="${s.time}" aria-pressed="${s.time === b.time}" ${s.available ? '' : 'disabled'}>${slotText(s.time)}</button>`).join('')}</div>${!b.slots.some(s => s.available) ? '<p class="slot-legend">All full for this day. Try another date for a fresh start.</p>' : '<p class="slot-legend">Crossed-out times are unavailable. Slots are confirmed when you book.</p>'}` : '<p class="slot-status">Choose a date to see the available times.</p>'}
    ${selectedSlot ? `<div class="field"><label for="booking-cleaner">Care team preference</label><select id="booking-cleaner"><option value="">Match me with an available cleaner</option>${selectedSlot.cleaners.map(c => `<option value="${c.cleaner_id}" ${String(c.cleaner_id) === b.cleaner_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>` : ''}
    <div class="field"><label for="booking-notes">Anything we should know? <span class="muted">· optional</span></label><textarea id="booking-notes" maxlength="500" placeholder="A tricky corner, access instructions, a little extra care…">${esc(b.notes)}</textarea><small>Please make sure someone can provide access to your room.</small></div>`;
    footer = `${btn('Back', 'booking-back', 'secondary', '', 'back')}${btn('Review request', 'booking-next', 'primary', !b.time || b.slotsLoading ? 'disabled' : '', 'arrow')}`;
  } else {
    const enough = state.data.room.room_balance >= service.price;
    const cleaner = b.slots?.find(s => s.time === b.time)?.cleaners.find(c => String(c.cleaner_id) === b.cleaner_id);
    body += `<div class="review-service"><div class="stat-icon">${icon(serviceIcon(service))}</div><div><h3>${esc(service.type_name)}</h3><p>${service.duration} minutes of a little room care.</p></div></div><div class="review-list"><div class="review-item"><span>Your space</span><strong>${esc(state.data.room.block_name)} · Room ${state.data.room.room_number}</strong></div><div class="review-item"><span>Date</span><strong>${dateText(b.date)}</strong></div><div class="review-item"><span>Time · IST</span><strong>${slotText(b.time)}</strong></div><div class="review-item"><span>Care team</span><strong>${cleaner ? esc(cleaner.name) : 'An available cleaner in your block'}</strong></div></div>${b.notes ? `<p class="review-notes">${esc(b.notes)}</p>` : ''}<div class="review-total"><span>Total from room wallet</span><strong>${rupees(service.price)}</strong></div><p class="wallet-remaining">${enough ? `Wallet after booking: ${rupees(state.data.room.room_balance - service.price)}` : `You need ${rupees(service.price - state.data.room.room_balance)} more in your room wallet.`}</p><div class="banner ${enough ? '' : 'warning'}">${icon(enough ? 'shield' : 'wallet')}<p>${enough ? 'Plans change. Cancel at least 5 minutes before your slot for a full refund.' : 'Add demo credits in Room wallet, then come back to book. No real payment is needed.'}</p></div>`;
    footer = `${btn('Back', 'booking-back', 'secondary', '', 'back')}${enough ? btn('Confirm cleaning', 'confirm-booking', 'primary', '', 'check') : btn('Open room wallet', 'go-wallet', 'primary', '', 'wallet')}`;
  }
  dialog.innerHTML = modalShell(b.step === 1 ? 'A little room reset.' : b.step === 2 ? 'Make a little time.' : 'Looking good?', b.step === 1 ? 'Choose the care your space could use.' : b.step === 2 ? 'A slot that fits around your day.' : 'One last check, then we’ll take it from here.', body, footer);
  if (b.step === 2 && b.loadedFor !== `${b.type_id}:${b.date}` && !b.slotsLoading) loadSlots();
}

let slotVersion = 0;
async function loadSlots() {
  const b = state.booking;
  if (!b) return;
  const version = ++slotVersion;
  b.slotsLoading = true; b.slotError = ''; b.loadedFor = `${b.type_id}:${b.date}`;
  renderBooking();
  try {
    const result = await api(`/availability?type_id=${b.type_id}&date=${encodeURIComponent(b.date)}`);
    if (version !== slotVersion || state.booking !== b || state.modal?.type !== 'booking') return;
    b.slots = result.slots;
    if (!b.slots.some(s => s.time === b.time && s.available)) { b.time = ''; b.cleaner_id = ''; }
  } catch (error) { if (state.booking === b) b.slotError = error.message; }
  finally { if (version === slotVersion && state.booking === b && state.modal?.type === 'booking') { b.slotsLoading = false; renderBooking(); } }
}

function notifications() {
  return (state.data?.bookings || []).flatMap(b => b.events.map(e => ({ ...e, booking_id: b.booking_id, title: `${b.type_name} · ${e.status === 'Assigned' ? 'Scheduled' : e.status}`, note: `${isStaff() ? `${b.block_name} · ${b.room_number} — ` : ''}${e.note || ''}` }))).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.booking_id - a.booking_id);
}
const seenKey = () => `tidy.seen.${state.user?.reg_no || state.user?.email}`;
function safeStorage(key, value) { try { if (value !== undefined) localStorage.setItem(key, value); return localStorage.getItem(key); } catch { return null; } }
function unreadCount() { const seen = safeStorage(seenKey()) || ''; return notifications().filter(n => n.created_at > seen).length; }

async function mutation(action, button) {
  if (state.busy) return;
  state.busy = true;
  const original = button?.innerHTML;
  if (button) { button.disabled = true; button.textContent = 'One moment…'; }
  try { await action(); }
  catch (error) { if (dialog.open) showFormError('modal-error', error); else toast(error.message, true); }
  finally { state.busy = false; if (button?.isConnected) { button.disabled = false; button.innerHTML = original; } }
}

document.addEventListener('submit', event => {
  if (event.target.id !== 'auth-form') return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  signIn({ ...values, role: state.role }, state.authMode === 'register');
});

document.addEventListener('input', event => {
  if (event.target.id === 'request-search') {
    state.search = event.target.value; $('#request-results').innerHTML = requestResults();
  }
  if (event.target.id === 'booking-notes' && state.booking) state.booking.notes = event.target.value;
  if (event.target.id === 'feedback-text' && state.modal) state.modal.feedback = event.target.value;
});
document.addEventListener('change', event => {
  if (event.target.id === 'booking-date' && state.booking) {
    const value = event.target.value;
    if (!value || value < today() || value > addDays(today(), 14)) {
      showFormError('modal-error', new Error('Choose a date within the next 14 days.')); return;
    }
    state.booking.date = value; state.booking.time = ''; state.booking.cleaner_id = ''; state.booking.slots = null;
    renderBooking();
  }
  if (event.target.id === 'booking-cleaner') state.booking.cleaner_id = event.target.value;
});

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action, id = Number(button.dataset.id);
  if (state.busy && !['toggle-password', 'open-menu', 'close-menu'].includes(action)) return;
  switch (action) {
    case 'auth-role': state.role = button.dataset.role; renderAuth(); break;
    case 'auth-mode': state.authMode = state.authMode === 'login' ? 'register' : 'login'; state.role = 'student'; renderAuth(); break;
    case 'toggle-password': {
      const field = $('#password'); field.type = field.type === 'password' ? 'text' : 'password';
      button.setAttribute('aria-label', field.type === 'password' ? 'Show password' : 'Hide password');
      button.innerHTML = icon(field.type === 'password' ? 'eye' : 'eyeOff'); break;
    }
    case 'demo-login': await signIn({ email: state.role === 'staff' ? 'staff@vit.ac.in' : 'pradyun@vit.ac.in', password: 'pass123', role: state.role }); break;
    case 'logout': await mutation(async () => {
      await api('/logout', {}); state.user = null; state.data = null; state.database = null; dialog.close(); state.modal = null; state.booking = null;
      state.authMode = 'login'; history.replaceState(null, '', location.pathname); renderAuth();
    }, button); break;
    case 'open-menu': $('.sidebar').classList.add('open'); $('.sidebar-overlay').classList.add('show'); button.setAttribute('aria-expanded', 'true'); $('.sidebar .nav-item').focus(); break;
    case 'close-menu': $('.sidebar').classList.remove('open'); $('.sidebar-overlay').classList.remove('show'); $('.mobile-menu').setAttribute('aria-expanded', 'false'); $('.mobile-menu').focus(); break;
    case 'close-modal': closeModal(); break;
    case 'new-booking': newBooking(id); break;
    case 'details': state.booking = null; openModal('details', id); break;
    case 'topup': openModal('topup'); break;
    case 'profile': openModal('profile'); break;
    case 'choose-topup': state.modal.amount = Number(button.dataset.amount); renderModal(); break;
    case 'confirm-topup': await mutation(async () => {
      const result = await api('/wallet/topup', { amount: state.modal.amount });
      await loadDashboard(); dialog.close(); state.modal = null; toast(result.message);
    }, button); break;
    case 'cancel-confirm': openModal('cancel', id); break;
    case 'do-cancel': await mutation(async () => {
      const result = isStaff() ? await api(`/staff/bookings/${id}/status`, { status: 'Cancelled' }) : await api('/cancel', { booking_id: id });
      await loadDashboard(); openModal('details', id); toast(result.message);
    }, button); break;
    case 'staff-status': await mutation(async () => {
      const result = await api(`/staff/bookings/${id}/status`, { status: button.dataset.status, demo_override: button.dataset.demo === 'true' });
      await loadDashboard(); if (dialog.open) openModal('details', id); toast(result.message);
    }, button); break;
    case 'feedback': openModal('feedback', id); break;
    case 'choose-rating': state.modal.rating = Number(button.dataset.rating); renderModal(); break;
    case 'submit-feedback': await mutation(async () => {
      const result = await api(`/bookings/${state.modal.id}/feedback`, { rating: state.modal.rating, feedback: state.modal.feedback });
      await loadDashboard(); dialog.close(); state.modal = null; toast(result.message);
    }, button); break;
    case 'filter': state.filter = button.dataset.filter; renderApp(); break;
    case 'db-table': state.dbTable = button.dataset.table; state.dbPage = 1; state.database = null; await loadDatabase(); break;
    case 'db-page': state.dbPage = Number(button.dataset.page); await loadDatabase(); break;
    case 'db-refresh': await loadDatabase(); break;
    case 'refresh': await mutation(async () => { await loadDashboard(); toast('All caught up with the latest room care.'); }, button); break;
    case 'notifications': safeStorage(seenKey(), state.data.server_time); renderApp(); openModal('notifications'); break;
    case 'copy-code': {
      try { await navigator.clipboard.writeText(state.data.room.join_code); toast('Room code copied. Share it with your roommates.'); }
      catch { toast(`Your room code is ${state.data.room.join_code}. Select it to copy.`); }
      break;
    }
    case 'choose-service': state.booking.type_id = id; state.booking.slots = null; state.booking.loadedFor = ''; state.booking.time = ''; renderBooking(); break;
    case 'booking-next':
      if (state.booking.step === 2 && !state.booking.time) return;
      state.booking.step++; renderBooking(); dialog.scrollTop = 0; $('#modal-title').setAttribute('tabindex', '-1'); $('#modal-title').focus(); break;
    case 'booking-back': state.booking.step--; renderBooking(); dialog.scrollTop = 0; break;
    case 'choose-date': state.booking.date = button.dataset.date; state.booking.time = ''; state.booking.cleaner_id = ''; state.booking.slots = null; renderBooking(); break;
    case 'reload-slots': state.booking.loadedFor = ''; renderBooking(); break;
    case 'choose-slot': state.booking.time = button.dataset.time; state.booking.cleaner_id = ''; renderBooking(); break;
    case 'go-wallet': closeModal(); location.hash = 'wallet'; if (state.page === 'wallet') navigate('wallet'); break;
    case 'confirm-booking': await mutation(async () => {
      const b = state.booking;
      const result = await api('/book', { type_id: b.type_id, scheduled_start_time: `${b.date}T${b.time}:00`, cleaner_id: b.cleaner_id || null, notes: b.notes });
      b.booking_id = result.booking_id; b.step = 4; await loadDashboard(); renderBooking(); dialog.scrollTop = 0;
    }, button); break;
    case 'retry-app': await bootstrap(); break;
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('.sidebar.open')) {
    $('.sidebar').classList.remove('open'); $('.sidebar-overlay').classList.remove('show'); $('.mobile-menu').focus();
  }
});

async function bootstrap() {
  try {
    const result = await api('/session'); state.user = result.user;
    if (result.logged_in) { state.page = location.hash.slice(1) || 'overview'; await loadDashboard(); }
    else renderAuth();
  } catch (error) {
    app.innerHTML = `<main class="error-page" id="main-content"><div><div class="brand-mark">${icon('drop')}</div><h1>A little pause.</h1><p>${esc(error.message)}</p>${btn('Try again', 'retry-app', 'primary', '', 'refresh')}</div></main>`;
  }
}

function renderBackgroundUpdate() {
  const focused = document.activeElement;
  if (['INPUT', 'TEXTAREA', 'SELECT', 'SUMMARY'].includes(focused?.tagName) || $('.sidebar.open')) return;
  if (renderedSignature === dashboardSignature()) return;
  // Match controls by their semantic attributes so a data refresh keeps keyboard focus.
  const marker = focused?.dataset?.action ? { data: JSON.stringify({ ...focused.dataset }), label: focused.textContent, aria: focused.getAttribute('aria-label') } :
    focused?.tagName === 'A' ? { href: focused.getAttribute('href'), nav: focused.classList.contains('nav-item') } : null;
  renderApp();
  let replacement;
  if (marker?.data) replacement = [...app.querySelectorAll('[data-action]')].find(el =>
    JSON.stringify({ ...el.dataset }) === marker.data && el.textContent === marker.label && el.getAttribute('aria-label') === marker.aria);
  else if (marker?.href) replacement = [...app.querySelectorAll('a')].find(el =>
    el.getAttribute('href') === marker.href && el.classList.contains('nav-item') === marker.nav);
  replacement?.focus({ preventScroll: true });
}

setInterval(async () => {
  if (!state.user || state.busy || state.modal || document.hidden) return;
  try {
    await loadDashboard(false);
    if (state.page === 'database' && isStaff()) await loadDatabase(false);
    renderBackgroundUpdate();
  } catch {
    if (state.user && state.data) { state.pollError = true; renderBackgroundUpdate(); }
  }
}, 20000);

bootstrap();
