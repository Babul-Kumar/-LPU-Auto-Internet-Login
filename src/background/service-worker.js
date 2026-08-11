// =============================================================================
// service-worker.js — Background Service Worker (MV3)
// Handles: internet detection, captive portal discovery, retry queue, badges
// =============================================================================

// MV3 service workers are ES modules when "type": "module" is set in manifest
// We import helpers inline here since service workers can't use dynamic import
// in all Chrome versions for chrome.storage. We'll use chrome.storage directly.

// ─── Constants ────────────────────────────────────────────────────────────────

const ALARM_NAME        = 'internetCheck';
// Plain HTTP so captive portals can intercept it (HTTPS blocks interception)
const CHECK_URL         = 'http://captive.apple.com';
// Exact 24Online client login page
const PORTAL_PROBE_URL  = 'http://internet.lpu.in/24online/webpages/client.jsp';
const CHECK_TIMEOUT_MS  = 5000;
const RETRY_DELAYS_MS   = [5000, 15000, 30000, 60000]; // exponential backoff

// Badge visual states
const BADGE_STATES = {
  CONNECTED:      { text: '',  color: '#22c55e', title: 'Connected to internet' },
  CAPTIVE_PORTAL: { text: '!', color: '#ef4444', title: 'Captive portal detected' },
  CHECKING:       { text: '…', color: '#f59e0b', title: 'Checking connection…' },
  OFFLINE:        { text: '✕', color: '#6b7280', title: 'No internet connection' },
  LOGGING_IN:     { text: '↑', color: '#3b82f6', title: 'Logging in…' },
};

// ─── State ─────────────────────────────────────────────────────────────────────

let retryAttempt      = 0;
let retryTimerId      = null;
let lastStatus        = 'CHECKING';
let isLoginInProgress = false;

// ─── Logger (inline — no ES module import in SW) ──────────────────────────────

async function log(message, level = 'info') {
  const timestamp = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  try {
    const result = await chrome.storage.local.get('debugLogs');
    const logs   = Array.isArray(result.debugLogs) ? result.debugLogs : [];
    const updated = [...logs, { timestamp, message, level }].slice(-50);
    await chrome.storage.local.set({ debugLogs: updated });
  } catch { /* silent fail */ }
  console.log(`[SW ${level.toUpperCase()}] ${timestamp} — ${message}`);
}

// ─── Badge Management ─────────────────────────────────────────────────────────

async function setBadge(status) {
  const state = BADGE_STATES[status] ?? BADGE_STATES.CHECKING;
  await chrome.action.setBadgeText({ text: state.text });
  await chrome.action.setBadgeBackgroundColor({ color: state.color });
  await chrome.action.setTitle({ title: `LPU Auto Login — ${state.title}` });
}

// ─── Internet Detection ────────────────────────────────────────────────────────

/**
 * Check internet connectivity with timeout and redirect detection.
 * @returns {Promise<'CONNECTED'|'CAPTIVE_PORTAL'|'OFFLINE'>}
 */
async function checkInternet() {
  await setBadge('CHECKING');
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    const response = await fetch(CHECK_URL, {
      method:      'GET',
      cache:       'no-store',
      redirect:    'follow',
      signal:      controller.signal,
    });
    clearTimeout(timeout);

    // captive.apple.com returns 200 with "Success" body when connected
    // If redirected or different response, a captive portal intercepted us
    if (response.ok && !response.redirected) {
      const text = await response.text();
      if (text.includes('Success') || response.status === 200) {
        // Do a secondary check — try generate_204 via HTTP
        try {
          const r2 = await fetch('http://clients3.google.com/generate_204', {
            method: 'GET', cache: 'no-store', redirect: 'manual',
            signal: AbortSignal.timeout(3000),
          });
          if (r2.status === 204 || r2.status === 0) return 'CONNECTED';
          return 'CAPTIVE_PORTAL';
        } catch { return 'CONNECTED'; } // if second probe fails, trust first
      }
      return 'CAPTIVE_PORTAL';
    }
    // redirect means portal intercepted our request
    return 'CAPTIVE_PORTAL';

  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      await log('Connection check timed out', 'warn');
      return 'CAPTIVE_PORTAL'; // timeout often means captive portal blocking
    }
    await log(`Connection check failed: ${err.message}`, 'error');
    return 'OFFLINE';
  }
}

