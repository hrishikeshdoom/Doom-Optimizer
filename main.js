'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec, execSync } = require('child_process');
const os = require('os');
const fs = require('fs');

// ─── Store for persisted tweak state ────────────────────────────────────────
let Store;
let store;
(async () => {
  Store = (await import('electron-store')).default;
  store = new Store({
    name: 'doom-optimizer-state',
    defaults: { appliedTweaks: {}, backupCreated: false, customDnsServers: '' }
  });
})();

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 900,
    minHeight: 640,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0b',
    icon: path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function runPS(script) {
  return new Promise((resolve) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    exec(`powershell.exe -NonInteractive -NoProfile -EncodedCommand ${encoded}`,
      { timeout: 30000 },
      (err, stdout, stderr) => {
        resolve({ success: !err, stdout: stdout.trim(), stderr: stderr.trim(), err });
      }
    );
  });
}

function isApplied(key) {
  return store ? (store.get(`appliedTweaks.${key}`) === true) : false;
}
function setApplied(key, val) {
  if (store) store.set(`appliedTweaks.${key}`, val);
}

// ─── Window controls ─────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close', () => mainWindow.close());

// ─── System Info ─────────────────────────────────────────────────────────────
ipcMain.handle('get-system-info', async () => {
  const si = require('systeminformation');
  const [cpu, mem, gpu, os_info, disk] = await Promise.all([
    si.cpu(), si.mem(), si.graphics(), si.osInfo(), si.diskLayout()
  ]);
  return {
    cpu: `${cpu.manufacturer} ${cpu.brand}`,
    cores: cpu.physicalCores,
    threads: cpu.cores,
    ram: `${Math.round(mem.total / 1073741824)} GB`,
    ramFree: `${Math.round(mem.available / 1073741824)} GB`,
    gpu: gpu.controllers[0]?.model || 'Unknown',
    os: `${os_info.distro} ${os_info.release}`,
    disk: disk[0] ? `${disk[0].type} ${Math.round(disk[0].size / 1073741824)} GB` : 'Unknown',
    platform: process.platform
  };
});

