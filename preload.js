'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('doom', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

  // System info
  getSystemInfo:      () => ipcRenderer.invoke('get-system-info'),

  // Tweaks
  getTweaksState:     () => ipcRenderer.invoke('get-tweaks-state'),
  applyTweak:    (key) => ipcRenderer.invoke('apply-tweak', key),
  revertTweak:   (key) => ipcRenderer.invoke('revert-tweak', key),
  applyAllTweaks:     () => ipcRenderer.invoke('apply-all-tweaks'),
  revertAllTweaks:    () => ipcRenderer.invoke('revert-all-tweaks'),

  // Power
  getPowerPlans:      () => ipcRenderer.invoke('get-power-plans'),
  setPowerPlan: (guid) => ipcRenderer.invoke('set-power-plan', guid),
  createDoomPlan:     () => ipcRenderer.invoke('create-doom-plan'),
  getActivePlan:      () => ipcRenderer.invoke('get-active-plan'),

  // Network
  setDns:    (servers) => ipcRenderer.invoke('set-dns', servers),
  resetDns:           () => ipcRenderer.invoke('reset-dns'),
  optimizeTcp:        () => ipcRenderer.invoke('optimize-tcp'),
  pingTest:   (host)   => ipcRenderer.invoke('ping-test', host),

  // Memory
  flushRam:           () => ipcRenderer.invoke('flush-ram'),
  getRamStats:        () => ipcRenderer.invoke('get-ram-stats'),
  disableMemCompression: () => ipcRenderer.invoke('disable-mem-compression'),

  // GPU
  setNvidiaPrerender: (frames) => ipcRenderer.invoke('set-nvidia-prerender', frames),
  disableNvidiaTelemetry: () => ipcRenderer.invoke('disable-nvidia-telemetry'),

  // Backup
  createRestorePoint: () => ipcRenderer.invoke('create-restore-point'),
  getBackupState:     () => ipcRenderer.invoke('get-backup-state'),

  // Benchmarks
  runCpuBenchmark:    () => ipcRenderer.invoke('run-cpu-benchmark'),
  getTemps:           () => ipcRenderer.invoke('get-temps')
});