// ─── Connection Status Broadcast ─────────────────────────────────────────────

async function broadcastStatus(status) {
  lastStatus = status;
  await chrome.storage.local.set({ connectionStatus: status });
  // Notify popup if it's open
  try {
    chrome.runtime.sendMessage({ type: 'statusUpdate', status }).catch(() => {});
  } catch { /* popup may not be open */ }
}

// ─── Silent Background Login ──────────────────────────────────────────────────

/**
 * Attempt to log in to the captive portal entirely in the background.
 * No tab is opened — all HTTP happens inside the service worker via fetch().
 *
 * Strategy:
 *   1. GET the portal page → parse the HTML to find form fields + action URL
 *   2. Build a URLSearchParams payload with username, password, + any hidden fields
 *   3. POST the form → follow redirects → verify we are now connected
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<'CONNECTED'|'FAILED'|'OFFLINE'>}
 */
async function silentLogin(username, password) {
  const settingsResult = await chrome.storage.local.get('extensionSettings');
  const settings       = settingsResult.extensionSettings ?? {};
  const portalUrl      = settings.portalUrl?.trim() || PORTAL_PROBE_URL;

  await log(`Silent login: fetching portal page at ${portalUrl}`, 'info');

  // ── Step 1: GET the portal page ─────────────────────────────────────────────
  let portalHtml, portalBase;
  try {
    const res = await fetch(portalUrl, {
      method:   'GET',
      cache:    'no-store',
      redirect: 'follow',
    });
    portalHtml = await res.text();
    portalBase = res.url; // may have redirected — use final URL as base
    await log(`Portal page fetched (${res.status}) from ${portalBase}`, 'info');
  } catch (err) {
    await log(`Failed to fetch portal page: ${err.message}`, 'error');
    return 'OFFLINE';
  }

  // ── Step 2: Parse the login form ────────────────────────────────────────────
  // We parse with DOMParser (available in service workers via offscreen workaround),
  // or fall back to regex extraction when DOMParser is unavailable.
  let formAction = portalBase;
  const payload  = new URLSearchParams();

  try {
    // Extract all hidden fields (session tokens, CSRF, etc.)
    const hiddenRe = /<input[^>]+type=["']hidden["'][^>]*>/gi;
    let match;
    while ((match = hiddenRe.exec(portalHtml)) !== null) {
      const tag   = match[0];
      const name  = /name=["']([^"']+)["']/i.exec(tag)?.[1];
      const value = /value=["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
      if (name) payload.set(name, value);
    }

    // ── Detect and include the "I Agree" checkbox ──────────────────────────────
    // 24Online portals require an agree/terms checkbox to be checked.
    // Without this the server returns HTTP 200 with the same login page (not an error
    // status) — which is why the POST succeeds but the session is never created.
    const agreeFieldNames = [
      'agreeFlag', 'agree', 'I_AGREE', 'iAgree', 'agreecheck',
      'agree_flag', 'termsAgree', 'acceptTerms', 'terms',
    ];
    // Check if any of these appear as a checkbox in the HTML
    let agreeField = null;
    for (const af of agreeFieldNames) {
      // Match a checkbox input with this name
      if (new RegExp(`name=["']${af}["']`, 'i').test(portalHtml)) {
        agreeField = af;
        break;
      }
    }
    // 24Online default: agreeFlag is always required even if not found by regex
    agreeField = agreeField ?? 'agreeFlag';
    payload.set(agreeField, '1');
    await log(`Agree checkbox field: ${agreeField}=1`, 'info');

    // Extract form action URL
    const actionMatch = /<form[^>]+action=["']([^"']+)["']/i.exec(portalHtml);
    if (actionMatch) {
      const rawAction = actionMatch[1];
      // Resolve relative URL against the portal base
      formAction = new URL(rawAction, portalBase).href;
    }

    // Extract username field name
    // 24Online client.jsp uses 'userId' — check that first, then common fallbacks
    const userFieldNames = ['userId', 'username', 'userid', 'user_name', 'user', 'loginid', 'login', 'email'];
    let userField = 'userId'; // 24Online default
    for (const name of userFieldNames) {
      if (new RegExp(`name=["']${name}["']`, 'i').test(portalHtml)) {
        userField = name;
        break;
      }
    }

    // Extract password field name (fallback to 'password')
    const passFieldNames = ['password', 'passwd', 'pass', 'pwd'];
    let passField = 'password';
    for (const name of passFieldNames) {
      if (new RegExp(`name=["']${name}["']`, 'i').test(portalHtml)) {
        passField = name;
        break;
      }
    }

    // Inject credentials into payload (override any pre-filled hidden values)
    payload.set(userField, username);
    payload.set(passField, password);

    await log(`Form: action=${formAction}, userField=${userField}, passField=${passField}`, 'info');

  } catch (parseErr) {
    // Parsing failed — fall back to minimal payload with agree flag + credentials
    await log(`Form parse warning: ${parseErr.message} — using minimal payload`, 'warn');
    payload.set('username', username);
    payload.set('password', password);
    payload.set('agreeFlag', '1'); // always include agree for 24Online portals
  }

  // ── Step 3: POST the login form ─────────────────────────────────────────────
  await log(`Submitting credentials silently… payload keys: ${[...payload.keys()].join(', ')}`, 'info');
  try {
    const postRes = await fetch(formAction, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    payload.toString(),
      redirect: 'follow',
      cache:   'no-store',
    });
    const postBody = await postRes.text();
    await log(`Login POST returned ${postRes.status} (${postRes.url})`, 'info');
    // If the response still contains the login form, the agree checkbox or credentials were rejected
    if (/login|sign.?in|client\.jsp|agreeFlag|I_AGREE/i.test(postBody) && postRes.status === 200) {
      await log('POST response looks like the login page again — possible missing agree field or wrong credentials', 'warn');
    }
  } catch (postErr) {
    await log(`Login POST failed: ${postErr.message}`, 'error');
    return 'FAILED';
  }

  // ── Step 4: Verify connection after login ────────────────────────────────────
  // Give the server a moment to process the session
  await new Promise(r => setTimeout(r, 2000));
  const status = await checkInternet();
  await log(`Post-login connectivity check: ${status}`, status === 'CONNECTED' ? 'success' : 'warn');
  return status === 'CONNECTED' ? 'CONNECTED' : 'FAILED';
}

// ─── Retry Queue ─────────────────────────────────────────────────────────────

function clearRetryTimer() {
  if (retryTimerId !== null) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }
}