// ─── Registry Tweaks ─────────────────────────────────────────────────────────
const TWEAKS = {
  gameDVR: {
    label: 'Disable Game DVR',
    apply: `
      Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -Value 0 -Type DWord -Force
      Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_FSEBehavior" -Value 2 -Type DWord -Force
      Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -Value 2 -Type DWord -Force
      Set-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -Value 1 -Type DWord -Force
      $path = "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR"
      if(!(Test-Path $path)){New-Item -Path $path -Force}
      Set-ItemProperty -Path $path -Name "AllowGameDVR" -Value 0 -Type DWord -Force
    `,
    revert: `
      Remove-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_Enabled" -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_FSEBehavior" -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_FSEBehaviorMode" -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path "HKCU:\\System\\GameConfigStore" -Name "GameDVR_HonorUserFSEBehaviorMode" -ErrorAction SilentlyContinue
      Remove-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR" -Recurse -ErrorAction SilentlyContinue
    `
  },
  hags: {
    label: 'Hardware GPU Scheduling (HAGS)',
    apply: `
      $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers"
      Set-ItemProperty -Path $path -Name "HwSchMode" -Value 2 -Type DWord -Force
    `,
    revert: `
      $path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers"
      Set-ItemProperty -Path $path -Name "HwSchMode" -Value 1 -Type DWord -Force
    `
  },
  mmcss: {
    label: 'MMCSS Game Priority',
    apply: `
      $base = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile"
      Set-ItemProperty -Path $base -Name "SystemResponsiveness" -Value 0 -Type DWord -Force
      Set-ItemProperty -Path $base -Name "NetworkThrottlingIndex" -Value 0xffffffff -Type DWord -Force
      $tasks = "$base\\Tasks\\Games"
      if(!(Test-Path $tasks)){New-Item -Path $tasks -Force}
      Set-ItemProperty -Path $tasks -Name "Affinity" -Value 0 -Type DWord -Force
      Set-ItemProperty -Path $tasks -Name "Background Only" -Value "False" -Type String -Force
      Set-ItemProperty -Path $tasks -Name "Clock Rate" -Value 10000 -Type DWord -Force
      Set-ItemProperty -Path $tasks -Name "GPU Priority" -Value 8 -Type DWord -Force
      Set-ItemProperty -Path $tasks -Name "Priority" -Value 6 -Type DWord -Force
      Set-ItemProperty -Path $tasks -Name "Scheduling Category" -Value "High" -Type String -Force
      Set-ItemProperty -Path $tasks -Name "SFIO Priority" -Value "High" -Type String -Force
    `,
    revert: `
      $base = "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile"
      Set-ItemProperty -Path $base -Name "SystemResponsiveness" -Value 20 -Type DWord -Force
      Set-ItemProperty -Path $base -Name "NetworkThrottlingIndex" -Value 10 -Type DWord -Force
    `
  },
  mouseAccel: {
    label: 'Disable Mouse Acceleration',
    apply: `
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Mouse" -Name "MouseSpeed" -Value "0" -Type String -Force
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Mouse" -Name "MouseThreshold1" -Value "0" -Type String -Force
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Mouse" -Name "MouseThreshold2" -Value "0" -Type String -Force
    `,
    revert: `
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Mouse" -Name "MouseSpeed" -Value "1" -Type String -Force
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Mouse" -Name "MouseThreshold1" -Value "6" -Type String -Force
      Set-ItemProperty -Path "HKCU:\\Control Panel\\Mouse" -Name "MouseThreshold2" -Value "10" -Type String -Force
    `
  },
  nagle: {
    label: 'Disable Nagle Algorithm',
    apply: `
      $interfaces = Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces"
      foreach($iface in $interfaces){
        Set-ItemProperty -Path $iface.PSPath -Name "TcpAckFrequency" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
        Set-ItemProperty -Path $iface.PSPath -Name "TCPNoDelay" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
      }
    `,
    revert: `
      $interfaces = Get-ChildItem "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces"
      foreach($iface in $interfaces){
        Remove-ItemProperty -Path $iface.PSPath -Name "TcpAckFrequency" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $iface.PSPath -Name "TCPNoDelay" -ErrorAction SilentlyContinue
      }
    `
  },
  bcdTimer: {
    label: 'BCD Timer Resolution',
    apply: `bcdedit /set useplatformclock false; bcdedit /set disabledynamictick yes`,
    revert: `bcdedit /deletevalue useplatformclock; bcdedit /set disabledynamictick no`
  },
  sysMain: {
    label: 'Disable SysMain (Superfetch)',
    apply: `Stop-Service -Name "SysMain" -Force -ErrorAction SilentlyContinue; Set-Service -Name "SysMain" -StartupType Disabled`,
    revert: `Set-Service -Name "SysMain" -StartupType Automatic; Start-Service -Name "SysMain" -ErrorAction SilentlyContinue`
  },
  search: {
    label: 'Disable Windows Search Indexing',
    apply: `Stop-Service -Name "WSearch" -Force -ErrorAction SilentlyContinue; Set-Service -Name "WSearch" -StartupType Disabled`,
    revert: `Set-Service -Name "WSearch" -StartupType Automatic; Start-Service -Name "WSearch" -ErrorAction SilentlyContinue`
  },
  visualEffects: {
    label: 'Optimize Visual Effects for Performance',
    apply: `
      $path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects"
      if(!(Test-Path $path)){New-Item -Path $path -Force}
      Set-ItemProperty -Path $path -Name "VisualFXSetting" -Value 2 -Type DWord -Force
      $adv = "HKCU:\\Control Panel\\Desktop"
      Set-ItemProperty -Path $adv -Name "UserPreferencesMask" -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00)) -Type Binary -Force
    `,
    revert: `
      $path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects"
      Set-ItemProperty -Path $path -Name "VisualFXSetting" -Value 0 -Type DWord -Force
    `
  },
  fsoGameMode: {
    label: 'Enable FSO + Game Mode',
    apply: `
      $gm = "HKCU:\\Software\\Microsoft\\GameBar"
      if(!(Test-Path $gm)){New-Item -Path $gm -Force}
      Set-ItemProperty -Path $gm -Name "AllowAutoGameMode" -Value 1 -Type DWord -Force
      Set-ItemProperty -Path $gm -Name "AutoGameModeEnabled" -Value 1 -Type DWord -Force
    `,
    revert: `
      $gm = "HKCU:\\Software\\Microsoft\\GameBar"
      Set-ItemProperty -Path $gm -Name "AllowAutoGameMode" -Value 0 -Type DWord -Force
      Set-ItemProperty -Path $gm -Name "AutoGameModeEnabled" -Value 0 -Type DWord -Force
    `
  }
};

ipcMain.handle('get-tweaks-state', () => {
  return Object.keys(TWEAKS).reduce((acc, key) => {
    acc[key] = { label: TWEAKS[key].label, applied: isApplied(key) };
    return acc;
  }, {});
});

