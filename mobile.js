document.addEventListener('DOMContentLoaded', function () {

  // DOM
  const resultEl = document.getElementById('scan-result');
  const detailEl = document.getElementById('pc-detail');
  const listEl = document.getElementById('pc-list');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnFlash = document.getElementById('btn-flash');
  const btnList = document.getElementById('btn-list');
  const fabScan = document.getElementById('fab-scan');
  const fabList = document.getElementById('fab-list');
  const popup = document.getElementById('popup');
  const popupMessage = document.getElementById('popup-message');
  const popupClose = document.getElementById('popup-close');
  const overlay = document.getElementById('overlay');
  const loading = document.getElementById('loading');
  const progressBar = document.getElementById('progress-bar');
  const loadingText = document.getElementById('loading-text');
  const snackbar = document.getElementById('snackbar');

  // State
  let scanner = null;
  let scanning = false;
  let torchOn = false;
  let processing = false;

  // Helpers
  function showMsg(msg) { if (resultEl) resultEl.textContent = msg; }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function showSnackbar(msg, duration = 3000) {
    if (!snackbar) return;
    snackbar.textContent = msg;
    snackbar.classList.add('show');
    clearTimeout(snackbar._timer);
    snackbar._timer = setTimeout(() => { snackbar.classList.remove('show'); }, duration);
  }

  function displayPopup(message) {
    if (!popup || !overlay || !popupMessage) return;
    popupMessage.textContent = message;
    popup.classList.add('active');
    overlay.classList.add('active');
  }
  function hidePopup() { if (!popup || !overlay) return; popup.classList.remove('active'); overlay.classList.remove('active'); }

  function showLoadingFake(ms = 700, text = 'Chargement...') {
    if (!loading || !progressBar) return Promise.resolve();
    loadingText.textContent = text;
    progressBar.style.width = '0%';
    loading.classList.add('active');
    return new Promise((resolve) => {
      const start = performance.now();
      const id = setInterval(() => {
        const elapsed = performance.now() - start;
        const pct = Math.min(100, (elapsed / ms) * 100);
        progressBar.style.width = pct + '%';
        if (pct >= 100) {
          clearInterval(id);
          setTimeout(() => { loading.classList.remove('active'); progressBar.style.width = '0%'; resolve(); }, 200);
        }
      }, 40);
    });
  }

  function displayPC(pc) {
    if (!detailEl) return;
    detailEl.innerHTML =
      '<div class="pc-item"><div style="flex:1">' +
        '<div><strong>' + esc(pc.cpu || '-') + '</strong></div>' +
        '<div class="meta">' + esc(pc.brand || '') + (pc.gpu ? ' - ' + esc(pc.gpu) : '') + '</div>' +
        '<div class="meta">' + [pc.ram, pc.storage, pc.os].filter(Boolean).map(esc).join(' / ') + '</div>' +
      '</div></div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function fetchPC(param, value) {
    try {
      await showLoadingFake(600, 'Recherche...');
      const r = await fetch('api.php?' + param + '=' + encodeURIComponent(value), { credentials: 'same-origin' });
      if (!r.ok) return null;
      const d = await r.json();
      return (d && typeof d === 'object' && !Array.isArray(d)) ? d : null;
    } catch (e) {
      return null;
    }
  }

  // QR decoded
  async function onDecoded(text) {
    if (processing) return;
    processing = true;
    const raw = String(text || '').trim();
    console.log('[QR] decoded', raw);
    showMsg('QR lu : ' + raw);
    let val = null;
    const m = raw.match(/^(?:id:|index:)?\s*(\d+)$/i);
    if (m) val = m[1];
    else if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        val = u.searchParams.get('id') || u.searchParams.get('index');
      } catch (e) {}
    }
    if (!val) { displayPopup('QR non reconnu : ' + raw); processing = false; return; }
    try {
      let pc = await fetchPC('id', val);
      if (!pc) pc = await fetchPC('index', val);
      if (pc) { displayPC(pc); stopScanner(); showSnackbar('PC trouvé'); }
      else displayPopup('Aucun PC trouvé pour ' + val);
    } catch (e) {
      displayPopup('Erreur réseau');
    }
    processing = false;
  }

  // Start/Stop
  async function startScanner() {
    if (scanning) { showSnackbar('Scanner déjà actif'); return; }
    if (typeof Html5Qrcode === 'undefined') { displayPopup('Bibliothèque QR non chargée. Rechargez la page.'); return; }
    scanner = new Html5Qrcode('qr-reader');
    try {
      await showLoadingFake(500, 'Activation caméra...');
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => { const side = Math.min(w, h, Math.floor(Math.min(400, w * 0.7))); return { width: side, height: side }; } },
        (decodedText) => onDecoded(decodedText),
        (err) => console.debug('[mobile] no qr', err)
      );
      scanning = true;
      btnStop.disabled = false;
      if (btnStart) btnStart.disabled = true;
      if (btnFlash) btnFlash.disabled = false;
      showSnackbar('Scanner actif — approchez un QR');
      showMsg('Scanner actif — approchez un QR code');
    } catch (err) {
      console.error('[mobile] start error', err);
      displayPopup('Erreur caméra : ' + (err && err.message ? err.message : String(err)));
      try { scanner.clear(); } catch (e) {}
      scanner = null;
      scanning = false;
      if (btnStart) btnStart.disabled = false;
    }
  }

  function stopScanner() {
    if (!scanner) { showSnackbar('Scanner non démarré'); return; }
    scanner.stop().then(() => scanner.clear()).catch(() => { try { scanner.clear(); } catch (e) {} }).finally(() => {
      scanner = null;
      scanning = false;
      torchOn = false;
      processing = false;
      if (btnStop) btnStop.disabled = true;
      if (btnStart) btnStart.disabled = false;
      if (btnFlash) btnFlash.disabled = true;
      showSnackbar('Scanner arrêté');
      showMsg('Scanner arrêté');
    });
  }

  function toggleFlash() {
    if (!scanner || !scanning) return;
    torchOn = !torchOn;
    scanner.applyVideoConstraints({ advanced: [{ torch: torchOn }] }).then(() => {
      if (btnFlash) btnFlash.textContent = torchOn ? 'Flash ON' : 'Flash';
      showSnackbar(torchOn ? 'Flash activé' : 'Flash désactivé');
    }).catch(() => {
      torchOn = false;
      displayPopup('Flash non supporté sur cet appareil');
    });
  }

  async function browseDB() {
    if (!listEl) return;
    listEl.classList.remove('hidden');
    listEl.innerHTML = '<div class="muted">Chargement...</div>';
    try {
      await showLoadingFake(600, 'Chargement base...');
      const r = await fetch('api.php', { credentials: 'same-origin' });
      if (!r.ok) { listEl.innerHTML = '<div class="muted">Erreur de chargement</div>'; return; }
      const arr = await r.json();
      if (!Array.isArray(arr) || arr.length === 0) { listEl.innerHTML = '<div class="muted">Aucun PC en base</div>'; return; }
      listEl.innerHTML = '';
      arr.forEach(function (pc, i) {
        const row = document.createElement('div');
        row.className = 'pc-item';
        row.innerHTML = '<div style="flex:1"><div><strong>' + esc(pc.cpu || '(vide)') + '</strong></div><div class="meta">' + esc(pc.brand || '') + (pc.gpu ? ' - ' + esc(pc.gpu) : '') + '</div><div class="meta">#' + (i + 1) + ' id:' + esc(String(pc.id || '')) + '</div></div>';
        row.addEventListener('click', function () { displayPC(pc); hideList(); });
        listEl.appendChild(row);
      });
    } catch (e) {
      listEl.innerHTML = '<div class="muted">Erreur de chargement</div>';
    }
  }

  function hideList() { if (!listEl) return; listEl.classList.add('hidden'); }
  function showList() { if (!listEl) return; listEl.classList.remove('hidden'); }

  // Wire
  if (btnStart) btnStart.addEventListener('click', function (e) { e.preventDefault(); startScanner(); });
  if (btnStop) btnStop.addEventListener('click', function (e) { e.preventDefault(); stopScanner(); });
  if (btnFlash) { btnFlash.disabled = true; btnFlash.addEventListener('click', function (e) { e.preventDefault(); toggleFlash(); }); }
  if (btnList) btnList.addEventListener('click', function (e) { e.preventDefault(); browseDB(); });
  if (fabScan) fabScan.addEventListener('click', function () { if (scanning) stopScanner(); else startScanner(); });
  if (fabList) fabList.addEventListener('click', function () { browseDB(); showSnackbar('Liste'); });
  if (popupClose) popupClose.addEventListener('click', hidePopup);
  if (overlay) overlay.addEventListener('click', hidePopup);

  showMsg('Appuyez sur Démarrer pour scanner');
});
