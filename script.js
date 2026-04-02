const tableBody = document.getElementById('pc-table');
const btnCreate = document.getElementById('btn-create');
const modal = document.getElementById('pc-modal');
const modalTitle = document.getElementById('modal-title');
const pcForm = document.getElementById('pc-form');
const modalCancel = document.getElementById('modal-cancel');
const modalSave = document.getElementById('modal-save');
const searchInput = document.getElementById('search');

const cpuPreview = document.getElementById('cpu-preview');
const gpuPreview = document.getElementById('gpu-preview');
const storagePreview = document.getElementById('storage-preview');
const osPreview = document.getElementById('os-preview');
const brandPreview = document.getElementById('brand-preview');
const ramPreview = document.getElementById('ram-preview');

const cpuDetected = document.getElementById('cpu-detected');
const gpuDetected = document.getElementById('gpu-detected');
const storageDetected = document.getElementById('storage-detected');
const osDetected = document.getElementById('os-detected');
const brandDetected = document.getElementById('brand-detected');
const ramDetected = document.getElementById('ram-detected');

const notifications = document.getElementById('notifications');
const confirmModal = document.getElementById('confirm-modal');
const loadingOverlay = document.getElementById('loading-overlay');
const CSRF = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

// DetectAI instance (provided by detectai.js)
const detectAI = typeof DetectAI !== 'undefined' ? new DetectAI() : null;

let pcs = [];
let editIndex = null;
// Correction modal elements (added to DOM in index.php)
const correctionModal = document.getElementById('correction-modal');
const correctionList = document.getElementById('correction-list');
const correctionApply = document.getElementById('correction-apply');
const correctionKeep = document.getElementById('correction-keep');
const correctionEdit = document.getElementById('correction-edit');

// Pending state for user confirmation
let pendingOriginalPC = null;
let pendingSuggestedPC = null;
let pendingEditIndex = null;

async function loadPCs() {
  showLoading(true);
  try {
    const res = await fetch('api.php', { credentials: 'same-origin' });
    if (!res.ok) {
      if (res.status === 401) {
        showNotification('Non authentifié. Veuillez vous reconnecter.', 'error');
        window.location = 'index.php';
        return;
      }
      throw new Error('Erreur réseau');
    }
    pcs = await res.json();
    // auto-correct existing entries (client-side) and persist corrected values
    if (detectAI) await standardizeAndPersist(pcs);
    renderTable(pcs);
  } catch (err) {
    console.error(err);
    showNotification('Impossible de charger les données.', 'error');
  } finally {
    showLoading(false);
  }
}

// Standardize entries using DetectAI and persist corrections back to the server.
async function standardizeAndPersist(list) {
  if (!Array.isArray(list) || list.length === 0) return;
  if (!detectAI) return;
  for (let i = 0; i < list.length; i++) {
    const pc = list[i] || {};
    const corrected = Object.assign({}, pc);
    try {
      corrected.cpu = (detectAI.correctCPU(pc.cpu) || pc.cpu || '').trim();
      corrected.gpu = (detectAI.correctGPU(pc.gpu) || pc.gpu || '').trim();
      corrected.storage = (detectAI.correctStorage(pc.storage) || pc.storage || '').trim();
      corrected.ram = (detectAI.correctRAM ? (detectAI.correctRAM(pc.ram) || pc.ram || '').trim() : (pc.ram || '').trim());
      corrected.os = (detectAI.correctOS(pc.os) || pc.os || '').trim();
      corrected.brand = (detectAI.correctBrandModel(pc.brand) || pc.brand || '').trim();
    } catch (e) {
      console.error('DetectAI correction failed for index', i, e);
      continue;
    }
    // If nothing changed, skip
    const changed = ['cpu','gpu','storage','ram','os','brand'].some(k => String(pc[k] || '').trim() !== String(corrected[k] || '').trim());
    if (!changed) continue;
    // update local list for immediate UI feedback
    list[i] = corrected;
    try {
      // throttle to avoid server rate limits
      await new Promise(r => setTimeout(r, 300));
      const opts = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': CSRF,
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify(corrected)
      };
      const res = await fetch(`api.php?index=${i}`, opts);
      if (!res.ok) {
        console.warn('Failed to persist corrected PC at index', i, await res.text());
      } else {
        await res.json();
        showNotification('Correction appliquée pour l\'élément #' + (i + 1), 'success', 2000);
      }
    } catch (e) {
      console.error('Error persisting correction for index', i, e);
    }
  }
}

