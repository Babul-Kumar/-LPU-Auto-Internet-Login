<div align="center">

# 🌐 LPU Auto Internet Login

### Smart Captive Portal Login Manager for Chrome

**Automatically logs you into the LPU campus WiFi — silently, in the background, every time.**

[![Version](https://img.shields.io/badge/version-1.0.0-4f8ef7?style=flat-square)](https://github.com/Babul-Kumar/-LPU-Auto-Internet-Login/releases)
[![Manifest](https://img.shields.io/badge/Manifest-V3-00d4ff?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)
[![Privacy](https://img.shields.io/badge/data-100%25%20local-f59e0b?style=flat-square)](#-security--privacy)

</div>

---

## 📖 What Does It Do?

Every time you connect to LPU campus WiFi, the network shows a **captive portal login page** before giving you internet access. Normally you have to:

1. Open a browser
2. Wait for the redirect
3. Type your Student ID
4. Type your password
5. Click Login

**This extension does all of that automatically.** You connect to WiFi → internet works within seconds. You never see a login page again.

> 🔒 **Your credentials are stored only on your device. Nothing is ever sent to any server.**

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **Auto-Login** | Detects captive portal and logs you in automatically |
| 👻 **Completely Silent** | No tab opens, no popups, no notifications — 100% invisible |
| ⚡ **Fast** | Detects and logs in within 5–10 seconds of connecting to WiFi |
| 🔄 **Smart Retry** | If login fails, retries with backoff: 5s → 15s → 30s → 60s |
| 📋 **Activity Log** | See exactly what happened inside the popup — timestamped logs |
| ⚙️ **Configurable** | Toggle auto-login on or off anytime |
| 🔒 **100% Local** | No account, no server, no data collection |

---

## 📥 Installation

### Option 1 — Download from GitHub Releases (Recommended)

> This gives you the **minified production build** — faster and ready to use.

1. Go to the [**Releases page**](https://github.com/Babul-Kumar/-LPU-Auto-Internet-Login/releases)
2. Under the latest release, click **`extension.zip`** to download it
3. **Unzip** the file to a folder (e.g. `Downloads/lpu-extension/`)
4. Open Chrome and go to **`chrome://extensions`**
5. Turn on **Developer Mode** using the toggle in the top-right corner

   ![Developer Mode toggle in top-right of chrome://extensions](https://i.imgur.com/placeholder.png)

6. Click **"Load unpacked"**
7. Select the **unzipped folder** (the one containing `manifest.json`)
8. The extension icon will appear in your Chrome toolbar ✅

---

### Option 2 — Load from Source Code

> Use this if you want to inspect or modify the code yourself.

```bash
# Clone the repository
git clone https://github.com/Babul-Kumar/-LPU-Auto-Internet-Login.git
cd -LPU-Auto-Internet-Login

# Install build tools
npm install

# Build the production version
npm run build
# → This creates a dist/ folder
```

Then follow steps 4–8 above, but select the **`dist/`** folder instead of the unzipped release.

---

## 🚀 First-Time Setup (2 minutes)

After installing the extension:

### Step 1 — Open the Extension

Click the **puzzle piece icon** 🧩 in the Chrome toolbar, then click **LPU Auto Internet Login**.

> **Tip:** Pin it for easy access — click the pin icon next to the extension name.

---

### Step 2 — Enter Your LPU Credentials

You'll see the **Setup screen**:

```
┌─────────────────────────────────────┐
│  🌐  LPU AutoLogin                  │
│  Smart Captive Portal Manager       │
│                                     │
│  ① Enter Your Portal Credentials    │
│                                     │
│  Student ID / Username              │
│  ┌───────────────────────────────┐  │
│  │  e.g. 12315678               │  │
│  └───────────────────────────────┘  │
│                                     │
│  Password                           │
│  ┌───────────────────────────────┐  │
│  │  ••••••••                    │  │
│  └───────────────────────────────┘  │
│                                     │
│  [ Save & Start Auto-Login ]        │
│                                     │
│  🔒 Credentials never leave device  │
└─────────────────────────────────────┘
```

1. Enter your **LPU Registration Number** (e.g. `12315678`) as the username
2. Enter your **portal password**
3. Click **"Save & Start Auto-Login"**

That's it. You're done. The extension now runs silently in the background.

---

### Step 3 — Connect to LPU WiFi

1. Connect your laptop/PC to **LPU Campus WiFi** as usual
2. Wait **5–10 seconds**
3. Internet starts working — completely silently, no popups, no alerts
4. To confirm it worked, click the extension icon and check the **Activity Log**

> 💡 The extension works entirely in the background. You will never see a notification or a login page — it just works.

---

## 🖥️ Understanding the Dashboard

After setup, clicking the extension icon shows the **Dashboard**:

```
┌─────────────────────────────────────┐
│  🌐 LPU AutoLogin           [⚙️]    │
│                                     │
│   ●  Connected                      │
│      Internet access is available   │   [↺]
│                                     │
│  👤 Saved User    🕐 Last Login     │
│     12315678          09:28 am      │
│                                     │
│  Auto-Login  ●━━━━━━━━━━━━━●  ON   │
│                                     │
│  📋 Activity Log              [Clear]│
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
│  09:28 ✓ Internet connected ✓       │
│  09:28 ✓ Silent login successful    │
└─────────────────────────────────────┘
```

| Element | What it does |
|---|---|
| **Status dot** | 🟢 Connected / 🔴 Portal detected / 🟡 Checking / ⚫ Offline |
| **↺ Refresh button** | Manually trigger an internet check right now |
| **Auto-Login toggle** | Turn auto-login on or off without deleting credentials |
| **Activity Log** | The only place to see what the extension did — timestamped entries |
| **⚙️ Settings** | Change credentials or toggle auto-login |

---

## ⚙️ Settings

Click the **⚙️ gear icon** on the dashboard to open Settings.

### Change Your Credentials

If your password changes or you use a different account:

1. Click **⚙️** → Settings
2. Edit the **Student ID** and/or **Password** fields
3. Click **"Save Credentials"**

The extension immediately picks up the new credentials — no restart needed.

### Delete Credentials

To completely remove your saved data:

1. Click **⚙️** → Settings
2. Click **"Delete & Reset"** (red button)
3. Confirm the dialog
4. You'll be taken back to the Setup screen

### Preferences

| Setting | Default | What it controls |
|---|---|---|
| **Auto-Login Enabled** | ✅ On | Whether the extension auto-fills the portal when detected |

---

## 🔧 How It Works (Technical)

```
Every 1 minute (background alarm):
        ↓
 GET https://clients3.google.com/generate_204
        ↓
  204 → ✅ CONNECTED  (nothing to do)
        ↓
  200/redirect → 🚨 CAPTIVE PORTAL DETECTED
        ↓
   Silent Login (no tab opens, no notifications):
    1. Fetch portal HTML in background
    2. Parse form fields + hidden tokens
    3. POST credentials silently
    4. Verify: GET generate_204 again
        ↓
  ✅ CONNECTED → update badge + log (no popup)
  ❌ Failed    → retry in 5s → 15s → 30s → 60s
        ↓
  Timeout → ⚫ OFFLINE
```

---

## 🏛️ Supported Portals

| Portal | Support |
|---|---|
| **LPU Campus** (`internet.lpu.in`) | ✅ Full native support |
| **LPU Nest** (`lpunest`) | ✅ Built-in config |
| **Cisco Meraki / ISE** | ✅ Built-in config |
| **Aruba ClearPass** | ✅ Built-in config |
| **Any standard captive portal** | ✅ Auto-detection fallback |
| **CAPTCHA-protected portals** | ⚠️ Cannot bypass (by design) |

---

## 🐛 Troubleshooting

### Extension installed but no auto-login happening

1. Click the extension icon → check the **Activity Log**
2. Look for error messages in red
3. Click **↺** to force an immediate check

---

### "No credentials saved" in the log

→ Open the extension → you'll see the Setup screen → enter credentials and save.

---

### Badge stays 🟡 (Checking...) forever

→ You might be offline or the network probe is blocked. Try:
1. Open any website manually to confirm internet status
2. Click **↺** to retry

---

### Login attempt fails repeatedly

→ Verify your credentials work on the manual portal page first:
1. Open `https://internet.lpu.in` in a browser
2. Log in manually — if it works there, the extension should too
3. If not, your password may have changed → update it in ⚙️ Settings

---

### Extension shows "Extension Context Error"

→ You opened `popup.html` directly as a file. Always open the popup by clicking the extension icon in the Chrome toolbar.

---

### I changed my password — how do I update it?

1. Click ⚙️ → **Settings**
2. Edit the password field (it shows your current saved password)
3. Click **"Save Credentials"**

The extension picks up the new password immediately.

---

## 📁 Project Structure

```
extension/
├── .github/
│   └── workflows/
│       └── release.yml         ← Auto-build & release on version tag
├── popup/
│   ├── popup.html              ← Setup → Dashboard → Settings UI
│   ├── popup.css               ← Styles
│   └── popup.js                ← UI logic
├── src/
│   ├── background/
│   │   └── service-worker.js   ← Detection, silent login, alarms, retry, badges
│   ├── content/
│   │   ├── portal-registry.js  ← Portal configs (LPU, Meraki, Aruba, Generic)
│   │   └── autologin.js        ← Smart form fill & submit (fallback)
│   └── lib/
│       ├── credentials.js      ← chrome.storage.local helpers
│       └── logger.js           ← Ring-buffer debug log
├── icons/
├── scripts/
│   └── zip-dist.mjs            ← Zip the dist/ folder for release
├── manifest.json
├── vite.config.mjs             ← Build config (Vite + Terser minification)
└── package.json
```

---

## 🔒 Security & Privacy

- ✅ Credentials stored **only** in `chrome.storage.local` (sandboxed to this extension)
- ✅ **Zero data transmitted** to any external server
- ✅ No account, no sign-up, no analytics
- ✅ No network requests except to the campus portal and Google's connectivity probe
- ✅ Open source — inspect every line of code yourself

---

## 🛠️ Building from Source

```bash
# Install dependencies
npm install

# Development (watch mode — rebuilds on file change)
npm run dev

# Production build (minified)
npm run build
# → output: dist/

# Build + create ZIP for distribution
npm run release
# → output: dist/extension.zip
```

### Releasing a new version

```bash
git tag v1.1.0
git push origin v1.1.0
# GitHub Actions automatically:
# 1. Runs npm run build
# 2. Zips dist/
# 3. Creates GitHub Release with extension.zip attached
```

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">

*No account. No server. Just plug in your credentials and forget about captive portals forever.*

**[⬇️ Download Latest Release](https://github.com/Babul-Kumar/-LPU-Auto-Internet-Login/releases/latest)**

</div>
