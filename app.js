/* PDF Editor Gratis — semua proses lokal di browser.
   Dependensi CDN: PDF.js (render) + pdf-lib (simpan). */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const $ = (s) => document.querySelector(s);
const fileInput = $('#fileInput'), pagesEl = $('#pages'), dropzone = $('#dropzone');
const hintEl = $('#hint'), statusEl = $('#status');

let pdfDoc = null, pdfBytes = null, fileName = 'dokumen.pdf';
let zoom = 1.0, mode = 'select';
let elements = {};            // { pageNum: [el] } — koordinat dalam poin PDF, y dari ATAS
let detected = {};             // { pageNum: [{x,y,w,h,kind}] } kind: 'box' | 'sig'
let showDetected = false;
let selectedId = null, activeSig = null, activeSigAspect = 0.35;
let sigLocked = false;
let history = [];
let redoStack = [];
let lastSigId = null;
let pageInfo = {};             // { pageNum: {widthPt, heightPt} }

const uid = () => 'el' + Math.random().toString(36).slice(2, 9);
const els = (p) => (elements[p] = elements[p] || []);
const setHint = (t) => { hintEl.textContent = t; };
const setStatus = () => {
  const n = Object.values(elements).reduce((a, b) => a + b.length, 0);
  statusEl.textContent = pdfDoc ? `${pdfDoc.numPages} halaman • ${n} elemen` : '';
};
function updateUndoRedo() {
  $('#btnUndo').disabled = history.length === 0;
  $('#btnRedo').disabled = redoStack.length === 0;
}
function pushHistory() {
  history.push(JSON.stringify(elements));
  if (history.length > 50) history.shift();
  redoStack = []; // langkah baru membatalkan jalur redo
  updateUndoRedo();
}
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/* ---------- Mode & toolbar ---------- */
document.querySelectorAll('.mode').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.mode').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.mode;
    selectedId = null;
    document.querySelectorAll('.overlay').forEach((o) => {
      o.className = 'overlay ' + mode + '-mode';
    });
    renderOverlays();
    if (mode === 'signature' && !activeSig) openSigModal();
    setHint(
      mode === 'text' ? 'Mode Teks: klik di halaman, ketik, lalu klik di luar kotak untuk menyimpan.' :
      mode === 'pencil' ? 'Mode Pensil: seret di halaman untuk menggambar bebas (mis. mencentang manual).' :
      mode === 'signature' ? 'Mode Tanda tangan: klik di halaman untuk menempel tanda tangan. Seret untuk memindah, tarik gagang biru untuk mengubah ukuran.' :
      mode === 'check' ? 'Mode Ceklis: ketuk di kotak oranye (atau dekat kotaknya) — centang otomatis menempel pas di tengah kotak. Ketuk lagi untuk membatalkan. Ketukan jauh dari kotak tidak menambah apa-apa.' :
      'Mode Pilih: klik elemen untuk memilih, seret untuk memindah, tombol Delete untuk menghapus.'
    );
  });
});
$('#widthInput').addEventListener('input', (e) => { $('#widthVal').textContent = e.target.value; });
$('#fontInput').addEventListener('input', (e) => { $('#fontVal').textContent = e.target.value; });
$('#sigSizeInput').addEventListener('input', (e) => {
  if (sigLocked) { setHint('Terkunci: buka kunci dulu untuk mengubah ukuran tanda tangan.'); return; }
  $('#sigSizeVal').textContent = e.target.value;
  // Slider harus selalu punya target: tanda tangan terpilih, atau kalau tidak
  // ada yang terpilih, tanda tangan yang terakhir ditempel.
  let el = findSelected();
  if ((!el || el.type !== 'sig') && lastSigId) {
    for (const p of Object.values(elements)) { const f = p.find((x) => x.id === lastSigId); if (f) { el = f; selectedId = f.id; break; } }
  }
  if (el && el.type === 'sig') { pushHistory(); el.w = +e.target.value; el.h = el.w * el.aspect; renderOverlays(); }
});
function doUndo() {
  if (!history.length) return;
  redoStack.push(JSON.stringify(elements));
  elements = JSON.parse(history.pop());
  selectedId = null; renderOverlays(); setStatus(); updateUndoRedo();
}
function doRedo() {
  if (!redoStack.length) return;
  history.push(JSON.stringify(elements));
  if (history.length > 50) history.shift();
  elements = JSON.parse(redoStack.pop());
  selectedId = null; renderOverlays(); setStatus(); updateUndoRedo();
}
$('#btnUndo').addEventListener('click', doUndo);
$('#btnRedo').addEventListener('click', doRedo);
$('#btnDelete').addEventListener('click', deleteSelected);
document.addEventListener('keydown', (e) => {
  const typing = /TEXTAREA|INPUT/.test(document.activeElement.tagName);
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
  else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); doRedo(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
});
function findSelected() {
  for (const p of Object.values(elements)) for (const el of p) if (el.id === selectedId) return el;
  return null;
}
function deleteSelected() {
  if (sigLocked) { setHint('Terkunci: buka kunci dulu untuk menghapus.'); return; }
  const el = findSelected(); if (!el) return;
  pushHistory();
  elements[el.page] = els(el.page).filter((x) => x.id !== el.id);
  selectedId = null; renderOverlays(); setStatus();
  $('#btnDelete').disabled = true;
}