function renderTable(list) {
  tableBody.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="muted">Aucun PC</td></tr>';
    return;
  }
  const pairs = list.map((pc, i) => ({ pc, i }));
  // compute search tokens for highlighting
  const q = (searchInput?.value || '').trim();
  const tokens = q ? (q.match(/\S+/g) || []) : [];
  pairs.forEach(({ pc, i }, displayIndex) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="row-index">
          <span class="index-number">${displayIndex + 1}</span>
          <div class="qr-container" id="qr-${i}" data-id="${pc.id || ''}" data-index="${i}" title="QR"></div>
        </div>
      </td>
      <td><img src="icons/${getCPUImage(pc.cpu)}" alt="${pc.cpu}">${highlight(pc.cpu, tokens)}</td>
      <td><img src="icons/${getGPUImage(pc.gpu)}" alt="${pc.gpu}">${highlight(pc.gpu, tokens)}</td>
      <td><img src="icons/${getStorageImage(pc.storage)}" alt="${pc.storage}">${highlight(pc.storage, tokens)}</td>
      <td><img src="icons/${getRAMImage(pc.ram)}" alt="${pc.ram}">${highlight(pc.ram, tokens)}</td>
      <td><img src="icons/${getOSImage(pc.os)}" alt="${pc.os}">${highlight(pc.os, tokens)}</td>
      <td><img src="icons/${getBrandImage(pc.brand)}" alt="${pc.brand}">${highlight(pc.brand, tokens)}</td>
      <td class="actions">
        <button class="btn btn-small btn-edit" data-index="${i}">Modifier</button>
        <button class="btn btn-small btn-danger btn-delete" data-index="${i}">Supprimer</button>
      </td>
    `;
    tr.classList.add('enter');
    tableBody.appendChild(tr);
    // generate QR code for the row (prefer id, fallback to index)
    try {
      (function(rowIndex, pcData) {
        const el = document.getElementById('qr-' + rowIndex);
        if (el && typeof QRCode === 'function') {
          const payload = (pcData && pcData.id) ? ('id:' + pcData.id) : ('index:' + rowIndex);
          el.innerHTML = '';
          new QRCode(el, { text: payload, width: 64, height: 64, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
        }
      })(i, pc);
    } catch (e) { /* ignore QR errors */ }
    tr.addEventListener('animationend', () => tr.classList.remove('enter'));
  });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text, tokens) {
  let t = escapeHtml(text || '');
  if (!tokens || !tokens.length) return t;
  tokens.forEach((tok) => {
    if (!tok) return;
    try {
      const re = new RegExp('(' + escapeRegex(tok) + ')', 'ig');
      t = t.replace(re, '<mark>$1</mark>');
    } catch (e) { /* ignore bad regex */ }
  });
  return t;
}

btnCreate.addEventListener('click', () => {
  editIndex = null;
  modalTitle.textContent = 'Ajouter un PC';
  pcForm.reset();
  updatePreviewsFromForm();
  showModal();
  const cpuInp = pcForm.querySelector('[name="cpu"]');
  if (cpuInp) cpuInp.focus();
});

modalCancel.addEventListener('click', (e) => {
  e.preventDefault();
  hideModal();
});

modalSave.addEventListener('click', async (e) => {
  e.preventDefault();
  const formData = new FormData(pcForm);
  const original = {};
  ['cpu', 'gpu', 'storage', 'ram', 'os', 'brand'].forEach((k) => (original[k] = (formData.get(k) || '').trim()));
  if (!original.cpu) {
    showNotification('Le champ CPU est requis', 'error');
    return;
  }

  // Compute suggested corrections but do NOT persist them yet
  const suggested = Object.assign({}, original);
  if (detectAI) {
    try {
      suggested.cpu = (detectAI.correctCPU(original.cpu) || original.cpu).trim();
      suggested.gpu = (detectAI.correctGPU(original.gpu) || original.gpu).trim();
      suggested.storage = (detectAI.correctStorage(original.storage) || original.storage).trim();
      suggested.ram = (detectAI.correctRAM ? (detectAI.correctRAM(original.ram) || original.ram) : original.ram).trim();
      suggested.os = (detectAI.correctOS(original.os) || original.os).trim();
      suggested.brand = (detectAI.correctBrandModel(original.brand) || original.brand).trim();
    } catch (err) {
      console.error('DetectAI correction error', err);
    }
  }

  // Determine which fields actually changed according to DetectAI
  const fields = ['cpu', 'gpu', 'storage', 'ram', 'os', 'brand'];
  const changes = [];
  fields.forEach((f) => {
    const a = (original[f] || '').trim();
    const b = (suggested[f] || '').trim();
    if (a !== b) {
      changes.push({ field: f, from: a, to: b });
    }
  });

  // If there are proposed changes, show confirmation modal offering three choices
  if (changes.length > 0) {
    // store pending state
    pendingOriginalPC = original;
    pendingSuggestedPC = suggested;
    pendingEditIndex = editIndex;

    // hide the create modal and show corrections modal
    hideModal();
    if (correctionList) {
      correctionList.innerHTML = '';
      changes.forEach((c) => {
        const row = document.createElement('div');
        row.className = 'correction-row';
        row.innerHTML = `<strong>${c.field.toUpperCase()}</strong>: <div style="margin-top:6px;">De: <em>${escapeHtml(c.from || '(vide)')}</em></div><div>Vers: <strong>${escapeHtml(c.to || '')}</strong></div>`;
        correctionList.appendChild(row);
      });
    }
    showCorrectionModal();
    return;
  }

  // No changes => persist original value immediately
  await sendPC(original, editIndex);
});

// délégation pour edit / delete
tableBody.addEventListener('click', (e) => {
  const target = e.target;
  if (target.matches('.btn-edit')) {
    const idx = parseInt(target.dataset.index, 10);
    editIndex = idx;
    const pc = pcs[idx] || {};
    pcForm.cpu.value = pc.cpu || '';
    pcForm.gpu.value = pc.gpu || '';
    pcForm.storage.value = pc.storage || '';
    pcForm.querySelector('[name="ram"]').value = pc.ram || '';
    pcForm.os.value = pc.os || '';
    pcForm.brand.value = pc.brand || '';
    updatePreviewsFromForm();
    modalTitle.textContent = 'Modifier un PC';
    showModal();
  } else if (target.matches('.btn-delete')) {
    const idx = parseInt(target.dataset.index, 10);
    showConfirm('Supprimer cet élément ?').then((ok) => {
      if (!ok) return;
      fetch(`api.php?index=${idx}`, { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRF-Token': CSRF, 'X-Requested-With': 'XMLHttpRequest' } })
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 401) {
              showNotification('Non authentifié', 'error');
              window.location = 'index.php';
              return;
            }
            throw new Error(await res.text());
          }
          await res.json();
          loadPCs();
        })
        .catch((err) => {
          console.error(err);
          showNotification('Erreur lors de la suppression', 'error');
        });
    });
  }
});

function showModal() {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}

function hideModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  editIndex = null;
  pcForm.reset();
  updatePreviewsFromForm();
  document.body.classList.remove('no-scroll');
}

// Correction modal helpers
function showCorrectionModal() {
  if (!correctionModal) return;
  correctionModal.classList.add('open');
  correctionModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}

function hideCorrectionModal() {
  if (!correctionModal) return;
  correctionModal.classList.remove('open');
  correctionModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}

// Send PC to server (POST or PUT depending on idx)
async function sendPC(pcObj, idx) {
  if (!CSRF) {
    showNotification('Jeton CSRF manquant. Rechargez la page.', 'error');
    return;
  }
  try {
    const opts = {
      method: idx === null ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': CSRF,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(pcObj),
      credentials: 'same-origin',
    };
    const url = idx === null ? 'api.php' : `api.php?index=${idx}`;
    const res = await fetch(url, opts);
    if (!res.ok) {
      if (res.status === 401) {
        showNotification('Non authentifié', 'error');
        window.location = 'index.php';
        return;
      }
      const txt = await res.text();
      throw new Error(txt || 'Erreur serveur');
    }
    await res.json();
    // after success, refresh list
    hideCorrectionModal();
    hideModal();
    loadPCs();
  } catch (err) {
    console.error(err);
    showNotification("Erreur lors de l'enregistrement", 'error');
  }
}

// Correction modal button handlers
if (correctionApply) {
  correctionApply.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!pendingSuggestedPC) return;
    await sendPC(pendingSuggestedPC, pendingEditIndex);
    pendingSuggestedPC = pendingOriginalPC = null;
    pendingEditIndex = null;
  });
}

if (correctionKeep) {
  correctionKeep.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!pendingOriginalPC) return;
    await sendPC(pendingOriginalPC, pendingEditIndex);
    pendingSuggestedPC = pendingOriginalPC = null;
    pendingEditIndex = null;
  });
}

if (correctionEdit) {
  correctionEdit.addEventListener('click', (e) => {
    e.preventDefault();
    if (!pendingOriginalPC) return;
    const idx = pendingEditIndex;
    // re-open the main form with original values so user can edit manually
    hideCorrectionModal();
    editIndex = idx;
    pcForm.querySelector('[name="cpu"]').value = pendingOriginalPC.cpu || '';
    pcForm.querySelector('[name="gpu"]').value = pendingOriginalPC.gpu || '';
    pcForm.querySelector('[name="storage"]').value = pendingOriginalPC.storage || '';
    pcForm.querySelector('[name="ram"]').value = pendingOriginalPC.ram || '';
    pcForm.querySelector('[name="os"]').value = pendingOriginalPC.os || '';
    pcForm.querySelector('[name="brand"]').value = pendingOriginalPC.brand || '';
    pendingSuggestedPC = pendingOriginalPC = null;
    pendingEditIndex = null;
    updatePreviewsFromForm();
    showModal();
  });
}

// small preview pop animation helper
function animatePreview(el) {
  if (!el) return;
  el.classList.remove('pop');
  // reflow to restart animation
  void el.offsetWidth;
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 300);
}

// Notifications
function showNotification(msg, type = 'info', timeout = 4000) {
  if (!notifications) return alert(msg);
  const n = document.createElement('div');
  n.className = 'notification ' + (type || 'info');
  n.innerHTML = msg;
  notifications.appendChild(n);
  setTimeout(() => {
    n.style.transition = 'opacity 240ms ease, transform 240ms ease';
    n.style.opacity = '0';
    n.style.transform = 'translateY(8px)';
    setTimeout(() => n.remove(), 300);
  }, timeout);
}

function showConfirm(message) {
  return new Promise((resolve) => {
    if (!confirmModal) return resolve(confirm(message));
    const msgEl = confirmModal.querySelector('.confirm-message');
    const yes = confirmModal.querySelector('.confirm-yes');
    const no = confirmModal.querySelector('.confirm-no');
    msgEl.textContent = message;
    confirmModal.classList.add('open');
    confirmModal.setAttribute('aria-hidden', 'false');
    function cleanup(val) {
      confirmModal.classList.remove('open');
      confirmModal.setAttribute('aria-hidden', 'true');
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      resolve(val);
    }
    function onYes(e) { e.preventDefault(); cleanup(true); }
    function onNo(e) { e.preventDefault(); cleanup(false); }
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
  });
}

function showLoading(on = true) {
  if (!loadingOverlay) return;
  if (on) {
    loadingOverlay.classList.add('open');
    loadingOverlay.hidden = false;
  } else {
    loadingOverlay.classList.remove('open');
    loadingOverlay.hidden = true;
  }
}

// Settings UI elements
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const settingsCancel = document.getElementById('settings-cancel');
const settingsSave = document.getElementById('settings-save');

function showSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.add('open');
  settingsModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}

function hideSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.remove('open');
  settingsModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}

// Delegated click handler to open settings (robust if element not present at load)
document.addEventListener('click', async (e) => {
  const btn = e.target.closest ? e.target.closest('#btn-settings') : (e.target.id === 'btn-settings' ? e.target : null);
  if (!btn) return;
  e.preventDefault();
  try {
    const res = await fetch('settings.php', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Impossible de charger les paramètres');
    const s = await res.json();
    if (settingsForm) {
      settingsForm.querySelector('[name=enable_logs]').checked = !!s.enable_logs;
      settingsForm.querySelector('[name=log_writes]').checked = !!s.log_writes;
      settingsForm.querySelector('[name=log_deletes]').checked = !!s.log_deletes;
      settingsForm.querySelector('[name=log_modifications]').checked = !!s.log_modifications;
      settingsForm.querySelector('[name=log_auth]').checked = !!s.log_auth;
      settingsForm.querySelector('[name=log_file]').value = s.log_file || 'logs/pcspecs.log';
      // security fields
      const el = settingsForm.querySelector('[name=enable_login_attempts]');
      if (el) el.checked = !!s.enable_login_attempts;
      const lac = settingsForm.querySelector('[name=login_attempts_count]');
      if (lac) lac.value = parseInt(s.login_attempts_count || 5, 10);
      const ls = settingsForm.querySelector('[name=lockout_seconds]');
      if (ls) ls.value = parseInt(s.lockout_seconds || 300, 10);
      // IP block fields
      const ipb = settingsForm.querySelector('[name=ip_block_enabled]');
      if (ipb) ipb.checked = !!s.ip_block_enabled;
      const ipt = settingsForm.querySelector('[name=ip_block_threshold]');
      if (ipt) ipt.value = parseInt(s.ip_block_threshold || 20, 10);
      const ipd = settingsForm.querySelector('[name=ip_block_seconds]');
      if (ipd) ipd.value = parseInt(s.ip_block_seconds || 3600, 10);
      // apply dependencies (disable/grayout dependent controls)
      applySettingsDependencies();
    }
    showSettingsModal();
  } catch (err) {
    console.error(err);
    showNotification('Erreur en chargeant les paramètres', 'error');
  }
});

if (settingsCancel) settingsCancel.addEventListener('click', (e) => { e.preventDefault(); hideSettingsModal(); });

if (settingsSave) {
  settingsSave.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!settingsForm) return;
    const payload = {
      enable_logs: !!settingsForm.querySelector('[name=enable_logs]').checked,
      log_writes: !!settingsForm.querySelector('[name=log_writes]').checked,
      log_deletes: !!settingsForm.querySelector('[name=log_deletes]').checked,
      log_modifications: !!settingsForm.querySelector('[name=log_modifications]').checked,
      log_auth: !!settingsForm.querySelector('[name=log_auth]').checked,
      // login attempts / security
      enable_login_attempts: !!settingsForm.querySelector('[name=enable_login_attempts]').checked,
      login_attempts_count: parseInt(settingsForm.querySelector('[name=login_attempts_count]').value || 5, 10),
      lockout_seconds: parseInt(settingsForm.querySelector('[name=lockout_seconds]').value || 300, 10),
      // IP block
      ip_block_enabled: !!settingsForm.querySelector('[name=ip_block_enabled]').checked,
      ip_block_threshold: parseInt(settingsForm.querySelector('[name=ip_block_threshold]').value || 20, 10),
      ip_block_seconds: parseInt(settingsForm.querySelector('[name=ip_block_seconds]').value || 3600, 10),
      log_file: settingsForm.querySelector('[name=log_file]').value || 'logs/pcspecs.log'
    };
    try {
      const res = await fetch('settings.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': CSRF,
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Erreur serveur');
      }
      await res.json();
      hideSettingsModal();
      showNotification('Paramètres enregistrés', 'success');
    } catch (err) {
      console.error(err);
      showNotification("Erreur lors de l'enregistrement des paramètres", 'error');
    }
  });
}

// Settings dependency helpers: disable inputs that depend on master toggles
function applySettingsDependencies() {
  if (!settingsForm) return;
  const masters = Array.from(settingsForm.querySelectorAll('[name=enable_logs],[name=enable_login_attempts],[name=ip_block_enabled]'));
  masters.forEach((m) => {
    const name = m.getAttribute('name');
    const checked = !!m.checked;
    // find dependents that declare data-depends equal to this master's name
    const dependents = Array.from(settingsForm.querySelectorAll('[data-depends="' + name + '"]'));
    dependents.forEach((el) => {
      el.disabled = !checked;
      const lbl = el.closest('label');
      if (lbl) {
        if (!checked) lbl.classList.add('muted'); else lbl.classList.remove('muted');
      }
    });
  });
}

// attach change listeners to master toggles
if (settingsForm) {
  const toggleLogs = settingsForm.querySelector('[name=enable_logs]');
  const toggleLogin = settingsForm.querySelector('[name=enable_login_attempts]');
  if (toggleLogs) toggleLogs.addEventListener('change', applySettingsDependencies);
  if (toggleLogin) toggleLogin.addEventListener('change', applySettingsDependencies);
  const toggleIPBlock = settingsForm.querySelector('[name=ip_block_enabled]');
  if (toggleIPBlock) toggleIPBlock.addEventListener('change', applySettingsDependencies);
}

function updatePreviewsFromForm() {
  const cpu = (pcForm.querySelector('[name="cpu"]')?.value || '').trim();
  const gpu = (pcForm.querySelector('[name="gpu"]')?.value || '').trim();
  const storage = (pcForm.querySelector('[name="storage"]')?.value || '').trim();
  const ram = (pcForm.querySelector('[name="ram"]')?.value || '').trim();
  const os = (pcForm.querySelector('[name="os"]')?.value || '').trim();
  const brand = (pcForm.querySelector('[name="brand"]')?.value || '').trim();

  cpuPreview.src = `icons/${getCPUImage(cpu)}`;
  cpuDetected.textContent = detectCPU(cpu);

  gpuPreview.src = `icons/${getGPUImage(gpu)}`;
  gpuDetected.textContent = detectGPU(gpu);

  storagePreview.src = `icons/${getStorageImage(storage)}`;
  storageDetected.textContent = detectStorage(storage);

  // RAM preview/detection
  if (typeof ram !== 'undefined') {
    ramPreview && (ramPreview.src = `icons/${getRAMImage(ram)}`);
    ramDetected && (ramDetected.textContent = detectRAM(ram));
  }

  osPreview.src = `icons/${getOSImage(os)}`;
  osDetected.textContent = detectOS(os);

  brandPreview.src = `icons/${getBrandImage(brand)}`;
  brandDetected.textContent = detectBrand(brand);

  // animate previews for better feedback
  animatePreview(cpuPreview);
  animatePreview(gpuPreview);
  animatePreview(storagePreview);
  animatePreview(ramPreview);
  animatePreview(osPreview);
  animatePreview(brandPreview);
  [cpuDetected, gpuDetected, storageDetected, ramDetected, osDetected, brandDetected].forEach((el) => {
    if (!el) return;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 260);
  });
}

// recherche en direct
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) {
    renderTable(pcs);
    return;
  }
  const filtered = pcs
    .map((pc, i) => ({ pc, i }))
    .filter((pair) => Object.values(pair.pc).join(' ').toLowerCase().includes(q));

  tableBody.innerHTML = '';
  filtered.forEach(({ pc, i }, displayIndex) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="row-index">
          <span class="index-number">${displayIndex + 1}</span>
          <div class="qr-container" id="qr-${i}" data-id="${pc.id || ''}" data-index="${i}" title="QR"></div>
        </div>
      </td>
      <td><img src="icons/${getCPUImage(pc.cpu)}" alt="${pc.cpu}">${escapeHtml(pc.cpu)}</td>
      <td><img src="icons/${getGPUImage(pc.gpu)}" alt="${pc.gpu}">${escapeHtml(pc.gpu)}</td>
      <td><img src="icons/${getStorageImage(pc.storage)}" alt="${pc.storage}">${escapeHtml(pc.storage)}</td>
      <td><img src="icons/${getRAMImage(pc.ram)}" alt="${pc.ram}">${escapeHtml(pc.ram)}</td>
      <td><img src="icons/${getOSImage(pc.os)}" alt="${pc.os}">${escapeHtml(pc.os)}</td>
      <td><img src="icons/${getBrandImage(pc.brand)}" alt="${pc.brand}">${escapeHtml(pc.brand)}</td>
      <td class="actions">
        <button class="btn btn-small btn-edit" data-index="${i}">Modifier</button>
        <button class="btn btn-small btn-danger btn-delete" data-index="${i}">Supprimer</button>
      </td>
    `;
    tr.classList.add('enter');
    tableBody.appendChild(tr);
    // generate QR for filtered row
    try {
      (function(rowIndex, pcData) {
        const el = document.getElementById('qr-' + rowIndex);
        if (el && typeof QRCode === 'function') {
          const payload = (pcData && pcData.id) ? ('id:' + pcData.id) : ('index:' + rowIndex);
          el.innerHTML = '';
          new QRCode(el, { text: payload, width: 64, height: 64, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
        }
      })(i, pc);
    } catch (e) { /* ignore */ }
    tr.addEventListener('animationend', () => tr.classList.remove('enter'));
  });
});

