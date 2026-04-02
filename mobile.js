document.addEventListener('DOMContentLoaded', function(){
  const qrRegionId = 'qr-reader';
  const resultEl = document.getElementById('scan-result');
  const detailEl = document.getElementById('pc-detail');
  const listEl = document.getElementById('pc-list');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnBrowse = document.getElementById('btn-browse');

  let html5QrCode = null;
  let scanning = false;

  function showMessage(msg) {
    if (resultEl) resultEl.textContent = msg;
  }

  function displayPC(pc) {
    if (!detailEl) return;
    detailEl.innerHTML = '';
    const out = document.createElement('div');
    out.className = 'pc-item';
    out.innerHTML = `
      <div style="flex:1">
        <div class="meta"><strong>${escapeHtml(pc.cpu || '')}</strong></div>
        <div class="meta">${escapeHtml(pc.brand || '')} • ${escapeHtml(pc.gpu || '')}</div>
        <div class="meta">${escapeHtml(pc.storage || '')} • ${escapeHtml(pc.ram || '')} • ${escapeHtml(pc.os || '')}</div>
      </div>
    `;
    detailEl.appendChild(out);
  }

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function fetchPCById(id) {
    try {
      const res = await fetch('api.php?id=' + encodeURIComponent(id), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Not found');
      const pc = await res.json();
      return pc;
    } catch (e) { return null; }
  }

  async function fetchPCByIndex(idx) {
    try {
      const res = await fetch('api.php?index=' + encodeURIComponent(idx), { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Not found');
      const pc = await res.json();
      return pc;
    } catch (e) { return null; }
  }

  async function handleScan(text) {
    showMessage('Scanné: ' + text);
    // parse possible prefix
    let raw = (text || '').trim();
    let numeric = raw.match(/^(?:id:|index:)?\s*(\d+)$/i);
    if (numeric) {
      const val = numeric[1];
      // try id then index
      const byId = await fetchPCById(val);
      if (byId) { displayPC(byId); return; }
      const byIdx = await fetchPCByIndex(val);
      if (byIdx) { displayPC(byIdx); return; }
      showMessage('Aucun PC trouvé pour ' + val);
      return;
    }

    // fallback: treat whole payload as index if it's a small number
    const asNum = parseInt(raw,10);
    if (!isNaN(asNum)) {
      const byIdx = await fetchPCByIndex(asNum);
      if (byIdx) { displayPC(byIdx); return; }
    }

    showMessage('QR non reconnu');
  }

  function startScanner() {
    if (scanning) return;
    if (typeof Html5Qrcode === 'undefined') { showMessage('Lecteur QR non disponible'); return; }
    html5QrCode = new Html5Qrcode(qrRegionId);
    Html5Qrcode.getCameras().then(cameras => {
      if (!cameras || cameras.length === 0) { showMessage('Aucune caméra détectée'); return; }
      const camId = cameras[0].id;
      const config = { fps: 10, qrbox: { width: 280, height: 200 } };
      html5QrCode.start(camId, config, (decodedText, decodedResult) => {
        // on success
        handleScan(decodedText);
        // stop after first detection
        stopScanner();
      }, (errorMessage) => {
        // ignore
      }).then(() => { scanning = true; showMessage('Scan en cours...'); }).catch(err => { showMessage('Erreur caméra: ' + err); });
    }).catch(err => { showMessage('Impossible d\'accéder à la caméra'); });
  }

  function stopScanner() {
    if (!scanning || !html5QrCode) return;
    html5QrCode.stop().then(() => {
      scanning = false; showMessage('Scanner arrêté');
      html5QrCode.clear();
      html5QrCode = null;
    }).catch(() => { scanning = false; html5QrCode = null; showMessage('Impossible d\'arrêter le scanner'); });
  }

  async function browseDB(){
    listEl.classList.remove('hidden');
    detailEl.innerHTML = '';
    listEl.innerHTML = '<div class="muted">Chargement…</div>';
    try {
      const res = await fetch('api.php', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Erreur');
      const arr = await res.json();
      if (!Array.isArray(arr) || arr.length === 0) { listEl.innerHTML = '<div class="muted">Aucun PC</div>'; return; }
      listEl.innerHTML = '';
      arr.forEach((pc, i) => {
        const row = document.createElement('div');
        row.className = 'pc-item';
        row.innerHTML = `<div style="flex:1"><div><strong>${escapeHtml(pc.cpu||'(vide)')}</strong></div><div class="meta">${escapeHtml(pc.brand||'')} • ${escapeHtml(pc.gpu||'')}</div><div class="meta">#${i} (id:${escapeHtml(pc.id||'')})</div></div>`;
        row.addEventListener('click', () => { displayPC(pc); window.scrollTo({top:0,behavior:'smooth'}); });
        listEl.appendChild(row);
      });
    } catch (e) {
      listEl.innerHTML = '<div class="muted">Erreur en chargeant la base</div>';
    }
  }

  // wire buttons
  if (btnStart) btnStart.addEventListener('click', (e)=>{ e.preventDefault(); startScanner(); });
  if (btnStop) btnStop.addEventListener('click', (e)=>{ e.preventDefault(); stopScanner(); });
  if (btnBrowse) btnBrowse.addEventListener('click', (e)=>{ e.preventDefault(); browseDB(); });

  // auto-start
  startScanner();
});