/* ---------- Buka PDF ---------- */
fileInput.addEventListener('change', (e) => { if (e.target.files[0]) loadPdfFile(e.target.files[0]); });
['dragover', 'dragenter'].forEach((ev) => document.addEventListener(ev, (e) => {
  e.preventDefault(); dropzone.classList.add('drag');
}));
['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => {
  e.preventDefault(); dropzone.classList.remove('drag');
}));
document.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') loadPdfFile(f);
});
async function loadPdfFile(file) {
  try {
    const buf = await file.arrayBuffer();
    pdfBytes = buf.slice(0);
    fileName = file.name.replace(/\.pdf$/i, '');
    pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    elements = {}; detected = {}; history = []; redoStack = []; selectedId = null; lastSigId = null; updateUndoRedo();
    dropzone.style.display = 'none';
    $('#btnDetect').disabled = false; $('#btnDownload').disabled = false;
    setHint('PDF dimuat. Pilih alat di atas, lalu kerjakan langsung di halaman.');
    await renderPages(); setStatus();
  } catch (err) { setHint('Gagal membuka PDF: ' + err.message); }
}

/* ---------- Render halaman ---------- */
async function renderPages() {
  pagesEl.innerHTML = ''; pageInfo = {};
  for (let n = 1; n <= pdfDoc.numPages; n++) {
    const page = await pdfDoc.getPage(n);
    const vp = page.getViewport({ scale: zoom });
    pageInfo[n] = { widthPt: vp.width / zoom, heightPt: vp.height / zoom };
    const wrap = document.createElement('div');
    wrap.className = 'page'; wrap.style.width = vp.width + 'px'; wrap.dataset.page = n;
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width * 1.5); canvas.height = Math.floor(vp.height * 1.5);
    canvas.style.width = vp.width + 'px'; canvas.style.height = vp.height + 'px';
    wrap.appendChild(canvas);
    const overlay = document.createElement('div');
    overlay.className = 'overlay ' + mode + '-mode'; overlay.dataset.page = n;
    wrap.appendChild(overlay);
    pagesEl.appendChild(wrap);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: page.getViewport({ scale: zoom * 1.5 }) }).promise;
    attachOverlay(overlay, n);
  }
  renderOverlays();
}
function renderOverlays() {
  document.querySelectorAll('.page').forEach((wrap) => {
    const n = +wrap.dataset.page, overlay = wrap.querySelector('.overlay');
    overlay.querySelectorAll('.el, .detect-box, .detect-sig').forEach((x) => x.remove());
    if (showDetected) {
      (detected[n] || []).forEach((b) => {
        const d = document.createElement('div');
        d.className = b.kind === 'sig' ? 'detect-sig' : 'detect-box';
        d.style.left = b.x * zoom + 'px'; d.style.top = b.y * zoom + 'px';
        d.style.width = b.w * zoom + 'px'; d.style.height = b.h * zoom + 'px';
        const lab = document.createElement('span');
        lab.className = 'detect-label';
        lab.textContent = b.kind === 'sig' ? 'kolom tanda tangan' : (b.source === 'field' ? 'kotak form' : 'kotak terdeteksi');
        d.appendChild(lab); overlay.appendChild(d);
      });
    }
    els(n).forEach((el) => overlay.appendChild(renderEl(el, n)));
    $('#btnDelete').disabled = !findSelected();
  });
  setStatus();
}
function renderEl(el, pageNum) {
  const s = zoom;
  if (el.type === 'text') {
    const d = document.createElement('div');
    d.className = 'el el-text' + (el.id === selectedId ? ' selected' : '');
    d.dataset.id = el.id;
    d.style.left = el.x * s + 'px'; d.style.top = el.y * s + 'px';
    d.style.fontSize = el.size * s + 'px'; d.style.color = el.color;
    d.style.minWidth = '40px'; d.textContent = el.text;
    return d;
  }
  if (el.type === 'draw' || el.type === 'check') {
    const d = document.createElement('div');
    d.className = 'el' + (el.id === selectedId ? ' selected' : '');
    d.dataset.id = el.id;
    const xs = el.points.map((p) => p[0]), ys = el.points.map((p) => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
    d.style.left = minX * s + 'px'; d.style.top = minY * s + 'px';
    d.style.width = Math.max(maxX - minX, 4) * s + 'px'; d.style.height = Math.max(maxY - minY, 4) * s + 'px';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    path.setAttribute('points', el.points.map((p) => `${(p[0] - minX) * s},${(p[1] - minY) * s}`).join(' '));
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', el.color);
    path.setAttribute('stroke-width', el.width * s); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path); d.appendChild(svg);
    return d;
  }
  if (el.type === 'sig') {
    const d = document.createElement('div');
    d.className = 'el el-sig' + (el.id === selectedId ? ' selected' : '');
    d.dataset.id = el.id;
    d.style.left = el.x * s + 'px'; d.style.top = el.y * s + 'px';
    d.style.width = el.w * s + 'px'; d.style.height = el.h * s + 'px';
    const img = document.createElement('img'); img.src = el.img; img.draggable = false;
    d.appendChild(img);
    if (el.id === selectedId && !sigLocked) {
      const h = document.createElement('div'); h.className = 'resize-handle'; h.dataset.resize = el.id;
      d.appendChild(h);
    }
    return d;
  }
  return document.createElement('div');
}