// input listeners pour mise à jour en direct
['cpu','gpu','storage','ram','os','brand'].forEach((name) => {
  const input = pcForm.querySelector(`[name="${name}"]`);
  if (input) input.addEventListener('input', updatePreviewsFromForm);
});

// improved detection helpers
function detectCPU(s) {
  if (detectAI) return detectAI.detectCPU(s);
  if (!s) return '';
  const su = s.toUpperCase();
  // detect i3/i5/i7/i9
  const m = su.match(/\bI[3579]\b/i) || su.match(/\bI[3579]-?\d*/i);
  if (m) return m[0].toUpperCase();
  // Ryzen
  const r = su.match(/RYZEN\s*\d*/i);
  if (r) return r[0];
  if (/INTEL/i.test(su)) return 'Intel';
  if (/AMD/i.test(su)) return 'AMD';
  return '';
}

function detectGPU(s) {
  if (detectAI) return detectAI.detectGPU(s);
  if (!s) return '';
  const n = s.toLowerCase();
  const rtx = n.match(/rtx\s*\d{3,4}/i);
  if (rtx) return rtx[0].toUpperCase();
  const gtx = n.match(/gtx\s*\d{3,4}/i);
  if (gtx) return gtx[0].toUpperCase();
  const rx = n.match(/\brx\s*\d{3,4}/i);
  if (rx) return rx[0].toUpperCase();
  if (/(geforce|nvidia)/i.test(n)) return 'NVIDIA';
  if (/(radeon|radeon pro|amd)/i.test(n)) return 'AMD';
  if (/intel/i.test(n)) return 'Intel';
  return '';
}

