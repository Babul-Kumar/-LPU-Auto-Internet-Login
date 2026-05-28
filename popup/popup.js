// =============================================================================
// popup.js — No Supabase. Pure chrome.storage.local.
// Flow: no creds saved → Setup screen | creds saved → Dashboard
// =============================================================================

'use strict';

// ─── Safety guard — ensure we are running inside the extension context ────────
// This prevents crashes if the popup is ever opened outside the extension.
if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.runtime) {
  document.body.innerHTML = `
    <div style="font-family:sans-serif;padding:30px;color:#f87171;text-align:center">
      <p style="font-size:18px;font-weight:700">⚠️ Extension Context Error</p>
      <p style="margin-top:10px;font-size:13px;color:#94a3b8">
        Please open this popup by clicking the extension icon in the Chrome toolbar,
        not by opening the HTML file directly.
      </p>
    </div>`;
  throw new Error('chrome APIs unavailable — not running in extension context');
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const store = {
  async get(key) {
    try {
      const r = await chrome.storage.local.get(key);
      return r[key] ?? null;
    } catch { return null; }
  },
  async set(key, value) {
    try { await chrome.storage.local.set({ [key]: value }); } catch {}
  },
  async remove(key) {
    try { await chrome.storage.local.remove(key); } catch {}
  },
};

// ─── DOM helpers ──────────────────────────────────────────────────────────────

const $  = (id)  => document.getElementById(id);

// ─── Screen switcher ──────────────────────────────────────────────────────────

const SCREENS = ['screen-setup', 'screen-dashboard', 'screen-settings'];

function show(id) {
  SCREENS.forEach((s) => {
    document.getElementById(s).classList.toggle('active', s === id);
  });
}

// ─── Boot: decide which screen to show ────────────────────────────────────────

async function boot() {
  const creds = await store.get('portalCredentials');
  if (creds?.username && creds?.password) {
    await loadDashboard();
    show('screen-dashboard');
  } else {
    show('screen-setup');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SETUP SCREEN
// ══════════════════════════════════════════════════════════════════════════════

$('btn-setup-save').addEventListener('click', async () => {
  const username = $('setup-username').value.trim();
  const password = $('setup-password').value;
  const errEl    = $('setup-error');

  errEl.classList.add('hidden');

  if (!username) { showMsg(errEl, 'Please enter your Student ID / Username.'); return; }
  if (!password) { showMsg(errEl, 'Please enter your password.'); return; }

  setBusy($('btn-setup-save'), $('setup-btn-text'), $('setup-spinner'), true);

  await store.set('portalCredentials', {
    username,
    password,
    savedAt: new Date().toISOString(),
  });

  await appendLog('Credentials saved. Auto-login is now active.', 'success');

  setBusy($('btn-setup-save'), $('setup-btn-text'), $('setup-spinner'), false);

  await loadDashboard();
  show('screen-dashboard');
});

// ══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD SCREEN
// ══════════════════════════════════════════════════════════════════════════════

// Track the message listener so we only add it once
let _msgListenerAdded = false;

async function loadDashboard() {
  // Show saved username
  const creds = await store.get('portalCredentials');
  $('dash-username').textContent = creds?.username ?? '—';

  // Last login time
  await refreshLastLogin();

  // Auto-login toggle state
  const settings = await store.get('extensionSettings') ?? {};
  $('toggle-auto').checked = settings.autoLoginEnabled !== false;

  // Ask service worker for current status
  try {
    chrome.runtime.sendMessage({ type: 'getStatus' }, (res) => {
      if (chrome.runtime.lastError) return; // SW may be sleeping — ignore
      if (res?.status) applyStatus(res.status);
    });
  } catch { /* service worker asleep — badge will update on next check */ }

  // Listen for live status pushes from service worker (add once only)
  if (!_msgListenerAdded) {
    _msgListenerAdded = true;
    try {
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
          if (msg?.type === 'statusUpdate') {
            applyStatus(msg.status);
            refreshLastLogin();
            renderLogs();
          }
        });
      }
    } catch { /* extension context unavailable */ }
  }

  // Render logs
  await renderLogs();
}

// Auto-login toggle
$('toggle-auto').addEventListener('change', async (e) => {
  const settings = await store.get('extensionSettings') ?? {};
  await store.set('extensionSettings', { ...settings, autoLoginEnabled: e.target.checked });
  await appendLog(`Auto-login ${e.target.checked ? 'enabled' : 'disabled'}.`, 'info');
});

// Refresh / manual check
$('btn-refresh').addEventListener('click', () => {
  const btn = $('btn-refresh');
  btn.classList.add('spin');
  applyStatus('CHECKING');
  try {
    chrome.runtime.sendMessage({ type: 'manualCheck' }, () => {
      if (chrome.runtime.lastError) { /* SW was asleep, it woke up and ran check */ }
      setTimeout(() => btn.classList.remove('spin'), 1800);
    });
  } catch {
    setTimeout(() => btn.classList.remove('spin'), 1800);
  }
});

// Open settings
$('btn-open-settings').addEventListener('click', async () => {
  await loadSettingsForm();
  show('screen-settings');
});

// ─── Status rendering ─────────────────────────────────────────────────────────

const STATUS = {
  CONNECTED:      { title: 'Connected',        sub: 'Internet access is available',         color: '#22c55e' },
  CAPTIVE_PORTAL: { title: 'Portal Detected',  sub: 'Captive portal found — logging in…',  color: '#ef4444' },
  CHECKING:       { title: 'Checking…',        sub: 'Verifying internet connection',        color: '#f59e0b' },
  OFFLINE:        { title: 'Offline',          sub: 'No network connection detected',       color: '#6b7280' },
  LOGGING_IN:     { title: 'Logging In…',      sub: 'Auto-filling portal credentials',     color: '#4f8ef7' },
};