/* ---------- Interaksi overlay ---------- */
function pagePoint(overlay, e) {
  const r = overlay.getBoundingClientRect();
  return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
}
function attachOverlay(overlay, pageNum) {
  let drag = null; // {kind, el, dx, dy, startW, startX, startY, moved}
  let tap = null; // tap menunggu pointerup: kalau jari bergeser = scroll, bukan tap
  function elAt(pt) {
    for (const el of els(pageNum)) {
      if (el.type === 'sig') { if (pt.x >= el.x && pt.x <= el.x + el.w && pt.y >= el.y && pt.y <= el.y + el.h) return el; }
      else if (el.type === 'text') { if (pt.x >= el.x && pt.x <= el.x + el.text.length * el.size * 0.6 + 20 && pt.y >= el.y && pt.y <= el.y + el.size * 1.4) return el; }
      else { const xs = el.points.map((p) => p[0]), ys = el.points.map((p) => p[1]);
        if (pt.x >= Math.min(...xs) - 4 && pt.x <= Math.max(...xs) + 4 && pt.y >= Math.min(...ys) - 4 && pt.y <= Math.max(...ys) + 4) return el; }
    }
    return null;
  }
  function doTap(pt) {
    if (mode === 'text') {
      const hit = elAt(pt);
      if (hit) { selectedId = hit.id; renderOverlays(); return; }
      pushHistory();
      const el = { id: uid(), type: 'text', page: pageNum, x: pt.x, y: pt.y, text: '', size: +$('#fontInput').value, color: $('#colorInput').value };
      els(pageNum).push(el);
      renderOverlays();
      const div = overlay.querySelector(`[data-id="${el.id}"]`);
      const ta = document.createElement('textarea');
      ta.value = '';
      ta.style.fontSize = el.size * zoom + 'px'; ta.style.color = el.color;
      div.appendChild(ta); ta.focus();
      const commit = () => {
        el.text = ta.value.trim();
        if (!el.text) elements[pageNum] = els(pageNum).filter((x) => x.id !== el.id);
        renderOverlays(); setStatus();
      };
      ta.addEventListener('blur', commit, { once: true });
      ta.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ta.value = ''; ta.blur(); } });
      return;
    }
    if (mode === 'check') {
      // Aturan baru: HANYA ketukan tepat di kotak terdeteksi yang menambah
      // centang. Ketukan di luar kotak tidak menambah apa-apa, jadi scroll
      // tidak mungkin lagi menabur centang liar di halaman.
      // Snap: ketukan di dekat kotak (radius 14pt, karena kotak form kecil
      // dan ketukan jari tidak presisi) menempel ke kotak terdekat.
      const cands = (detected[pageNum] || []).filter((b) => b.kind === 'box' && pt.x >= b.x - 14 && pt.x <= b.x + b.w + 14 && pt.y >= b.y - 14 && pt.y <= b.y + b.h + 14);
      let box = null, best = 1e9;
      for (const b of cands) { const d = Math.hypot(pt.x - (b.x + b.w / 2), pt.y - (b.y + b.h / 2)); if (d < best) { best = d; box = b; } }
      if (!box) { setHint('Bukan kotak: ketuk di kotak oranye (atau dekat kotaknya) untuk ceklis.'); return; }
      pushHistory();
      const existing = els(pageNum).find((x) => x.type === 'check' && x.boxX === box.x && x.boxY === box.y);
      if (existing) elements[pageNum] = els(pageNum).filter((x) => x.id !== existing.id);
      else {
        // Centang selalu terpusat di tengah kotak, berapa pun bentuk kotaknya.
        const size = Math.min(box.w, box.h), cx = box.x + box.w / 2, cy = box.y + box.h / 2;
        els(pageNum).push({ id: uid(), type: 'check', page: pageNum, x: cx - size / 2, y: cy - size / 2, size, boxX: box.x, boxY: box.y, color: $('#colorInput').value,
          points: [[cx - size * 0.35, cy + size * 0.05], [cx - size * 0.08, cy + size * 0.32], [cx + size * 0.38, cy - size * 0.32]], width: 2.5 });
      }
      renderOverlays(); setStatus();
      return;
    }
    if (mode === 'signature') {
      if (sigLocked) { setHint('Tanda tangan sedang terkunci — matikan kunci di toolbar untuk menempel lagi.'); return; }
      if (!activeSig) { openSigModal(); return; }
      pushHistory();
      const sigField = (detected[pageNum] || []).find((b) => b.kind === 'sig' && pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h);
      let el;
      if (sigField) {
        el = { id: uid(), type: 'sig', page: pageNum, img: activeSig, x: sigField.x, y: sigField.y, w: sigField.w, h: sigField.h, aspect: sigField.h / sigField.w };
      } else {
        const w = +$('#sigSizeInput').value, h = w * activeSigAspect;
        el = { id: uid(), type: 'sig', page: pageNum, img: activeSig, x: pt.x - w / 2, y: pt.y - h / 2, w, h, aspect: activeSigAspect };
      }
      els(pageNum).push(el);
      selectedId = el.id; lastSigId = el.id; // langsung terpilih: slider & gagang langsung bekerja
      renderOverlays(); setStatus();
      return;
    }
  }
  overlay.addEventListener('pointerdown', (e) => {
    if (!pdfDoc) return;
    const pt = pagePoint(overlay, e);
    const targetEl = e.target.closest('.el');
    // Gagang resize berlaku di mode Pilih DAN mode Tanda tangan (tidak saat terkunci).
    if (e.target.dataset.resize) {
      if (sigLocked) return;
      const el = els(pageNum).find((x) => x.id === e.target.dataset.resize);
      if (el) { selectedId = el.id; drag = { kind: 'resize', el, startX: e.clientX, startW: el.w, snapshot: JSON.stringify(elements) }; overlay.style.touchAction = 'none'; try { overlay.setPointerCapture(e.pointerId); } catch (_) {} renderOverlays(); }
      return;
    }
    // Kunci = kunci edit global: saat terkunci, mode apa pun tidak bisa
    // menambah/mengubah apa-apa (teks, pensil, ceklis, tanda tangan).
    // Scroll tetap bisa, memilih elemen tetap bisa.
    if (sigLocked && mode !== 'select') { setHint('Terkunci: buka kunci dulu untuk mengedit (teks, pensil, ceklis, tanda tangan). Scroll tetap bisa.'); return; }
    if (mode === 'select') {
      if (targetEl) {
        const el = els(pageNum).find((x) => x.id === targetEl.dataset.id);
        if (el) {
          selectedId = el.id; renderOverlays();
          if (sigLocked) return; // terkunci: boleh dipilih, tidak boleh digeser
          drag = { kind: 'move', el, dx: pt.x - el.x, dy: pt.y - el.y, moved: false, pending: true, startCX: e.clientX, startCY: e.clientY, snapshot: JSON.stringify(elements) };
          overlay.style.touchAction = 'none'; // cegah browser merebut gestur jadi scroll
        }
        return;
      }
      selectedId = null; renderOverlays(); return;
    }
    if (mode === 'text' || mode === 'check') {
      tap = { pt, cx: e.clientX, cy: e.clientY };
      return;
    }
    if (mode === 'pencil') {
      pushHistory();
      const el = { id: uid(), type: 'draw', page: pageNum, points: [[pt.x, pt.y]], color: $('#colorInput').value, width: +$('#widthInput').value };
      els(pageNum).push(el);
      drag = { kind: 'draw', el, last: pt };
      renderOverlays(); // gambar div coretan sekali, lalu gerakannya di-update di tempat
      overlay.setPointerCapture(e.pointerId);
      return;
    }
    if (mode === 'signature') {
      // Klik tanda tangan yang sudah ada = pilih & geser, bukan menempel baru.
      if (targetEl) {
        const el = els(pageNum).find((x) => x.id === targetEl.dataset.id);
        if (el && el.type === 'sig') {
          selectedId = el.id; renderOverlays();
          if (sigLocked) return;
          drag = { kind: 'move', el, dx: pt.x - el.x, dy: pt.y - el.y, moved: false, pending: true, startCX: e.clientX, startCY: e.clientY, snapshot: JSON.stringify(elements) };
          overlay.style.touchAction = 'none'; // cegah browser merebut gestur jadi scroll
          return;
        }
      }
      tap = { pt, cx: e.clientX, cy: e.clientY };
      return;
    }
  });
  overlay.addEventListener('pointermove', (e) => {
    if (tap && Math.hypot(e.clientX - tap.cx, e.clientY - tap.cy) > 12) tap = null; // jari bergeser = scroll, batalkan tap
    if (!drag) return;
    const pt = pagePoint(overlay, e);
    if (drag.kind === 'move') {
      if (drag.pending) {
        if (Math.hypot(e.clientX - drag.startCX, e.clientY - drag.startCY) < 8) return; // belum benar-benar digeser
        drag.pending = false;
        try { overlay.setPointerCapture(e.pointerId); } catch (_) {}
      }
      drag.el.x = pt.x - drag.dx; drag.el.y = pt.y - drag.dy; drag.moved = true;
      const div = overlay.querySelector(`[data-id="${drag.el.id}"]`);
      if (div) { div.style.left = drag.el.x * zoom + 'px'; div.style.top = drag.el.y * zoom + 'px'; }
    } else if (drag.kind === 'resize') {
      const nw = Math.max(30, drag.startW + (e.clientX - drag.startX) / zoom);
      drag.el.w = nw; drag.el.h = nw * drag.el.aspect;
      const div = overlay.querySelector(`[data-id="${drag.el.id}"]`);
      if (div) { div.style.width = nw * zoom + 'px'; div.style.height = drag.el.h * zoom + 'px'; }
    } else if (drag.kind === 'draw') {
      const last = drag.last;
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 0.5) {
        drag.el.points.push([pt.x, pt.y]); drag.last = pt;
        // Update coretan di tempat (tanpa membangun ulang semua overlay):
        // membangun ulang tiap gerakan bikin goresan patah-patah di HP.
        const el = drag.el;
        const div = overlay.querySelector(`[data-id="${el.id}"]`);
        if (div) {
          const xs = el.points.map((p) => p[0]), ys = el.points.map((p) => p[1]);
          const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
          div.style.left = minX * zoom + 'px'; div.style.top = minY * zoom + 'px';
          div.style.width = Math.max(maxX - minX, 4) * zoom + 'px'; div.style.height = Math.max(maxY - minY, 4) * zoom + 'px';
          const pl = div.querySelector('polyline');
          if (pl) pl.setAttribute('points', el.points.map((p) => `${(p[0] - minX) * zoom},${(p[1] - minY) * zoom}`).join(' '));
        }
      }
    }
  });
  const endDrag = () => {
    if (drag && drag.snapshot) {
      const changed = drag.kind === 'resize' ? drag.el.w !== drag.startW : drag.moved;
      if (changed) {
        history.push(drag.snapshot);
        if (history.length > 50) history.shift();
        redoStack = []; updateUndoRedo();
      }
    }
    if (drag && drag.kind !== 'draw') renderOverlays();
    overlay.style.touchAction = '';
    drag = null;
  };
  overlay.addEventListener('pointerup', () => {
    if (tap) { const t = tap; tap = null; doTap(t.pt); }
    endDrag();
  });
  overlay.addEventListener('pointercancel', () => { tap = null; endDrag(); });
}