function detectStorage(s) {
  if (detectAI) return detectAI.detectStorage(s);
  if (!s) return '';
  const su = s.toUpperCase();
  if (/HDD/i.test(su)) return 'HDD';
  if (/NVME|M\.2|SSD/i.test(su)) return 'SSD';
  return '';
}

function detectRAM(s) {
  if (detectAI && typeof detectAI.detectRAM === 'function') return detectAI.detectRAM(s);
  if (!s) return '';
  const m = String(s).match(/(\d+(?:[\.,]\d+)?)\s*(tb|to|t|gb|g|go|mb|m|mo|kb|k|ko)\b/i);
  let cap = '';
  if (m) {
    let num = m[1].replace(',', '.');
    let unit = (m[2] || '').toLowerCase();
    if (unit === 'to' || unit === 't' || unit === 'tb') unit = 'TB';
    else if (unit === 'go' || unit === 'g' || unit === 'gb') unit = 'GB';
    else if (unit === 'mo' || unit === 'm' || unit === 'mb') unit = 'MB';
    else if (unit === 'ko' || unit === 'k' || unit === 'kb') unit = 'KB';
    if (unit) {
      if (num.indexOf('.') >= 0) num = parseFloat(num).toString(); else num = parseInt(num, 10).toString();
      cap = num + unit;
    }
  }
  // return only capacity (e.g. '16GB') — do not include DDR specifiers
  return cap;
}

