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
  // ── 24Online Client Portal (LPU) — http://internet.lpu.in/24online/webpages/client.jsp
  // This is the actual login system LPU uses. Highest priority.
  {
    name: '24Online Client Portal (LPU)',
    match: (hostname, pathname) =>
      hostname === 'internet.lpu.in' ||
      pathname.includes('24online')  ||
      pathname.includes('client.jsp'),
    usernameSelector: 'input[name="userId"], input[id="userId"]',
    passwordSelector: 'input[name="password"], input[type="password"]',
    submitSelector:   'input[name="btnLogin"], input[type="submit"]',
  },

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

  // ── Generic / Universal Captive Portal Fallback ─────────────────────────────
  {
    name: 'Generic Captive Portal',
    match: (hostname, pathname) => {
      // Never match public sites like google.com, github.com
      const publicSites = ['google.com', 'github.com', 'microsoft.com', 'amazon.com', 'facebook.com'];
      if (publicSites.some(d => hostname === d || hostname.endsWith('.' + d))) return false;

      // Only match if it looks like a campus IP or captive gateway
      return (
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
        pathname.includes('captive') ||
        pathname.includes('portal')
      );
    },
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
 * @returns {Object|null} Portal config object or null
 */
function detectPortalConfig() {
  const hostname = location.hostname.toLowerCase();
  const pathname = location.pathname.toLowerCase();
  const config = PORTAL_REGISTRY.find((p) => p.match(hostname, pathname));
  return config ?? null;
}

/**
 * Check if the current page looks like a captive portal login page.
 * @returns {boolean}
 */
function looksLikeLoginPage() {
  const hasPasswordField = !!document.querySelector('input[type="password"]');
  if (!hasPasswordField) return false;
  return detectPortalConfig() !== null;
}

// Expose to autologin.js via window (same content script context)
window.__portalRegistry = {
  detectPortalConfig,
  looksLikeLoginPage,
  PORTAL_REGISTRY,
};