/* ---------- Modal tanda tangan ---------- */
const sigModal = $('#sigModal'), sigCanvas = $('#sigCanvas'), sigCtx = sigCanvas.getContext('2d');
let sigDrawing = false, sigTouched = false;
function openSigModal() { sigModal.classList.remove('hidden'); }
$('#btnSigPad').addEventListener('click', openSigModal);
$('#btnSigLock').addEventListener('click', () => {
  sigLocked = !sigLocked;
  $('#btnSigLock').textContent = sigLocked ? '🔒 Terkunci' : '🔓 Kunci';
  setHint(sigLocked ? 'TERKUNCI: semua edit dimatikan (teks, pensil, ceklis, tanda tangan, geser, ubah ukuran). Scroll tetap bisa. Buka kunci untuk mengedit lagi.' : 'Kunci dibuka: semua alat bisa dipakai lagi.');
  renderOverlays();
});
function nudgeSig(dx, dy) {
  if (sigLocked) { setHint('Terkunci: buka kunci dulu untuk menggeser tanda tangan.'); return; }
  let el = findSelected();
  if ((!el || el.type !== 'sig') && lastSigId) {
    for (const p of Object.values(elements)) { const f = p.find((x) => x.id === lastSigId); if (f) { el = f; selectedId = f.id; break; } }
  }
  if (!el || el.type !== 'sig') { setHint('Pilih tanda tangan dulu (mode Pilih, ketuk tanda tangannya), lalu pakai tombol arah.'); return; }
  pushHistory(); el.x += dx; el.y += dy; renderOverlays(); setStatus();
}
$('#btnNudgeLeft').addEventListener('click', () => nudgeSig(-6, 0));
$('#btnNudgeRight').addEventListener('click', () => nudgeSig(6, 0));
$('#btnNudgeUp').addEventListener('click', () => nudgeSig(0, -6));
$('#btnNudgeDown').addEventListener('click', () => nudgeSig(0, 6));
$('#btnSigClose').addEventListener('click', () => sigModal.classList.add('hidden'));
$('#btnSigClear').addEventListener('click', () => { sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); sigTouched = false; });
function sigPos(e) {
  const r = sigCanvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * sigCanvas.width / r.width, y: (e.clientY - r.top) * sigCanvas.height / r.height };
}
sigCanvas.addEventListener('pointerdown', (e) => { sigDrawing = true; sigTouched = true; const p = sigPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); sigCanvas.setPointerCapture(e.pointerId); });
sigCanvas.addEventListener('pointermove', (e) => {
  if (!sigDrawing) return;
  const p = sigPos(e); sigCtx.lineTo(p.x, p.y);
  sigCtx.strokeStyle = '#000'; sigCtx.lineWidth = 2.5; sigCtx.lineCap = 'round'; sigCtx.stroke();
});
['pointerup', 'pointercancel'].forEach((ev) => sigCanvas.addEventListener(ev, () => { sigDrawing = false; }));
$('#sigFileInput').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
      const sc = Math.min(sigCanvas.width / img.width, sigCanvas.height / img.height);
      sigCtx.drawImage(img, (sigCanvas.width - img.width * sc) / 2, (sigCanvas.height - img.height * sc) / 2, img.width * sc, img.height * sc);
      sigTouched = true;
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
});
$('#btnSigUse').addEventListener('click', () => {
  if (!sigTouched) { setHint('Gambar dulu tanda tanganmu, atau unggah gambar tanda tangan.'); return; }
  setActiveSig(sigCanvas.toDataURL('image/png'));
  sigModal.classList.add('hidden');
  setHint('Tanda tangan aktif. Klik di halaman untuk menempelkannya; seret untuk memindah, tarik gagang biru untuk mengubah ukuran.');
});
function setActiveSig(dataUrl) {
  activeSig = dataUrl;
  const img = new Image();
  img.onload = () => { activeSigAspect = img.height / img.width; };
  img.src = dataUrl;
  $('#sigPreview').src = dataUrl; $('#sigPreviewWrap').hidden = false;
}

