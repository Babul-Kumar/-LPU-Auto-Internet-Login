// =============================================================================
// credentials.js — All credential + settings management via chrome.storage.local
// No Supabase. No encryption. Sandboxed local storage only.
// =============================================================================

const CREDS_KEY    = 'portalCredentials';
const SETTINGS_KEY = 'extensionSettings';

export const DEFAULT_SETTINGS = {
  autoLoginEnabled:  true,
  checkIntervalMins: 1,
  maxRetries:        4,
  portalUrl:         'https://internet.lpu.in/',  // LPU captive portal
  notifyOnLogin:     true,
  notifyOnFailure:   true,
};

// ─── Credentials ──────────────────────────────────────────────────────────────

export async function saveCredentials({ portalUrl, username, password }) {
  if (!username || !password) throw new Error('Username and password are required.');
  await chrome.storage.local.set({
    [CREDS_KEY]: {
      portalUrl: portalUrl?.trim() || '',
      username:  username.trim(),
      password,
      savedAt:   new Date().toISOString(),
    },
  });
}

export async function getCredentials() {
  const r = await chrome.storage.local.get(CREDS_KEY);
  return r[CREDS_KEY] ?? null;
}

export async function deleteCredentials() {
  await chrome.storage.local.remove(CREDS_KEY);
}

export async function hasCredentials() {
  const c = await getCredentials();
  return !!c?.username && !!c?.password;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings() {
  const r = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(r[SETTINGS_KEY] ?? {}) };
}

export async function updateSettings(partial) {
  const current = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...partial } });
}

// ─── Session State ────────────────────────────────────────────────────────────

export async function setLastLoginState(state) {
  await chrome.storage.local.set({
    lastLogin: { ...state, time: state.time ?? new Date().toISOString() },
  });
}

export async function getLastLoginState() {
  const r = await chrome.storage.local.get('lastLogin');
  return r.lastLogin ?? null;
}

export async function getConnectionStatus() {
  const r = await chrome.storage.local.get('connectionStatus');
  return r.connectionStatus ?? 'CHECKING';
}

export async function setConnectionStatus(status) {
  await chrome.storage.local.set({ connectionStatus: status });
}
