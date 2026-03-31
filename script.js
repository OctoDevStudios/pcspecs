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

const cpuDetected = document.getElementById('cpu-detected');
const gpuDetected = document.getElementById('gpu-detected');
const storageDetected = document.getElementById('storage-detected');
const osDetected = document.getElementById('os-detected');
const brandDetected = document.getElementById('brand-detected');

const CSRF = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

let pcs = [];
let editIndex = null;

async function loadPCs() {
  try {
    const res = await fetch('api.php', { credentials: 'same-origin' });
    if (!res.ok) {
      if (res.status === 401) {
        alert('Non authentifié. Veuillez vous reconnecter.');
        window.location = 'index.php';
        return;
      }
      throw new Error('Erreur réseau');
    }
    pcs = await res.json();
    renderTable(pcs);
  } catch (err) {
    console.error(err);
    alert('Impossible de charger les données.');
  }
}

function renderTable(list) {
  tableBody.innerHTML = '';
  const pairs = list.map((pc, i) => ({ pc, i }));
  pairs.forEach(({ pc, i }, displayIndex) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${displayIndex + 1}</td>
      <td><img src="icons/${getCPUImage(pc.cpu)}" alt="${pc.cpu}">${escapeHtml(pc.cpu)}</td>
      <td><img src="icons/${getGPUImage(pc.gpu)}" alt="${pc.gpu}">${escapeHtml(pc.gpu)}</td>
      <td><img src="icons/${getStorageImage(pc.storage)}" alt="${pc.storage}">${escapeHtml(pc.storage)}</td>
      <td><img src="icons/${getOSImage(pc.os)}" alt="${pc.os}">${escapeHtml(pc.os)}</td>
      <td><img src="icons/${getBrandImage(pc.brand)}" alt="${pc.brand}">${escapeHtml(pc.brand)}</td>
      <td class="actions">
        <button class="btn btn-small btn-edit" data-index="${i}">Modifier</button>
        <button class="btn btn-small btn-danger btn-delete" data-index="${i}">Supprimer</button>
      </td>
    `;
    // animate entry
    tr.classList.add('enter');
    tableBody.appendChild(tr);
    tr.addEventListener('animationend', () => tr.classList.remove('enter'));
  });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  const pc = {};
  ['cpu', 'gpu', 'storage', 'os', 'brand'].forEach((k) => (pc[k] = (formData.get(k) || '').trim()));
  if (!pc.cpu) {
    alert('Le champ CPU est requis');
    return;
  }
  if (!CSRF) {
    alert('Jeton CSRF manquant. Rechargez la page.');
    return;
  }
  try {
    const opts = {
      method: editIndex === null ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': CSRF,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(pc),
      credentials: 'same-origin',
    };
    const url = editIndex === null ? 'api.php' : `api.php?index=${editIndex}`;
    const res = await fetch(url, opts);
    if (!res.ok) {
      if (res.status === 401) {
        alert('Non authentifié');
        window.location = 'index.php';
        return;
      }
      const txt = await res.text();
      throw new Error(txt || 'Erreur serveur');
    }
    await res.json();
    hideModal();
    loadPCs();
  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'enregistrement");
  }
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
    pcForm.os.value = pc.os || '';
    pcForm.brand.value = pc.brand || '';
    updatePreviewsFromForm();
    modalTitle.textContent = 'Modifier un PC';
    showModal();
  } else if (target.matches('.btn-delete')) {
    const idx = parseInt(target.dataset.index, 10);
    if (confirm('Supprimer cet élément ?')) {
      fetch(`api.php?index=${idx}`, { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRF-Token': CSRF, 'X-Requested-With': 'XMLHttpRequest' } })
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 401) {
              alert('Non authentifié');
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
          alert('Erreur lors de la suppression');
        });
    }
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

// small preview pop animation helper
function animatePreview(el) {
  if (!el) return;
  el.classList.remove('pop');
  // reflow to restart animation
  void el.offsetWidth;
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 300);
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
      // apply dependencies (disable/grayout dependent controls)
      applySettingsDependencies();
    }
    showSettingsModal();
  } catch (err) {
    console.error(err);
    alert('Erreur en chargeant les paramètres');
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
      alert('Paramètres enregistrés');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement des paramètres");
    }
  });
}

// Settings dependency helpers: disable inputs that depend on master toggles
function applySettingsDependencies() {
  if (!settingsForm) return;
  const masters = Array.from(settingsForm.querySelectorAll('[name=enable_logs],[name=enable_login_attempts]'));
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
}

function updatePreviewsFromForm() {
  const cpu = (pcForm.querySelector('[name="cpu"]')?.value || '').trim();
  const gpu = (pcForm.querySelector('[name="gpu"]')?.value || '').trim();
  const storage = (pcForm.querySelector('[name="storage"]')?.value || '').trim();
  const os = (pcForm.querySelector('[name="os"]')?.value || '').trim();
  const brand = (pcForm.querySelector('[name="brand"]')?.value || '').trim();

  cpuPreview.src = `icons/${getCPUImage(cpu)}`;
  cpuDetected.textContent = detectCPU(cpu);

  gpuPreview.src = `icons/${getGPUImage(gpu)}`;
  gpuDetected.textContent = detectGPU(gpu);

  storagePreview.src = `icons/${getStorageImage(storage)}`;
  storageDetected.textContent = detectStorage(storage);

  osPreview.src = `icons/${getOSImage(os)}`;
  osDetected.textContent = detectOS(os);

  brandPreview.src = `icons/${getBrandImage(brand)}`;
  brandDetected.textContent = detectBrand(brand);

  // animate previews for better feedback
  animatePreview(cpuPreview);
  animatePreview(gpuPreview);
  animatePreview(storagePreview);
  animatePreview(osPreview);
  animatePreview(brandPreview);
  [cpuDetected, gpuDetected, storageDetected, osDetected, brandDetected].forEach((el) => {
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
      <td>${displayIndex + 1}</td>
      <td><img src="icons/${getCPUImage(pc.cpu)}" alt="${pc.cpu}">${escapeHtml(pc.cpu)}</td>
      <td><img src="icons/${getGPUImage(pc.gpu)}" alt="${pc.gpu}">${escapeHtml(pc.gpu)}</td>
      <td><img src="icons/${getStorageImage(pc.storage)}" alt="${pc.storage}">${escapeHtml(pc.storage)}</td>
      <td><img src="icons/${getOSImage(pc.os)}" alt="${pc.os}">${escapeHtml(pc.os)}</td>
      <td><img src="icons/${getBrandImage(pc.brand)}" alt="${pc.brand}">${escapeHtml(pc.brand)}</td>
      <td class="actions">
        <button class="btn btn-small btn-edit" data-index="${i}">Modifier</button>
        <button class="btn btn-small btn-danger btn-delete" data-index="${i}">Supprimer</button>
      </td>
    `;
    tr.classList.add('enter');
    tableBody.appendChild(tr);
    tr.addEventListener('animationend', () => tr.classList.remove('enter'));
  });
});

