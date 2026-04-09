# DOOM Optimizer 🔥
### PC Gaming Performance Suite — Native Windows Desktop App

A real Electron desktop application that applies genuine Windows optimizations:
registry tweaks, power plans, GPU settings, network tuning, and memory management.
Packages into a **setup.exe** installer via electron-builder + NSIS.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** — https://nodejs.org
- **Windows 10/11 x64** (for the built app to run)
- **npm** (comes with Node)

### Install & Run (Dev Mode)
```bash
cd doom-optimizer
npm install
npm start
```

### Build setup.exe
```bash
npm install
npm run build
```
Output: `dist/DOOM Optimizer Setup 2.0.1.exe`

---

## 📁 Project Structure

```
doom-optimizer/
├── src/
│   ├── main/
│   │   └── main.js          ← Electron main process (Node.js backend)
│   │                           Runs PowerShell, edits registry, manages power plans
│   ├── preload/
│   │   └── preload.js       ← Secure IPC bridge (contextBridge)
│   └── renderer/
│       ├── index.html       ← App UI shell
│       ├── styles.css       ← Full dark gaming aesthetic CSS
│       └── renderer.js      ← Frontend logic, IPC calls, state
├── assets/
│   └── icon.ico             ← App icon (add your own 256x256 .ico)
├── build/
│   └── installer.nsh        ← NSIS installer customization
├── package.json             ← Electron-builder config + deps
└── README.md
```

---

## ⚙️ What It Actually Does

### Registry Tweaks (real PowerShell commands)
| Tweak | Registry Path | Effect |
|---|---|---|
| Disable Game DVR | `HKCU\System\GameConfigStore` | Removes Xbox recording overhead |
| HAGS | `HKLM\SYSTEM\...\GraphicsDrivers` | GPU scheduling improvement |
| MMCSS | `HKLM\...\Multimedia\SystemProfile` | Game thread max priority |
| Mouse Accel | `HKCU\Control Panel\Mouse` | Raw input, no smoothing |
| Nagle Off | `HKLM\...\Tcpip\Parameters\Interfaces` | Lower network latency |
| BCD Timer | `bcdedit` command | Reduces scheduler jitter |
| SysMain Off | Windows Service | Less background I/O |
| Search Off | Windows Service | Prevents index spikes |

### Power Plans
- Switches via `powercfg /s <GUID>`
- Creates custom **DOOM Plan** with no core parking, no timeouts, 100% CPU state
- Disables core parking via `powercfg /setacvalueindex`

### Network Optimizer
- Sets DNS on all active adapters via `Set-DnsClientServerAddress`
- Disables TCP auto-tuning via `netsh int tcp`
- Runs real ping tests with `Test-Connection` (10 packets, measures jitter)

### Memory
- Flushes standby memory via `SetSystemFileCacheSize` P/Invoke
- Reads real RAM stats from `Win32_OperatingSystem` WMI
- Disables memory compression via `Disable-MMAgent`

### GPU
- Sets NVIDIA pre-rendered frames via registry
- Disables NVIDIA telemetry services
- HAGS toggle

---

## 🏗️ Building the Installer

```bash
npm install
npm run build
```

electron-builder will:
1. Bundle the app with Electron 28
2. Generate an NSIS installer
3. Request `requireAdministrator` execution level
4. Create `dist/DOOM Optimizer Setup 2.0.1.exe`

The installer:
- Lets user choose install directory
- Creates Desktop + Start Menu shortcuts
- Adds firewall exception
- Shows a post-install info dialog
- Includes uninstaller

---

## 🎨 Adding an Icon

Place a **256x256 .ico** file at `assets/icon.ico`.

Free tools to create .ico: https://www.icoconverter.com/

---

## ⚠️ Safety Notes

- All tweaks are **reversible** (each has a `revert` PowerShell command)
- Use the **Backup tab** to create a Windows Restore Point before applying tweaks
- Spectre/Meltdown mitigation disable is **NOT included** — it's a security risk
- Tested on Windows 10 21H2 and Windows 11 23H2

---

## 📦 Dependencies

```json
{
  "electron": "^28.0.0",          ← Desktop app framework
  "electron-builder": "^24.9.1",  ← Creates setup.exe via NSIS
  "systeminformation": "^5.21.22",← CPU/RAM/GPU detection
  "electron-store": "^8.1.0",     ← Persist applied tweaks across sessions
  "regedit": "^3.0.3",            ← Optional: direct registry reads
  "node-powershell": "^5.0.1"     ← Optional: alternative PS runner
}
```
## 🤖 AI ASSISTANCE

- This project was organized, structured, and developed with the assistance of artificial intelligence.
- AI was used to help design system architecture, generate code components, and streamline development, while maintaining full human direction and control over functionality and design.