function applyStatus(key) {
  const cfg = STATUS[key] ?? STATUS.CHECKING;
  $('status-title').textContent          = cfg.title;
  $('status-sub').textContent            = cfg.sub;
  $('status-dot').style.background       = cfg.color;
  $('pulse-ring').style.background       = cfg.color;
  $('status-card').style.borderColor     = cfg.color + '30';
}

// ─── Last login ───────────────────────────────────────────────────────────────

async function refreshLastLogin() {
  const last = await store.get('lastLogin');
  $('dash-last-login').textContent = last?.time
    ? new Date(last.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : 'Never';
}

// ─── Debug console ────────────────────────────────────────────────────────────

async function renderLogs() {
  const logs = await store.get('debugLogs') ?? [];
  const body = $('console-body');
  if (!logs.length) {
    body.innerHTML = '<div class="console-empty">No activity yet…</div>';
    return;
  }
  body.innerHTML = logs.map((e) => `
    <div class="log-line ${e.level ?? 'info'}">
      <span class="log-ts">${e.timestamp}</span>
      <span class="log-msg">${esc(e.message)}</span>
    </div>
  `).join('');
  body.scrollTop = body.scrollHeight;
}

async function appendLog(message, level = 'info') {
  const timestamp = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const logs    = await store.get('debugLogs') ?? [];
  const updated = [...logs, { timestamp, message, level }].slice(-50);
  await store.set('debugLogs', updated);
  await renderLogs();
}

$('btn-clear').addEventListener('click', async () => {
  await store.set('debugLogs', []);
  await renderLogs();
});

// Refresh logs every 3 s while popup is open
setInterval(renderLogs, 3000);

// ══════════════════════════════════════════════════════════════════════════════
//  SETTINGS SCREEN
// ══════════════════════════════════════════════════════════════════════════════

async function loadSettingsForm() {
  const creds    = await store.get('portalCredentials') ?? {};
  const settings = await store.get('extensionSettings') ?? {};

  $('edit-username').value = creds.username ?? '';

  // Show the existing password pre-filled so the user knows one is saved.
  // If no password is saved yet, leave blank so they know to enter one.
  $('edit-password').value       = creds.password ?? '';
  $('edit-password').placeholder = creds.password ? '(password saved — edit to change)' : 'Enter new password';

  $('pref-auto').checked        = settings.autoLoginEnabled !== false;
  $('pref-notify-ok').checked   = settings.notifyOnLogin    !== false;
  $('pref-notify-fail').checked = settings.notifyOnFailure  !== false;
}

$('btn-back').addEventListener('click', async () => {
  await loadDashboard();
  show('screen-dashboard');
});

// Save credentials
$('btn-save-creds').addEventListener('click', async () => {
  const username = $('edit-username').value.trim();
  const password = $('edit-password').value;
  const msg      = $('creds-saved-msg');

  // Validate — neither field may be blank
  if (!username) { showSettingsError('Student ID / Username cannot be empty.'); return; }
  if (!password) { showSettingsError('Password cannot be empty.'); return; }

  // Persist updated credentials
  await store.set('portalCredentials', {
    username, password,
    savedAt:   new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await appendLog(`Credentials updated for user: ${username}`, 'success');

  // Update dashboard username pill immediately
  $('dash-username').textContent = username;

  // Update the placeholder to reflect the newly saved password
  $('edit-password').placeholder = '(password saved — edit to change)';

  // Ping the service worker so it picks up the new credentials right away
  // (without waiting for the next 1-minute alarm cycle)
  try {
    chrome.runtime.sendMessage({ type: 'credentialsUpdated' }).catch(() => {});
  } catch { /* service worker asleep — it will read fresh creds on next wake */ }

  flashMsg(msg);
});

function showSettingsError(text) {
  // Reuse or create a small error banner inside the credentials card
  let errEl = $('creds-error-msg');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.id = 'creds-error-msg';
    errEl.className = 'msg msg-error';
    $('btn-save-creds').insertAdjacentElement('beforebegin', errEl);
  }
  errEl.textContent = text;
  errEl.classList.remove('hidden');
  setTimeout(() => errEl.classList.add('hidden'), 4000);
}

// Delete credentials → back to setup screen
$('btn-delete-creds').addEventListener('click', async () => {
  if (!confirm('Delete saved credentials? You will need to enter them again.')) return;
  await store.remove('portalCredentials');
  await appendLog('Credentials deleted.', 'warn');
  $('setup-username').value = '';
  $('setup-password').value = '';
  show('screen-setup');
});

// Save preferences
$('btn-save-prefs').addEventListener('click', async () => {
  const settings = await store.get('extensionSettings') ?? {};
  await store.set('extensionSettings', {
    ...settings,
    autoLoginEnabled: $('pref-auto').checked,
    notifyOnLogin:    $('pref-notify-ok').checked,
    notifyOnFailure:  $('pref-notify-fail').checked,
  });
  $('toggle-auto').checked = $('pref-auto').checked;
  flashMsg($('prefs-saved-msg'));
});

// ── Password eye toggles ───────────────────────────────────────────────────────

document.querySelectorAll('.eye-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.for);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

// ── Utility ────────────────────────────────────────────────────────────────────

function showMsg(el, text) {
  el.textContent = text;
  el.classList.remove('hidden');
}

function flashMsg(el) {
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function setBusy(btn, textEl, spinEl, busy) {
  btn.disabled = busy;
  textEl.classList.toggle('hidden', busy);
  spinEl.classList.toggle('hidden', !busy);
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Start ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', boot);