function detectOS(s) {
  if (detectAI) return detectAI.detectOS(s);
  if (!s) return '';
  const n = s.toLowerCase();
  if (/(windows\s*11|win\s*11|^11\b)/i.test(n)) return 'Windows 11';
  if (/(windows\s*10|win\s*10|^10\b)/i.test(n)) return 'Windows 10';
  if (/(windows\s*8\.1|win\s*8\.1|8\.1\b)/i.test(n)) return 'Windows 8.1';
  if (/(windows\s*8|win\s*8)\b/i.test(n)) return 'Windows 8';
  if (/(windows\s*7|win\s*7)\b/i.test(n)) return 'Windows 7';
  if (/ubuntu/i.test(n)) return 'Ubuntu';
  if (/debian/i.test(n)) return 'Debian';
  if (/fedora/i.test(n)) return 'Fedora';
  if (/kali/i.test(n)) return 'Kali';
  if (/arch/i.test(n)) return 'Arch';
  return '';
}

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectBrand(s) {
  if (detectAI) return detectAI.detectBrand(s);
  if (!s) return '';
  const n = normalize(s);
  const brands = ['dell','asus','msi','gigabyte','samsung','lenovo','hp','acer','toshiba','apple','microsoft'];
  for (const b of brands) if (n.includes(b)) return b.charAt(0).toUpperCase() + b.slice(1);
  return '';
}

