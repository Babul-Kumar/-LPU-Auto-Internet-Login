// =============================================================================
// autologin.js — Auto-fill and submit the LPU captive portal login form
// Triggered automatically whenever internet.lpu.in loads
// =============================================================================

(function () {
  'use strict';

  // Don't run on internal Chrome or extension pages
  if (location.protocol === 'chrome-extension:' || location.protocol === 'chrome:') return;

  // ─── Is this a login page? ────────────────────────────────────────────────
  // For internet.lpu.in we check the hostname directly (fast path).
  // For any other page we fall back to heuristic detection.

  function isLPUPortal() {
    const h = location.hostname.toLowerCase();
    const p = location.pathname.toLowerCase();
    return (
      h === 'internet.lpu.in' ||
      h.includes('lpu.in')    ||
      h.includes('internet.lpu') ||
      // 24Online paths are a strong signal regardless of hostname
      p.includes('24online') ||
      p.includes('client.jsp')
    );
  }

  function looksLikeLoginPage() {
    // Must have a password field — that's the hard requirement
    if (!document.querySelector('input[type="password"]')) return false;

    // If it's the LPU portal hostname, trust it immediately
    if (isLPUPortal()) return true;

    // Otherwise need at least one more signal for confidence
    return (
      !!document.querySelector('form') ||
      !!document.querySelector('input[type="text"], input[type="email"]') ||
      /login|sign.?in|auth|portal|connect|captive/i.test(document.title + location.href)
    );
  }

  // ─── Field Finders ────────────────────────────────────────────────────────

  function findUsernameField() {
    // Priority: named/id attributes → type-based → proximity to password field
    const candidates = [
      // 24Online client.jsp specific
      'input[name="userId"]',
      'input[id="userId"]',
      // Common patterns
      'input[name="username"]',
      'input[name="userid"]',
      'input[name="user_name"]',
      'input[name="user"]',
      'input[name="loginid"]',
      'input[name="login"]',
      'input[name="email"]',
      'input[id="username"]',
      'input[id="userid"]',
      'input[id="user"]',
      'input[id="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[type="email"]',
    ];

    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    }

    // Proximity fallback: look for the first non-password input inside the same form
    const pw = document.querySelector('input[type="password"]');
    if (pw) {
      const form = pw.closest('form');
      if (form) {
        const inputs = [...form.querySelectorAll(
          'input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])'
        )].filter(isVisible);
        if (inputs.length) return inputs[0];
      }
      // Broadest fallback: any visible text input before the password field in the DOM
      const all = [...document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])')];
      const before = all.filter(el => el !== pw && isVisible(el));
      if (before.length) return before[0];
    }

    return null;
  }

  function findPasswordField() {
    return (
      document.querySelector('input[type="password"]') ||
      document.querySelector('input[name="password"]') ||
      document.querySelector('input[id="password"]') ||
      null
    );
  }

  function findSubmitButton() {
    const selectors = [
      // 24Online specific
      'input[name="btnLogin"]',
      'input[value="Login"]',
      'input[value="Log In"]',
      'input[value="LOG IN"]',
      'input[value="Sign In"]',
      'input[value="Submit"]',
      // Generic
      'input[type="submit"]',
      'button[type="submit"]',
      'button[value="Login"]',
      '#loginbtn',
      '.login-btn',
      'button.btn',
      // Last resort: any button that isn't explicitly type="button"
      'button:not([type="button"])',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && el.offsetParent !== null;
  }

  // ─── Fill a field (works with React / Vue / plain HTML) ──────────────────

  function fill(field, value) {
    field.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(field, value);
    else field.value = value;
    field.dispatchEvent(new Event('input',  { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Tell the service worker what happened ────────────────────────────────

  function tell(type, message = '', data = {}) {
    try { chrome.runtime.sendMessage({ type, message, data }); } catch {}
  }

  // ─── Main ─────────────────────────────────────────────────────────────────

  async function main() {
    if (!looksLikeLoginPage()) return;

    const portalName = isLPUPortal() ? 'LPU Campus Portal' : 'Captive Portal';
    tell('log', `[AutoLogin] Page ready: ${portalName} (${location.hostname})`);

    // Ask the service worker for saved credentials
    chrome.runtime.sendMessage({ type: 'getCredentials' }, async (response) => {
      if (chrome.runtime.lastError || !response?.credentials) {
        tell('log', '[AutoLogin] No credentials saved yet — open the extension to set them up.');
        return;
      }

      const { username, password } = response.credentials;

      // Short wait so any JS-rendered form fields finish mounting
      await wait(400);

      const usernameField = findUsernameField();
      const passwordField = findPasswordField();
      const submitBtn     = findSubmitButton();

      if (!usernameField) { tell('loginFailed', 'Username field not found on page'); return; }
      if (!passwordField) { tell('loginFailed', 'Password field not found on page'); return; }
      if (!submitBtn)     { tell('loginFailed', 'Submit button not found on page');   return; }

      tell('log', `[AutoLogin] Filling credentials for ${username}…`);

      fill(usernameField, username);
      await wait(200);
      fill(passwordField, password);
      await wait(300);

      tell('log', '[AutoLogin] Submitting form…');
      submitBtn.click();

      // If click didn't cause navigation, also try form.submit()
      const form = submitBtn.closest('form') ?? passwordField.closest('form');
      if (form && submitBtn.type !== 'submit') {
        await wait(200);
        try { form.submit(); } catch {}
      }

      tell('loginAttempted', 'Form submitted', { portalName });
    });
  }

  // Run once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
