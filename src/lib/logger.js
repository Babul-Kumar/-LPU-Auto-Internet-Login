// =============================================================================
// logger.js — Ring-buffer debug logger (last 50 entries in chrome.storage.local)
// No Supabase dependency.
// =============================================================================

const MAX_LOGS   = 50;
const STORAGE_KEY = 'debugLogs';

export const LogLevel = {
  INFO:    'info',
  SUCCESS: 'success',
  WARN:    'warn',
  ERROR:   'error',
};

export async function log(message, level = LogLevel.INFO) {
  const timestamp = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  try {
    const result  = await chrome.storage.local.get(STORAGE_KEY);
    const logs    = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const updated = [...logs, { timestamp, message, level }].slice(-MAX_LOGS);
    await chrome.storage.local.set({ [STORAGE_KEY]: updated });
  } catch { /* never crash the extension over a log failure */ }
}

export async function getLogs() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  } catch { return []; }
}

export async function clearLogs() {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
}
