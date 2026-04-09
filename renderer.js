'use strict';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function toast(msg, type = 'ok', dur = 3200) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), dur);
}

function setStatus(msg) {
  const el = $('global-status');
  if (el) el.textContent = msg;
}

function spinner(btn) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>${orig}`;
  return () => { btn.disabled = false; btn.textContent = orig; };
}

function parseKV(str) {
  const out = {};
  if (!str) return out;
  str.trim().split(/\s+/).forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) out[k] = v;
  });
  return out;
}

// ─── Tab routing ─────────────────────────────────────────────────────────────
const navBtns = $$('.nav-btn');
const tabs    = $$('.tab');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    navBtns.forEach(b => b.classList.remove('active'));
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${target}`).classList.add('active');
    if (target === 'memory') loadRamStats();
    if (target === 'power')  loadPowerPlans();
  });
});

// ─── Window controls ─────────────────────────────────────────────────────────
$('btn-min').addEventListener('click', () => window.doom.minimize());
$('btn-max').addEventListener('click', () => window.doom.maximize());
$('btn-close').addEventListener('click', () => window.doom.close());

// ─── System Info ─────────────────────────────────────────────────────────────
async function loadSystemInfo() {
  try {
    const info = await window.doom.getSystemInfo();
    $('sc-cpu').textContent  = info.cpu || '—';
    $('sc-gpu').textContent  = info.gpu || '—';
    $('sc-ram').textContent  = `${info.ram} (${info.ramFree} free)`;
    $('sc-os').textContent   = info.os || '—';
    $('sc-disk').textContent = info.disk || '—';
  } catch(e) {
    setStatus('System info unavailable — admin rights may be needed.');
  }
  loadTemps();
}

async function loadTemps() {
  try {
    const r = await window.doom.getTemps();
    const kv = parseKV(r.stdout);
    $('sc-temp').textContent = kv.cpu_temp ? `${kv.cpu_temp}°C` : 'N/A';
  } catch { $('sc-temp').textContent = 'N/A'; }
}

loadSystemInfo();
setInterval(loadTemps, 10000);

// ─── Backup indicator ────────────────────────────────────────────────────────
async function updateBackupIndicator() {
  const ok = await window.doom.getBackupState().catch(() => false);
  const dot = $('bi-dot');
  const lbl = $('bi-label');
  if (ok) {
    dot.className = 'bi-dot ok';
    lbl.textContent = 'Backup ready';
  } else {
    dot.className = 'bi-dot no';
    lbl.textContent = 'No backup';
  }
}
updateBackupIndicator();

// ─── REGISTRY TWEAKS ─────────────────────────────────────────────────────────
const TWEAK_DESC = {
  gameDVR:       'Disables Xbox Game DVR recording — removes ~3-8% CPU overhead during gaming.',
  hags:          'Hardware-Accelerated GPU Scheduling reduces driver overhead and input latency.',
  mmcss:         'Boosts game thread priority via Multimedia Class Scheduler — smoother frame delivery.',
  mouseAccel:    'Raw mouse input with no OS smoothing or acceleration curve applied.',
  nagle:         'Disables Nagle packet buffering — lower TCP latency, useful for online gaming.',
  bcdTimer:      'Disables dynamic tick timer — reduces scheduler jitter for more consistent frame times.',
  sysMain:       'Stops Superfetch background prefetching — reduces random disk I/O spikes in games.',
  search:        'Disables Windows Search indexer — prevents CPU/disk spikes during gameplay.',
  visualEffects: 'Strips Aero animations to free GPU/CPU for game rendering.',
  fsoGameMode:   'Activates exclusive fullscreen optimizations and Windows Game Mode.'
};

async function loadTweaks() {
  const state = await window.doom.getTweaksState().catch(() => ({}));
  const grid = $('tweaks-grid');
  grid.innerHTML = '';

  Object.entries(state).forEach(([key, info]) => {
    const card = document.createElement('div');
    card.className = `tweak-card${info.applied ? ' applied' : ''}`;
    card.dataset.key = key;
    card.innerHTML = `
      <div class="tweak-header">
        <span class="tweak-name">${info.label}</span>
        <div class="tweak-toggle"></div>
      </div>
      <div class="tweak-status">${info.applied ? '● ACTIVE' : '○ INACTIVE'}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.5">${TWEAK_DESC[key] || ''}</div>
    `;
    card.addEventListener('click', () => toggleTweak(key, card));
    grid.appendChild(card);
  });
}