ipcMain.handle('apply-tweak', async (_, key) => {
  if (!TWEAKS[key]) return { success: false, error: 'Unknown tweak' };
  const result = await runPS(TWEAKS[key].apply);
  if (result.success) setApplied(key, true);
  return result;
});

ipcMain.handle('revert-tweak', async (_, key) => {
  if (!TWEAKS[key]) return { success: false, error: 'Unknown tweak' };
  const result = await runPS(TWEAKS[key].revert);
  if (result.success) setApplied(key, false);
  return result;
});

ipcMain.handle('apply-all-tweaks', async () => {
  const results = {};
  for (const key of Object.keys(TWEAKS)) {
    const r = await runPS(TWEAKS[key].apply);
    if (r.success) setApplied(key, true);
    results[key] = r.success;
  }
  return results;
});

ipcMain.handle('revert-all-tweaks', async () => {
  for (const key of Object.keys(TWEAKS)) {
    await runPS(TWEAKS[key].revert);
    setApplied(key, false);
  }
  return { success: true };
});

// ─── Power Plans ─────────────────────────────────────────────────────────────
const DOOM_PLAN_GUID = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';

ipcMain.handle('get-power-plans', async () => {
  const r = await runPS(`powercfg /list`);
  return r.stdout;
});

ipcMain.handle('set-power-plan', async (_, guid) => {
  return runPS(`powercfg /s ${guid}`);
});

ipcMain.handle('create-doom-plan', async () => {
  const script = `
    $guid = "${DOOM_PLAN_GUID}"
    $exists = powercfg /list | Select-String $guid
    if(!$exists){
      powercfg /duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
    }
    powercfg /changename $guid "DOOM Performance Plan" "Maximum performance for gaming"
    powercfg /setacvalueindex $guid SUB_PROCESSOR PROCTHROTTLEMAX 100
    powercfg /setacvalueindex $guid SUB_PROCESSOR PROCTHROTTLEMIN 100
    powercfg /setacvalueindex $guid SUB_PROCESSOR CPMINCORES 100
    powercfg /setacvalueindex $guid SUB_SLEEP STANDBYIDLE 0
    powercfg /setacvalueindex $guid SUB_SLEEP HIBERNATEIDLE 0
    powercfg /setacvalueindex $guid SUB_VIDEO VIDEOIDLE 0
    powercfg /setacvalueindex $guid SUB_DISK DISKIDLE 0
    powercfg /s $guid
    Write-Output "DOOM Plan activated: $guid"
  `;
  return runPS(script);
});

ipcMain.handle('get-active-plan', async () => {
  const r = await runPS(`(powercfg /getactivescheme).Split()[3]`);
  return r.stdout.trim();
});

// ─── Network Optimizer ───────────────────────────────────────────────────────
ipcMain.handle('set-dns', async (_, servers) => {
  const [primary, secondary] = servers;
  const script = `
    $adapters = Get-NetAdapter | Where-Object {$_.Status -eq "Up"}
    foreach($adapter in $adapters){
      Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ServerAddresses ("${primary}","${secondary}") -ErrorAction SilentlyContinue
    }
    ipconfig /flushdns
    Write-Output "DNS set to ${primary} / ${secondary}"
  `;
  return runPS(script);
});

ipcMain.handle('reset-dns', async () => {
  const script = `
    $adapters = Get-NetAdapter | Where-Object {$_.Status -eq "Up"}
    foreach($adapter in $adapters){
      Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ResetServerAddresses -ErrorAction SilentlyContinue
    }
    ipconfig /flushdns
    Write-Output "DNS reset to automatic"
  `;
  return runPS(script);
});

ipcMain.handle('optimize-tcp', async () => {
  const script = `
    netsh int tcp set global autotuninglevel=normal
    netsh int tcp set global chimney=disabled
    netsh int tcp set global dca=enabled
    netsh int tcp set global netdma=enabled
    netsh int tcp set global rss=enabled
    netsh int tcp set global rsc=disabled
    netsh int tcp set heuristics disabled
    Write-Output "TCP stack optimized"
  `;
  return runPS(script);
});

ipcMain.handle('ping-test', async (_, host) => {
  const target = host || '8.8.8.8';
  const script = `
    $results = Test-Connection -ComputerName "${target}" -Count 10 -ErrorAction SilentlyContinue
    if($results){
      $avg = ($results | Measure-Object -Property ResponseTime -Average).Average
      $min = ($results | Measure-Object -Property ResponseTime -Minimum).Minimum
      $max = ($results | Measure-Object -Property ResponseTime -Maximum).Maximum
      $jitter = $max - $min
      Write-Output "avg=$([math]::Round($avg,1)) min=$min max=$max jitter=$jitter"
    } else { Write-Output "error=timeout" }
  `;
  return runPS(script);
});