// helpers for icons (kept similar logic to original)
function getCPUImage(cpu) {
  if (detectAI) return detectAI.getCPUImage(cpu);
  if (!cpu) return 'none.png';
  const s = cpu.toUpperCase();
  return (s.includes('I3') ? 'i3' : s.includes('I5') ? 'i5' : s.includes('I7') ? 'i7' : s.includes('I9') ? 'i9' : s.includes('INTEL') ? 'intel' : s.includes('AMD') ? 'amd' : 'none') + '.png';
}

function getGPUImage(gpu) {
  if (detectAI) return detectAI.getGPUImage(gpu);
  if (!gpu) return 'none.png';
  const n = (gpu || '').toLowerCase();
  if (/(geforce|rtx|gtx|nvidia)/i.test(n)) return 'nvidia.png';
  if (/(radeon|rx|amd)/i.test(n)) return 'amd.png';
  if (/intel/i.test(n)) return 'intel.png';
  return 'none.png';
}

function getStorageImage(storage) {
  if (detectAI) return detectAI.getStorageImage(storage);
  if (!storage) return 'none.png';
  const s = storage.toUpperCase();
  return (s.includes('HDD') ? 'hdd' : 'ssd') + '.png';
}

function getRAMImage(ram) {
  if (detectAI && typeof detectAI.getRAMImage === 'function') return detectAI.getRAMImage(ram);
  // no dedicated RAM icon available, fallback to none
  return 'none.png';
}