/* ---------- Zoom ---------- */
function setZoom(z) {
  zoom = Math.min(3, Math.max(0.5, z));
  $('#zoomVal').textContent = Math.round(zoom * 100) + '%';
  if (pdfDoc) renderPages();
}
$('#zoomIn').addEventListener('click', () => setZoom(zoom * 1.25));
$('#zoomOut').addEventListener('click', () => setZoom(zoom / 1.25));

/* ---------- Deteksi kotak ceklis & kolom tanda tangan ---------- */
$('#btnDetect').addEventListener('click', async () => {
  if (showDetected) { showDetected = false; renderOverlays(); setHint('Sorotan deteksi disembunyikan.'); return; }
  setHint('Mendeteksi kotak & field, mohon tunggu…');
  detected = {};
  for (let n = 1; n <= pdfDoc.numPages; n++) {
    const page = await pdfDoc.getPage(n);
    const { widthPt, heightPt } = pageInfo[n];
    const boxes = [];
    // 1) Field form asli (paling akurat): widget checkbox & kolom tanda tangan.
    try {
      const annots = await page.getAnnotations();
      for (const a of annots) {
        if (a.subtype !== 'Widget' || !a.rect) continue;
        const [x1, y1, x2, y2] = a.rect;
        const w = x2 - x1, h = y2 - y1;
        if (w < 4 || h < 4 || w > 200 || h > 200) continue;
        if (a.fieldType === 'Btn') boxes.push({ x: x1, y: heightPt - y2, w, h, kind: 'box', source: 'field' });
        else if (a.fieldType === 'Sig') boxes.push({ x: x1, y: heightPt - y2, w, h, kind: 'sig', source: 'field' });
      }
    } catch (err) { /* dokumen tanpa anotasi: lanjut ke deteksi visual */ }
    // 2) Deteksi visual: kotak kosong bergaris di hasil render (untuk form hasil cetak/flatten).
    try {
      const scale = 1.5;
      const vp = page.getViewport({ scale });
      const cv = document.createElement('canvas');
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const W = cv.width, H = cv.height;
      const dark = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        dark[i] = (img[o] < 110 && img[o + 1] < 110 && img[o + 2] < 110 && img[o + 3] > 180) ? 1 : 0;
      }
      const seen = new Uint8Array(W * H);
      const stack = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = y * W + x;
          if (!dark[idx] || seen[idx]) continue;
          let minX = x, maxX = x, minY = y, maxY = y, count = 0;
          stack.push(idx); seen[idx] = 1;
          while (stack.length) {
            const c = stack.pop(); count++;
            const cx = c % W, cy = Math.floor(c / W);
            if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
            const nb = [c - 1, c + 1, c - W, c + W];
            for (const n2 of nb) {
              if (n2 >= 0 && n2 < W * H && dark[n2] && !seen[n2]) { seen[n2] = 1; stack.push(n2); }
            }
          }
          const bw = maxX - minX + 1, bh = maxY - minY + 1;
          if (bw < 12 || bw > 48 || bh < 12 || bh > 48) continue;
          const ar = bw / bh; if (ar < 0.7 || ar > 1.43) continue;
          let per = 0, perTot = 0;
          for (let px = minX; px <= maxX; px++) { perTot += 2; if (dark[minY * W + px]) per++; if (dark[maxY * W + px]) per++; }
          for (let py = minY; py <= maxY; py++) { perTot += 2; if (dark[py * W + minX]) per++; if (dark[py * W + maxX]) per++; }
          if (per / perTot < 0.55) continue;
          let inside = 0, insideTot = 0;
          for (let py = minY + 2; py <= maxY - 2; py++) for (let px = minX + 2; px <= maxX - 2; px++) { insideTot++; if (dark[py * W + px]) inside++; }
          if (insideTot && inside / insideTot > 0.35) continue;
          const box = { x: minX / scale, y: minY / scale, w: bw / scale, h: bh / scale, kind: 'box', source: 'visual' };
          const dup = boxes.some((b) => {
            const ix = Math.max(0, Math.min(b.x + b.w, box.x + box.w) - Math.max(b.x, box.x));
            const iy = Math.max(0, Math.min(b.y + b.h, box.y + box.h) - Math.max(b.y, box.y));
            return ix * iy > 0.3 * Math.min(b.w * b.h, box.w * box.h);
          });
          if (!dup) boxes.push(box);
        }
      }
    } catch (err) { /* deteksi visual gagal: pakai hasil field saja */ }
    detected[n] = boxes;
  }
  showDetected = true; renderOverlays();
  const nb = Object.values(detected).reduce((a, b) => a + b.filter((x) => x.kind === 'box').length, 0);
  const ns = Object.values(detected).reduce((a, b) => a + b.filter((x) => x.kind === 'sig').length, 0);
  setHint(`Terdeteksi ${nb} kotak ceklis dan ${ns} kolom tanda tangan (oranye = kotak, ungu = kolom tanda tangan). Pindah ke mode Ceklis lalu ketuk kotaknya, atau ke mode Tanda tangan lalu klik kolom ungu.`);
});