// ─── Memory ──────────────────────────────────────────────────────────────────
ipcMain.handle('flush-ram', async () => {
  const script = `
    $sig = @"
[DllImport("kernel32.dll")]
public static extern bool SetSystemFileCacheSize(UIntPtr min, UIntPtr max, uint flags);
"@
    $type = Add-Type -MemberDefinition $sig -Name "WinAPI" -Namespace "Kernel32" -PassThru
    $type::SetSystemFileCacheSize([UIntPtr]::Zero, [UIntPtr]::Zero, 0) | Out-Null
    $mem = Get-WmiObject Win32_OperatingSystem
    $free = [math]::Round($mem.FreePhysicalMemory / 1024, 0)
    Write-Output "flushed free_mb=$free"
  `;
  return runPS(script);
});

ipcMain.handle('get-ram-stats', async () => {
  const script = `
    $mem = Get-WmiObject Win32_OperatingSystem
    $total = [math]::Round($mem.TotalVisibleMemorySize / 1024, 0)
    $free = [math]::Round($mem.FreePhysicalMemory / 1024, 0)
    $used = $total - $free
    Write-Output "total=$total used=$used free=$free"
  `;
  return runPS(script);
});

ipcMain.handle('disable-mem-compression', async () => {
  return runPS(`Disable-MMAgent -MemoryCompression -ErrorAction SilentlyContinue; Write-Output "done"`);
});

// ─── GPU ─────────────────────────────────────────────────────────────────────
ipcMain.handle('set-nvidia-prerender', async (_, frames) => {
  const script = `
    $nv = "HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\NVTweak"
    if(!(Test-Path $nv)){New-Item -Path $nv -Force}
    Set-ItemProperty -Path $nv -Name "Prerender" -Value ${frames} -Type DWord -Force
    $d3d = "HKCU:\\Software\\Microsoft\\Direct3D"
    if(!(Test-Path $d3d)){New-Item -Path $d3d -Force}
    Set-ItemProperty -Path $d3d -Name "MaxFrameLatency" -Value ${frames} -Type DWord -Force
    Write-Output "Pre-render frames set to ${frames}"
  `;
  return runPS(script);
});

ipcMain.handle('disable-nvidia-telemetry', async () => {
  const script = `
    $services = @("NvTelemetryContainer","NvNetworkService","NvDisplayContainer")
    foreach($svc in $services){
      Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
      Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue
    }
    $telPath = "HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\Startup\\SendTelemetryData"
    if(!(Test-Path $telPath)){New-Item -Path $telPath -Force | Out-Null}
    Set-ItemProperty -Path "HKLM:\\SOFTWARE\\NVIDIA Corporation\\Global\\Startup" -Name "SendTelemetryData" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
    Write-Output "NVIDIA telemetry disabled"
  `;
  return runPS(script);
});

// ─── Restore Point ───────────────────────────────────────────────────────────
ipcMain.handle('create-restore-point', async () => {
  const script = `
    Enable-ComputerRestore -Drive "C:\\" -ErrorAction SilentlyContinue
    Checkpoint-Computer -Description "DOOM Optimizer Backup - $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -RestorePointType "MODIFY_SETTINGS"
    Write-Output "Restore point created"
  `;
  const r = await runPS(script);
  if (r.success && store) store.set('backupCreated', true);
  return r;
});

ipcMain.handle('get-backup-state', () => {
  return store ? store.get('backupCreated', false) : false;
});

// ─── Benchmarks ──────────────────────────────────────────────────────────────
ipcMain.handle('run-cpu-benchmark', async () => {
  const script = `
    $start = Get-Date
    $result = 0
    for($i = 1; $i -le 1000000; $i++){ $result += [math]::Sqrt($i) }
    $end = Get-Date
    $ms = ($end - $start).TotalMilliseconds
    Write-Output "time_ms=$([math]::Round($ms,0)) score=$([math]::Round(1000000 / ($ms/1000), 0))"
  `;
  return runPS(script);
});

ipcMain.handle('get-temps', async () => {
  const script = `
    try {
      $cpuTemp = Get-WmiObject -Namespace "root/WMI" -Class "MSAcpi_ThermalZoneTemperature" -ErrorAction Stop
      $celsius = ($cpuTemp | Select-Object -First 1).CurrentTemperature / 10 - 273.15
      Write-Output "cpu_temp=$([math]::Round($celsius,1))"
    } catch { Write-Output "cpu_temp=N/A" }
  `;
  return runPS(script);
});