function getOSImage(os) {
  if (detectAI) return detectAI.getOSImage(os);
  if (!os) return 'none.png';
  const n = (os || '').toLowerCase();
  if (/(windows\s*11|win\s*11|^11\b)/i.test(n)) return 'win11.png';
  if (/(windows\s*10|win\s*10|^10\b)/i.test(n)) return 'win10.png';
  if (/(windows\s*8\.1|win\s*8\.1|8\.1\b)/i.test(n)) return 'win81.png';
  if (/(windows\s*8|win\s*8)\b/i.test(n)) return 'win8.png';
  if (/(windows\s*7|win\s*7)\b/i.test(n)) return 'win7.png';
  if (/xp/i.test(n)) return 'winxp.png';
  if (/vista/i.test(n)) return 'winvista.png';
  if (/kali/i.test(n)) return 'kali.png';
  if (/ubuntu/i.test(n)) return 'ubuntu.png';
  if (/debian/i.test(n)) return 'debian.png';
  if (/fedora/i.test(n)) return 'fedora.png';
  if (/arch/i.test(n)) return 'arch.png';
  return 'none.png';
}

function getBrandImage(brand) {
  if (detectAI) return detectAI.getBrandImage(brand);
  if (!brand) return 'none.png';
  const n = normalize(brand);
  const map = { dell:'dell', asus:'asus', msi:'msi', gigabyte:'gigabyte', samsung:'samsung', lenovo:'lenovo', hp:'hp', acer:'acer', toshiba:'toshiba', apple:'apple', microsoft:'microsoft' };
  for (const k in map) if (n.includes(k)) return map[k] + '.png';
  return 'none.png';
}

// initial load
loadPCs();