async function scheduleRetry() {
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempt++;
  await log(`Scheduling retry ${retryAttempt} in ${delay / 1000}s`, 'warn');
  clearRetryTimer();
  retryTimerId = setTimeout(handleCaptivePortal, delay);
}

function resetRetryState() {
  retryAttempt = 0;
  clearRetryTimer();
  isLoginInProgress = false;
}

// Notifications intentionally disabled — extension runs 100% silently.
// All activity is logged to the popup Activity Log instead.

// ─── Core Flow: Handle Captive Portal ─────────────────────────────────────────

async function handleCaptivePortal() {
  if (isLoginInProgress) return; // prevent concurrent attempts
  isLoginInProgress = true;

  await log('Captive portal detected — initiating silent auto-login', 'warn');
  await setBadge('CAPTIVE_PORTAL');
  await broadcastStatus('CAPTIVE_PORTAL');

  // Check if credentials are saved
  const credsResult = await chrome.storage.local.get('portalCredentials');
  const creds = credsResult.portalCredentials;

  if (!creds?.username || !creds?.password) {
    await log('No credentials saved — please save credentials in the extension popup.', 'warn');
    isLoginInProgress = false;
    return;
  }

  await setBadge('LOGGING_IN');
  await log(`Silent login starting for user: ${creds.username}`, 'info');

  // All login work happens in the background — no tab is opened
  const result = await silentLogin(creds.username, creds.password);

  if (result === 'CONNECTED') {
    await handleConnected();
  } else if (result === 'OFFLINE') {
    await handleOffline();
  } else {
    await log('Silent login failed — scheduling retry', 'warn');
    isLoginInProgress = false;
    await scheduleRetry();
  }
}