// input listeners pour mise à jour en direct
['cpu','gpu','storage','os','brand'].forEach((name) => {
  const input = pcForm.querySelector(`[name="${name}"]`);
  if (input) input.addEventListener('input', updatePreviewsFromForm);
});

// improved detection helpers
function detectCPU(s) {
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
  if (!s) return '';
  const su = s.toUpperCase();
  if (/HDD/i.test(su)) return 'HDD';
  if (/NVME|M\.2|SSD/i.test(su)) return 'SSD';
  return '';
}

function detectOS(s) {
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
  if (!s) return '';
  const n = normalize(s);
  const brands = ['dell','asus','msi','gigabyte','samsung','lenovo','hp','acer','toshiba','apple'];
  for (const b of brands) if (n.includes(b)) return b.charAt(0).toUpperCase() + b.slice(1);
  return '';
}

// helpers for icons (kept similar logic to original)
function getCPUImage(cpu) {
  if (!cpu) return 'none.png';
  const s = cpu.toUpperCase();
  return (s.includes('I3') ? 'i3' : s.includes('I5') ? 'i5' : s.includes('I7') ? 'i7' : s.includes('I9') ? 'i9' : s.includes('INTEL') ? 'intel' : s.includes('AMD') ? 'amd' : 'none') + '.png';
}

function getGPUImage(gpu) {
  if (!gpu) return 'none.png';
  const n = (gpu || '').toLowerCase();
  if (/(geforce|rtx|gtx|nvidia)/i.test(n)) return 'nvidia.png';
  if (/(radeon|rx|amd)/i.test(n)) return 'amd.png';
  if (/intel/i.test(n)) return 'intel.png';
  return 'none.png';
}

function getStorageImage(storage) {
  if (!storage) return 'none.png';
  const s = storage.toUpperCase();
  return (s.includes('HDD') ? 'hdd' : 'ssd') + '.png';
}

function getOSImage(os) {
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
  if (!brand) return 'none.png';
  const n = normalize(brand);
  const map = { dell:'dell', asus:'asus', msi:'msi', gigabyte:'gigabyte', samsung:'samsung', lenovo:'lenovo', hp:'hp', acer:'acer', toshiba:'toshiba', apple:'apple' };
  for (const k in map) if (n.includes(k)) return map[k] + '.png';
  return 'none.png';
}

// initial load
loadPCs();