async function toggleTweak(key, card) {
  const isApplied = card.classList.contains('applied');
  const status = card.querySelector('.tweak-status');
  status.innerHTML = '<span class="spinner"></span>Working…';
  
  const r = isApplied
    ? await window.doom.revertTweak(key).catch(e => ({success:false, err:e}))
    : await window.doom.applyTweak(key).catch(e => ({success:false, err:e}));

  if (r.success) {
    card.classList.toggle('applied', !isApplied);
    status.textContent = !isApplied ? '● ACTIVE' : '○ INACTIVE';
    toast(`${!isApplied ? '✓ Applied' : '↺ Reverted'}: ${key}`, !isApplied ? 'ok' : 'info');
  } else {
    status.textContent = isApplied ? '● ACTIVE' : '○ INACTIVE';
    toast(`✕ Failed — run as Administrator`, 'err');
  }
}

$('btn-apply-all').addEventListener('click', async () => {
  const restore = spinner($('btn-apply-all'));
  const r = await window.doom.applyAllTweaks().catch(() => ({}));
  await loadTweaks();
  restore();
  const ok = Object.values(r).filter(Boolean).length;
  toast(`⚡ ${ok}/${Object.keys(r).length} tweaks applied`, 'ok');
  setStatus(`Applied ${ok} registry tweaks.`);
});

$('btn-revert-all').addEventListener('click', async () => {
  const restore = spinner($('btn-revert-all'));
  await window.doom.revertAllTweaks().catch(() => {});
  await loadTweaks();
  restore();
  toast('↺ All tweaks reverted to Windows defaults', 'info');
});

loadTweaks();

// ─── QUICK BOOST ─────────────────────────────────────────────────────────────
$('btn-quick-boost').addEventListener('click', async () => {
  const restore = spinner($('btn-quick-boost'));
  setStatus('⚡ Engaging DOOM mode…');
  toast('⚡ Applying all optimizations…', 'info', 5000);

  const [tweakRes, planRes, tcpRes] = await Promise.all([
    window.doom.applyAllTweaks().catch(() => ({})),
    window.doom.createDoomPlan().catch(() => ({success:false})),
    window.doom.optimizeTcp().catch(() => ({success:false}))
  ]);

  await loadTweaks();
  restore();

  const ok = Object.values(tweakRes).filter(Boolean).length;
  setStatus(`☠ DOOM Mode active — ${ok} tweaks, DOOM power plan, TCP optimized.`);
  toast(`☠ DOOM Mode engaged — ${ok} tweaks applied!`, 'ok', 4000);
  updateBackupIndicator();
});

$('btn-quick-revert').addEventListener('click', async () => {
  const restore = spinner($('btn-quick-revert'));
  await window.doom.revertAllTweaks().catch(() => {});
  await loadTweaks();
  restore();
  setStatus('↺ All defaults restored.');
  toast('↺ All tweaks reverted to Windows defaults', 'info');
});

// ─── POWER PLANS ─────────────────────────────────────────────────────────────
async function loadPowerPlans() {
  const list = $('plan-list');
  list.innerHTML = '<div class="plan-loading">Querying power plans…</div>';

  const [plansRes, active] = await Promise.all([
    window.doom.getPowerPlans().catch(() => ({stdout:''})),
    window.doom.getActivePlan().catch(() => '')
  ]);

  const raw = plansRes.stdout || '';
  $('active-plan-label').textContent = active || 'Unknown';

  // Parse "Power Scheme GUID: xxxx  (Name)"
  const lines = raw.split('\n').filter(l => l.includes('GUID:'));
  if (!lines.length) {
    list.innerHTML = '<div class="plan-loading">No plans found — try running as Administrator.</div>';
    return;
  }

  list.innerHTML = '';
  lines.forEach(line => {
    const m = line.match(/GUID:\s+([\w-]+)\s+\(([^)]+)\)/);
    if (!m) return;
    const [, guid, name] = m;
    const isActive = active && active.toLowerCase().includes(guid.toLowerCase());
    const item = document.createElement('div');
    item.className = `plan-item${isActive ? ' active-plan' : ''}`;
    item.innerHTML = `
      <div>
        <div class="plan-name">${name}${isActive ? ' ✓' : ''}</div>
        <div class="plan-guid">${guid}</div>
      </div>
      <button class="btn-plan" data-guid="${guid}">Activate</button>
    `;
    item.querySelector('.btn-plan').addEventListener('click', async (e) => {
      const restore = spinner(e.target);
      const r = await window.doom.setPowerPlan(guid).catch(() => ({success:false}));
      restore();
      if (r.success || r.stdout) {
        toast(`✓ Switched to: ${name}`, 'ok');
        setTimeout(loadPowerPlans, 500);
      } else {
        toast('✕ Failed to switch plan — need Admin rights', 'err');
      }
    });
    list.appendChild(item);
  });
}