async function handleConnected() {
  resetRetryState();
  await setBadge('CONNECTED');
  await broadcastStatus('CONNECTED');
  await log('Internet connected successfully ✓', 'success');

  // Record last login time
  await chrome.storage.local.set({
    lastLogin: {
      success:   true,
      time:      new Date().toISOString(),
      portalUrl: 'https://internet.lpu.in/',
    },
  });


}

async function handleOffline() {
  await setBadge('OFFLINE');
  await broadcastStatus('OFFLINE');
  await log('No internet — device appears to be offline', 'warn');
  isLoginInProgress = false;
}

// ─── Main Check Cycle ─────────────────────────────────────────────────────────

async function runInternetCheck() {
  const result   = await chrome.storage.local.get('extensionSettings');
  const settings = result.extensionSettings ?? {};

  if (settings.autoLoginEnabled === false) {
    await log('Auto-login disabled by user', 'info');
    return;
  }

  const status = await checkInternet();
  await log(`Connection check: ${status}`, status === 'CONNECTED' ? 'success' : 'warn');

  if (status === 'CONNECTED') {
    if (lastStatus !== 'CONNECTED') await handleConnected(); // avoid repeat notifications
    else { await setBadge('CONNECTED'); await broadcastStatus('CONNECTED'); }
    resetRetryState();

  } else if (status === 'CAPTIVE_PORTAL') {
    await handleCaptivePortal();

  } else {
    await handleOffline();
  }
}

// ─── Message Handling ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type } = message;

  if (type === 'getCredentials') {
    chrome.storage.local.get('portalCredentials').then((result) => {
      sendResponse({ credentials: result.portalCredentials ?? null });
    });
    return true; // keep message channel open for async response
  }

  if (type === 'log') {
    log(message.message, 'info');
    return;
  }

  if (type === 'loginAttempted') {
    log(`Content script: login submitted (${message.data?.portalName})`, 'info');
    isLoginInProgress = false;
    return;
  }

  if (type === 'loginFailed') {
    log(`Content script: login failed — ${message.message}`, 'error');
    isLoginInProgress = false;
    scheduleRetry();
    return;
  }

  if (type === 'portalPageDetected') {
    log(`Content script: ${message.message}`, 'info');
    return;
  }

  if (type === 'manualCheck') {
    runInternetCheck();
    sendResponse({ ok: true });
    return;
  }

  if (type === 'getStatus') {
    sendResponse({ status: lastStatus });
    return;
  }

  if (type === 'credentialsUpdated') {
    // User saved new credentials — run a check immediately so the new
    // creds are picked up without waiting for the next 1-minute alarm.
    log('Credentials updated — triggering immediate re-check', 'info');
    runInternetCheck();
    sendResponse({ ok: true });
    return;
  }
});

// ─── Alarm Setup ──────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await runInternetCheck();
  }
});

// ─── Extension Lifecycle ──────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  await log(`Extension ${details.reason}: LPU Auto Internet Login v1.0`, 'info');

  // Set up periodic alarm (minimum 1 minute in MV3)
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes:  0.1, // first check after 6 seconds
    periodInMinutes: 1,
  });

  // No install notification — extension starts silently.
});

chrome.runtime.onStartup.addListener(async () => {
  await log('Extension startup — beginning internet monitoring', 'info');
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes:  0.1,
    periodInMinutes: 1,
  });
  await runInternetCheck();
});



// Initial check when service worker wakes up
runInternetCheck();
