// =============================================================================
// autologin.js — Auto-fill and submit the LPU captive portal login form
// Triggered automatically whenever internet.lpu.in loads
// =============================================================================

(function () {
  'use strict';

  // Don't run on internal Chrome or extension pages
  if (location.protocol === 'chrome-extension:' || location.protocol === 'chrome:') return;

  // ─── Domain & Campus Portal Detection ─────────────────────────────────────

  const PUBLIC_SITE_DOMAINS = [
    'google.com', 'github.com', 'microsoft.com', 'live.com', 'outlook.com', 'office.com',
    'amazon.com', 'amazon.in', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
    'linkedin.com', 'netflix.com', 'apple.com', 'icloud.com', 'youtube.com', 'reddit.com',
    'stackoverflow.com', 'chatgpt.com', 'openai.com', 'dropbox.com', 'adobe.com', 'zoom.us',
    'discord.com', 'spotify.com', 'twitch.tv', 'pinterest.com', 'whatsapp.com', 'telegram.org',
    'medium.com', 'wikipedia.org', 'gitlab.com', 'bitbucket.org', 'yahoo.com', 'bing.com'
  ];

  function isKnownPublicWebsite(hostname) {
    return PUBLIC_SITE_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  }

  function isCampusIP(hostname) {
    return (
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    );
  }

  function isLPUPortal() {
    const h = location.hostname.toLowerCase();
    const p = location.pathname.toLowerCase();

    // Explicitly reject known public websites (e.g. github.com, google.com)
    if (isKnownPublicWebsite(h)) return false;

    // Direct match on LPU domain / subdomains / 24online path / campus gateway IP
    if (
      h === 'internet.lpu.in' ||
      h.includes('lpu.in')    ||
      h.includes('internet.lpu') ||
      p.includes('24online')  ||
      p.includes('client.jsp') ||
      p.includes('e24onlinehttpclient') ||
      isCampusIP(h)
    ) {
      return true;
    }

    // Signature DOM element check for 24online / LPU portal
    if (
      document.querySelector('input[name="userId"]') ||
      document.querySelector('input[name="agreeFlag"]') ||
      /lovely professional university|24online/i.test(document.title + ' ' + (document.body?.innerText ?? ''))
    ) {
      return true;
    }

    return false;
  }

  function looksLikeLoginPage() {
    // Must have a password field
    if (!document.querySelector('input[type="password"]')) return false;

    // Reject public internet websites immediately
    if (isKnownPublicWebsite(location.hostname.toLowerCase())) return false;

    // Must strictly match LPU / captive portal domain or DOM signature
    return isLPUPortal();
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

  // ─── Checkbox clicker ─────────────────────────────────────────────────────

  function checkCheckbox(el) {
    if (!el) return false;

    if (el.checked) return true;

    try {
      el.click();
    } catch {}

    if (!el.checked) {
      el.checked = true;
    }

    try {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {}

    return true;
  }

  // ─── Find & tick the "I Agree" checkbox ──────────────────────────────────

  function findAndCheckAgreeBox() {
    // 1. Inject hidden agreeFlag=1 into all forms so 24Online servlet receives it
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      let hiddenAgree = form.querySelector('input[name="agreeFlag"]');
      if (!hiddenAgree) {
        hiddenAgree = document.createElement('input');
        hiddenAgree.type = 'hidden';
        hiddenAgree.name = 'agreeFlag';
        form.appendChild(hiddenAgree);
      }
      hiddenAgree.value = '1';
    });

    // 2. Search by known name/id attributes
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

    // 3. Search all checkboxes for context containing 'agree', 'terms', 'condition', 'policy'
    const allCheckboxes = [...document.querySelectorAll('input[type="checkbox"]')];
    for (const cb of allCheckboxes) {
      const context = (cb.closest('label,p,div,td,li,span,tr') ?? cb.parentElement)?.textContent ?? '';
      if (/agree|terms|accept|condition|policy/i.test(context)) {
        checkCheckbox(cb);
        tell('log', '[AutoLogin] Checked agree checkbox via heuristic');
        return true;
      }
    }

    // 4. Check any checkbox on page that is NOT "Save Password"
    for (const cb of allCheckboxes) {
      const context = (cb.closest('label,p,div,td,li,span,tr') ?? cb.parentElement)?.textContent ?? '';
      if (!/save.?password/i.test(context)) {
        checkCheckbox(cb);
        tell('log', '[AutoLogin] Checked non-save-password checkbox');
        return true;
      }
    }

    tell('log', '[AutoLogin] Injected agreeFlag=1 hidden field');
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

      const usernameField = findUsernameField();
      const passwordField = findPasswordField();
      const submitBtn     = findSubmitButton();

      if (!usernameField) { tell('loginFailed', 'Username field not found on page'); return; }
      if (!passwordField) { tell('loginFailed', 'Password field not found on page'); return; }
      if (!submitBtn)     { tell('loginFailed', 'Submit button not found on page');   return; }

      tell('log', `[AutoLogin] Instant auto-fill for ${username}…`);

      // Fast execution — fill, check terms, enable button and submit instantly
      fill(usernameField, username);
      fill(passwordField, password);

      findAndCheckAgreeBox();

      try {
        submitBtn.removeAttribute('disabled');
        submitBtn.disabled = false;
        submitBtn.style.pointerEvents = 'auto';
        submitBtn.style.opacity = '1';
        submitBtn.classList.remove('disabled');
      } catch {}

      tell('log', '[AutoLogin] Submitting form instantly…');

      try { submitBtn.click(); } catch {}

      const form = submitBtn.closest('form') ?? passwordField.closest('form');
      if (form) {
        await wait(50);
        try { form.submit(); } catch {}
      }

      tell('loginAttempted', 'Form submitted', { portalName });
    });
  }

  // Run once DOM is ready or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

})();