$('btn-doom-plan').addEventListener('click', async () => {
  const restore = spinner($('btn-doom-plan'));
  const r = await window.doom.createDoomPlan().catch(() => ({success:false}));
  restore();
  if (r.success || r.stdout?.includes('activated')) {
    toast('☠ DOOM Performance Plan activated!', 'ok');
    setTimeout(loadPowerPlans, 600);
  } else {
    toast(`✕ Failed: ${r.stderr || 'Run as Administrator'}`, 'err');
  }
});

// ─── NETWORK ─────────────────────────────────────────────────────────────────
$$('.dns-preset-card').forEach(card => {
  card.querySelector('.btn-dns').addEventListener('click', async () => {
    const [p, s] = card.dataset.dns.split(',');
    const r = await window.doom.setDns([p, s]).catch(() => ({success:false}));
    toast(r.success || r.stdout ? `✓ DNS set to ${p} / ${s}` : '✕ DNS change failed', r.success ? 'ok' : 'err');
  });
});

$('btn-custom-dns').addEventListener('click', async () => {
  const p = $('dns-primary').value.trim();
  const s = $('dns-secondary').value.trim();
  if (!p) { toast('Enter a primary DNS server', 'err'); return; }
  const r = await window.doom.setDns([p, s || p]).catch(() => ({success:false}));
  toast(r.success || r.stdout ? `✓ Custom DNS applied` : '✕ DNS change failed', r.success ? 'ok' : 'err');
});

$('btn-reset-dns').addEventListener('click', async () => {
  const r = await window.doom.resetDns().catch(() => ({success:false}));
  toast(r.success || r.stdout ? '↺ DNS reset to automatic (DHCP)' : '✕ Reset failed', r.success ? 'info' : 'err');
});

$('btn-tcp-optimize').addEventListener('click', async () => {
  const restore = spinner($('btn-tcp-optimize'));
  const r = await window.doom.optimizeTcp().catch(() => ({success:false}));
  restore();
  toast(r.success || r.stdout ? '✓ TCP stack optimized' : '✕ TCP optimization failed', r.success ? 'ok' : 'err');
});

$('btn-ping-test').addEventListener('click', async () => {
  const host = $('ping-target').value.trim() || '8.8.8.8';
  const restore = spinner($('btn-ping-test'));
  const pr = $('ping-result');
  pr.textContent = `Pinging ${host} (10 packets)…`;
  pr.className = 'ping-result visible';

  const r = await window.doom.pingTest(host).catch(() => ({stdout:'error=timeout'}));
  restore();

  if (r.stdout?.includes('error')) {
    pr.textContent = `✕ Ping failed — host unreachable`;
    pr.style.color = 'var(--red)';
  } else {
    const kv = parseKV(r.stdout);
    pr.innerHTML = `
      ◎ Ping Results → ${host}<br>
      Average: <b>${kv.avg || '—'} ms</b> &nbsp;|&nbsp; 
      Min: <b>${kv.min || '—'} ms</b> &nbsp;|&nbsp; 
      Max: <b>${kv.max || '—'} ms</b> &nbsp;|&nbsp; 
      Jitter: <b style="color:${parseInt(kv.jitter||99) < 20 ? 'var(--green)' : 'var(--orange)'}">${kv.jitter || '—'} ms</b>
    `;
    pr.style.color = 'var(--green)';
  }
});

// ─── MEMORY ──────────────────────────────────────────────────────────────────
async function loadRamStats() {
  const r = await window.doom.getRamStats().catch(() => ({stdout:''}));
  const kv = parseKV(r.stdout);
  if (!kv.total) return;

  const total = parseInt(kv.total);
  const used  = parseInt(kv.used);
  const free  = parseInt(kv.free);
  const pct   = Math.round((used / total) * 100);

  $('ram-fill').style.width = `${pct}%`;
  $('ram-pct').textContent  = `${pct}%`;
  $('ram-used').textContent = `${Math.round(used/1024)} MB`;
  $('ram-free').textContent = `${Math.round(free/1024)} MB`;
  $('ram-total').textContent= `${Math.round(total/1024)} MB`;
}

