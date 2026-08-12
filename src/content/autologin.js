// =============================================================================
// autologin.js — Auto-fill and submit the LPU captive portal login form
// Triggered automatically whenever internet.lpu.in loads
// =============================================================================

(function () {
  'use strict';

  // Don't run on internal Chrome or extension pages
  if (location.protocol === 'chrome-extension:' || location.protocol === 'chrome:') return;

  // ─── Is this a login page? ────────────────────────────────────────────────

  function isLPUPortal() {
    const h = location.hostname.toLowerCase();
    const p = location.pathname.toLowerCase();
    return (
      h === 'internet.lpu.in' ||
      h.includes('lpu.in')    ||
      h.includes('internet.lpu') ||
      p.includes('24online')  ||
      p.includes('client.jsp')
    );
  }

  function looksLikeLoginPage() {
    if (!document.querySelector('input[type="password"]')) return false;
    if (isLPUPortal()) return true;
    return (
      !!document.querySelector('form') ||
      !!document.querySelector('input[type="text"], input[type="email"]') ||
      /login|sign.?in|auth|portal|connect|captive/i.test(document.title + location.href)
    );
  }

  // ─── Field Finders ────────────────────────────────────────────────────────

  function findUsernameField() {
    const candidates = [
      'input[name="userId"]',
      'input[id="userId"]',
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

    const pw = document.querySelector('input[type="password"]');
    if (pw) {
      const form = pw.closest('form');
      if (form) {
        const inputs = [...form.querySelectorAll(
          'input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"])'
        )].filter(isVisible);
        if (inputs.length) return inputs[0];
      }
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
      'input[name="btnLogin"]',
      'input[value="Login"]',
      'input[value="Log In"]',
      'input[value="LOG IN"]',
      'input[value="Sign In"]',
      'input[value="Submit"]',
      'input[type="submit"]',
      'button[type="submit"]',
      'button[value="Login"]',
      '#loginbtn',
      '.login-btn',
      'button.btn',
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

  // ─── Fill a field (fires full event sequence for JS validation) ──────────

  function fill(field, value) {
    field.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(field, value);
    else field.value = value;

    const eventTypes = ['keydown', 'keypress', 'input', 'keyup', 'change'];
    for (const type of eventTypes) {
      try { field.dispatchEvent(new Event(type, { bubbles: true })); } catch {}
    }
    field.blur();
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ─── Tell the service worker what happened ────────────────────────────────

  function tell(type, message = '', data = {}) {
    try { chrome.runtime.sendMessage({ type, message, data }); } catch {}
  }

  // ─── Checkbox clicker (triggers inline onclick handlers & validation) ──

  function checkCheckbox(el) {
    if (!el) return false;

    // Native .click() is essential: setting el.checked = true in JS does NOT
    // execute inline onclick="..." validation handlers on legacy JSP pages.
    try {
      if (!el.checked) el.click();
    } catch {}

    // Ensure state is checked
    if (!el.checked) {
      el.checked = true;
    }

    // Fire events in case click() didn't trigger change/input handlers
    const events = ['click', 'change', 'input'];
    for (const ev of events) {
      try {
        if (ev === 'click') {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        } else {
          el.dispatchEvent(new Event(ev, { bubbles: true }));
        }
      } catch {}
    }

    // Also click any associated <label> element
    try {
      let label = null;
      if (el.id) label = document.querySelector(`label[for="${el.id}"]`);
      if (!label) label = el.closest('label');
      if (!label && el.parentElement) label = el.parentElement.querySelector('label');
      if (label && label !== el) {
        try { label.click(); } catch {}
      }
    } catch {}

    return true;
  }

  // ─── Find & tick the "I Agree" checkbox ──────────────────────────────────

  function findAndCheckAgreeBox() {
    const nameSelectors = [
      'input[name="agreeFlag"]',
      'input[name="agree"]',
      'input[name="I_AGREE"]',
      'input[name="iAgree"]',
      'input[name="agreecheck"]',
      'input[name="agree_flag"]',
      'input[name="termsAgree"]',
      'input[name="acceptTerms"]',
      'input[name="terms"]',
      'input[id="agreeFlag"]',
      'input[id="agree"]',
    ];

    for (const sel of nameSelectors) {
      const el = document.querySelector(sel);
      if (el && el.type === 'checkbox') {
        checkCheckbox(el);
        tell('log', `[AutoLogin] Checked agree checkbox: ${sel}`);
        return true;
      }
    }

    // Fallback: search all checkboxes for context containing 'agree', 'terms', 'condition'
    const allCheckboxes = [...document.querySelectorAll('input[type="checkbox"]')];
    for (const cb of allCheckboxes) {
      const context = (cb.closest('label,p,div,td,li,span,tr') ?? cb.parentElement)?.textContent ?? '';
      if (/agree|terms|accept|condition/i.test(context)) {
        checkCheckbox(cb);
        tell('log', '[AutoLogin] Checked agree checkbox via heuristic');
        return true;
      }
    }

    // Fallback 2: if there's a checkbox on page that is NOT "Save Password", check it
    for (const cb of allCheckboxes) {
      const context = (cb.closest('label,p,div,td,li,span,tr') ?? cb.parentElement)?.textContent ?? '';
      if (!/save.?password/i.test(context)) {
        checkCheckbox(cb);
        tell('log', '[AutoLogin] Checked non-save-password checkbox');
        return true;
      }
    }

    tell('log', '[AutoLogin] No agree checkbox found — proceeding without it');
    return false;
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
      await wait(200);

      // Tick the "I Agree" checkbox BEFORE attempting login
      findAndCheckAgreeBox();
      await wait(300);

      // Force enable the submit button in case page JS left it disabled
      try {
        submitBtn.removeAttribute('disabled');
        submitBtn.disabled = false;
        submitBtn.style.pointerEvents = 'auto';
        submitBtn.style.opacity = '1';
        submitBtn.classList.remove('disabled');
      } catch {}

      tell('log', '[AutoLogin] Submitting form…');

      // Primary submission: click the button
      try { submitBtn.click(); } catch {}

      // Secondary submission: form.submit() if click didn't trigger navigation
      const form = submitBtn.closest('form') ?? passwordField.closest('form');
      if (form) {
        await wait(300);
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
