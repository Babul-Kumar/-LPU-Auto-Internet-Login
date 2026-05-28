# LPU Auto Internet Login — Chrome Extension

A **Smart Captive Portal Login Manager** built with Chrome MV3.  
Enter your credentials once → the extension auto-logs you in every time a captive portal is detected.

---

## ✨ Features

- 🔑 **One-time Setup** — Enter credentials once, stored locally forever
- 🌐 **Auto Portal Detection** — `generate_204` probe (timeout + redirect + offline states)
- 🚀 **Auto Discovery** — `neverssl.com` triggers captive portal redirect automatically
- 🤖 **Smart Form Detection** — 4-step selector chain works on any portal
- 🔄 **Retry Queue** — Exponential backoff: 5s → 15s → 30s → 60s
- 🏛️ **Portal Registry** — LPU, Cisco Meraki, Aruba + universal fallback
- 🎨 **Badge States** — 🟢 Connected | 🔴 Portal | 🟡 Checking | ⚫ Offline
- 📋 **Debug Console** — Live timestamped activity log in popup
- 🔒 **100% Local** — No server, no account, no internet required to run

---

## 📁 Project Structure

```
extension/
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── popup/
│   ├── popup.html       ← Setup → Dashboard → Settings
│   ├── popup.css
│   └── popup.js
├── src/
│   ├── background/
│   │   └── service-worker.js   ← Detection, alarms, retry, badges
│   ├── content/
│   │   ├── portal-registry.js  ← Portal configs (LPU, Meraki, Aruba, Generic)
│   │   └── autologin.js        ← Smart form fill & submit
│   └── lib/
│       ├── credentials.js      ← chrome.storage.local CRUD
│       └── logger.js           ← Ring-buffer debug log
└── README.md
```

---

## 🚀 Installation

### 1. Load in Chrome

1. Open **`chrome://extensions`**
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Extension icon appears in the toolbar ✅

### 2. First-Time Setup

1. Click the extension icon
2. Enter your **Student ID / Username** and **Password**
3. Optionally enter your portal URL (leave blank for auto-detect)
4. Click **Save & Start Auto-Login**

Done. The extension handles everything from here.

---

## 🔧 How It Works

```
Every 1 minute (via chrome.alarms):
       ↓
Fetch https://clients3.google.com/generate_204
       ↓
  204 response → ✅ CONNECTED (green badge)
       ↓
  Redirect/200 → 🚨 CAPTIVE PORTAL (red badge)
       ├── Open http://neverssl.com (redirects to portal automatically)
       ├── Content script detects login form
       ├── Smart field detection: named selectors → type → proximity → broadest
       ├── Auto-fills username + password
       ├── Submits form
       └── Retry on fail: 5s → 15s → 30s → 60s
       ↓
  Timeout (5s) → ⚫ OFFLINE (gray badge)
```

---

## ⚙️ Configuration

| Setting | Default | Description |
|---|---|---|
| Portal URL | *(blank)* | Leave blank to use `neverssl.com` auto-discovery |
| Auto-Login | Enabled | Toggle auto-fill on/off |
| Login Notifications | On | Desktop notification on success |
| Failure Alerts | On | Alert when retries exhausted |

---

## 🏛️ Supported Portals

| Portal | Status |
|---|---|
| **LPU Campus** | ✅ Built-in config |
| **Cisco Meraki** | ✅ Built-in config |
| **Aruba ClearPass** | ✅ Built-in config |
| **Any other portal** | ✅ Smart detection fallback |
| CAPTCHA portals | ⚠️ Opens page for manual completion |

---

## 🔒 Security & Privacy

- Credentials stored **only** in `chrome.storage.local` (sandboxed per extension)
- **Nothing is ever sent to any server**
- No account required, no internet dependency for the extension to run
- V2 roadmap: AES-256-GCM encryption via Web Crypto API

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| Badge not changing | Click ↺ in popup to force a check |
| Form not auto-filled | Check Activity Log for "field not found" — set portal URL in Settings |
| Credentials not saving | Make sure both username and password fields are filled |
| Extension not loading | Open `chrome://extensions` → Check for errors under the extension card |

---

*No account. No server. Just plug in your credentials and forget about captive portals forever.*