/* ---------- Simpan PDF ---------- */
$('#btnDownload').addEventListener('click', async () => {
  try {
    setHint('Menyimpan PDF…');
    const doc = await PDFLib.PDFDocument.load(pdfBytes);
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const page = doc.getPage(n - 1);
      const ph = page.getHeight();
      for (const el of els(n)) {
        if (el.type === 'text') {
          page.drawText(el.text, { x: el.x, y: ph - el.y - el.size * 0.85, size: el.size, font: await doc.embedFont(PDFLib.StandardFonts.Helvetica), color: PDFLib.rgb(...Object.values(hexRgb(el.color))) });
        } else if (el.type === 'draw') {
          const c = hexRgb(el.color);
          for (let i = 0; i + 1 < el.points.length; i++) {
            page.drawLine({ start: { x: el.points[i][0], y: ph - el.points[i][1] }, end: { x: el.points[i + 1][0], y: ph - el.points[i + 1][1] }, thickness: el.width, color: PDFLib.rgb(c.r, c.g, c.b), opacity: 1 });
          }
        } else if (el.type === 'check') {
          const c = hexRgb(el.color);
          for (let i = 0; i + 1 < el.points.length; i++) {
            page.drawLine({ start: { x: el.points[i][0], y: ph - el.points[i][1] }, end: { x: el.points[i + 1][0], y: ph - el.points[i + 1][1] }, thickness: el.width, color: PDFLib.rgb(c.r, c.g, c.b), opacity: 1 });
          }
        } else if (el.type === 'sig') {
          let img;
          if (el.img.startsWith('data:image/jpeg')) img = await doc.embedJpg(el.img);
          else img = await doc.embedPng(el.img);
          page.drawImage(img, { x: el.x, y: ph - el.y - el.h, width: el.w, height: el.h });
        }
      }
    }
    const out = await doc.save();
    const blob = new Blob([out], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName + '-edited.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setHint('PDF hasil edit berhasil diunduh: ' + fileName + '-edited.pdf');
  } catch (err) { setHint('Gagal menyimpan PDF: ' + err.message); }
});
