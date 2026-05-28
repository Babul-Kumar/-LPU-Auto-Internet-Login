// =============================================================================
// portal-registry.js — Portal recognition layer
// Runs as content script — detects which portal type the current page is
// and exposes the best config for auto-login
// =============================================================================

/**
 * Portal configuration registry.
 * Each entry has:
 *   - name:              Human-readable portal name
 *   - match(hostname):   Returns true if this config applies
 *   - usernameSelector:  CSS selector for username field (null = smart detect)
 *   - passwordSelector:  CSS selector for password field
 *   - submitSelector:    CSS selector for submit button
 *   - preLoginHook:      Optional function to run before fill (e.g., click a tab)
 */
const PORTAL_REGISTRY = [
  // ── LPU Campus Portal — https://internet.lpu.in/ ───────────────────────────
  {
    name: 'LPU Campus Portal',
    match: (hostname) =>
      hostname === 'internet.lpu.in'    ||  // exact match — primary
      hostname.includes('internet.lpu') ||  // subdomains
      hostname.includes('lpu.in')       ||  // any lpu.in domain
      hostname.includes('172.16')       ||  // LPU internal gateway IP range
      hostname.includes('lpunest'),         // LPU nest portal
    usernameSelector: [
      // Most specific first
      'input[name="username"]',
      'input[name="userid"]',
      'input[name="user_name"]',
      'input[name="user"]',
      'input[name="loginid"]',
      'input[id="username"]',
      'input[id="userid"]',
      'input[id="user"]',
    ].join(', '),
    passwordSelector: [
      'input[type="password"]',
      'input[name="password"]',
      'input[id="password"]',
    ].join(', '),
    submitSelector: [
      'button[type="submit"]',
      'input[type="submit"]',
      'input[value="Login"]',
      'input[value="Sign In"]',
      'input[value="LOG IN"]',
      '#loginbtn',
      '.login-btn',
      'button.btn',
    ].join(', '),
  },

  // ── IIT-style / Cisco Meraki portals ───────────────────────────────────────
  {
    name: 'Cisco Meraki / ISE Portal',
    match: (hostname) =>
      hostname.includes('meraki') ||
      hostname.includes('cisco') ||
      hostname.includes('ise'),
    usernameSelector: '#user, input[name="user"]',
    passwordSelector: '#password, input[name="password"]',
    submitSelector: '#aupAgreeButton, button[type="submit"]',
  },

  // ── Aruba ClearPass ────────────────────────────────────────────────────────
  {
    name: 'Aruba ClearPass Portal',
    match: (hostname) =>
      hostname.includes('aruba') ||
      hostname.includes('clearpass'),
    usernameSelector: '#username, input[name="username"]',
    passwordSelector: '#password, input[name="password"]',
    submitSelector: 'button[type="submit"], .submit-btn',
  },

  // ── Generic / Universal Fallback ───────────────────────────────────────────
  {
    name: 'Generic Portal',
    match: () => true,
    usernameSelector: null,   // triggers smart detection in autologin.js
    passwordSelector: 'input[type="password"]',
    submitSelector: [
      'button[type="submit"]',
      'input[type="submit"]',
      'button.login',
      'button.signin',
      '.login-btn',
      '.submit',
    ].join(', '),
  },
];

/**
 * Get the best-matching portal config for the current page.
 * @returns {Object} Portal config object
 */
function detectPortalConfig() {
  const hostname = location.hostname.toLowerCase();
  const config = PORTAL_REGISTRY.find((p) => p.match(hostname));
  return config ?? PORTAL_REGISTRY[PORTAL_REGISTRY.length - 1]; // fallback to generic
}

/**
 * Check if the current page looks like a captive portal login page.
 * Uses multiple heuristics for reliability.
 * @returns {boolean}
 */
function looksLikeLoginPage() {
  // Must have a password field
  const hasPasswordField = !!document.querySelector('input[type="password"]');
  if (!hasPasswordField) return false;

  // Additional confidence signals
  const signals = [
    !!document.querySelector('form'),
    !!document.querySelector('input[type="text"], input[type="email"]'),
    /login|sign.?in|auth|portal|connect|captive/i.test(document.title),
    /login|sign.?in|auth|portal|connect|captive/i.test(location.pathname),
    /login|sign.?in|auth|portal|connect|captive/i.test(location.hostname),
  ];

  const confidence = signals.filter(Boolean).length;
  return confidence >= 1; // password field + at least 1 more signal
}

// Expose to autologin.js via window (same content script context)
window.__portalRegistry = {
  detectPortalConfig,
  looksLikeLoginPage,
  PORTAL_REGISTRY,
};