$('btn-flush-ram').addEventListener('click', async () => {
  const restore = spinner($('btn-flush-ram'));
  const mr = $('mem-result');
  mr.className = 'mem-result visible';
  mr.textContent = 'Flushing standby memory…';

  const r = await window.doom.flushRam().catch(() => ({success:false}));
  restore();

  if (r.success || r.stdout?.includes('flushed')) {
    const kv = parseKV(r.stdout);
    mr.textContent = `✓ Standby memory flushed — ${kv.free_mb || '?'} MB now free`;
    toast('☠ RAM flushed', 'ok');
    await loadRamStats();
  } else {
    mr.textContent = `✕ Flush failed — requires Administrator`;
    mr.style.color = 'var(--red)';
    toast('✕ RAM flush failed', 'err');
  }
});

$('btn-disable-compression').addEventListener('click', async () => {
  const restore = spinner($('btn-disable-compression'));
  const r = await window.doom.disableMemCompression().catch(() => ({success:false}));
  restore();
  toast(r.success || r.stdout ? '✓ Memory compression disabled (reboot to take effect)' : '✕ Failed', r.success ? 'ok' : 'err');
});

$('btn-refresh-ram').addEventListener('click', loadRamStats);

// ─── GPU ─────────────────────────────────────────────────────────────────────
$$('.pr-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const frames = parseInt(btn.dataset.v);
    $$('.pr-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const gr = $('gpu-result');
    gr.className = 'gpu-result visible';
    const r = await window.doom.setNvidiaPrerender(frames).catch(() => ({success:false}));
    gr.textContent = r.success || r.stdout
      ? `✓ Pre-rendered frames set to ${frames}`
      : '✕ Failed — NVIDIA registry key not found (AMD/Intel GPU?)';
    gr.style.color = r.success || r.stdout ? 'var(--green)' : 'var(--orange)';
    toast(`NVIDIA pre-render frames → ${frames}`, r.success ? 'ok' : 'info');
  });
});

$('btn-disable-telemetry').addEventListener('click', async () => {
  const restore = spinner($('btn-disable-telemetry'));
  const r = await window.doom.disableNvidiaTelemetry().catch(() => ({success:false}));
  restore();
  const gr = $('gpu-result');
  gr.className = 'gpu-result visible';
  gr.textContent = r.success || r.stdout ? '✓ NVIDIA telemetry services disabled' : '✕ Failed (services not found?)';
  gr.style.color = r.success || r.stdout ? 'var(--green)' : 'var(--orange)';
  toast('NVIDIA telemetry disabled', 'ok');
});

$('btn-enable-hags').addEventListener('click', async () => {
  const r = await window.doom.applyTweak('hags').catch(() => ({success:false}));
  toast(r.success ? '✓ HAGS enabled — reboot required' : '✕ HAGS failed', r.success ? 'ok' : 'err');
  const gr = $('gpu-result');
  gr.className = 'gpu-result visible';
  gr.textContent = r.success ? '✓ HAGS enabled — please reboot for changes to take effect' : '✕ HAGS change failed';
});

$('btn-disable-hags').addEventListener('click', async () => {
  const r = await window.doom.revertTweak('hags').catch(() => ({success:false}));
  toast(r.success ? '↺ HAGS disabled — reboot required' : '✕ HAGS failed', r.success ? 'info' : 'err');
});

// ─── BACKUP ───────────────────────────────────────────────────────────────────
$('btn-create-restore').addEventListener('click', async () => {
  const restore = spinner($('btn-create-restore'));
  const bs = $('backup-status');
  bs.textContent = '◎ Creating System Restore Point — this may take 30-60 seconds…';
  bs.style.color = 'var(--yellow)';

  const r = await window.doom.createRestorePoint().catch(() => ({success:false}));
  restore();

  if (r.success || r.stdout?.includes('created')) {
    bs.textContent = '✓ Restore point created successfully! You can roll back from System Properties → System Protection.';
    bs.style.color = 'var(--green)';
    toast('✓ Restore point created', 'ok');
    updateBackupIndicator();
  } else {
    bs.textContent = `✕ Failed to create restore point. Ensure System Protection is enabled for C:\\ and run as Administrator.\nError: ${r.stderr || r.err?.message || 'Unknown'}`;
    bs.style.color = 'var(--red)';
    toast('✕ Restore point creation failed', 'err');
  }
});
