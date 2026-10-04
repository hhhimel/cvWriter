/* CV Builder — enhance.js
   Layered on top of app.js: theme, CV health, section jump bar, undo/redo,
   multiple saved CVs, preview zoom + page count, shortcuts, and small polish.
   Everything runs locally; nothing is sent anywhere. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const idle = window.requestIdleCallback ? (fn) => requestIdleCallback(fn, { timeout: 600 }) : (fn) => setTimeout(fn, 60);
  const toast = (m, ms) => { if (typeof showToast === 'function') showToast(m, ms); };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const esc2 = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Theme ---------- */
  function currentTheme() {
    return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  $('themeBtn')?.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('cvbuilder_theme', next); } catch (e) { /* ignore */ }
  });

  /* ---------- Accent swatches ---------- */
  const SWATCHES = [
    ['#1c4532', 'Forest'], ['#1f3a5f', 'Navy'], ['#003399', 'EU blue'], ['#0f6b6b', 'Teal'],
    ['#7a1f2b', 'Burgundy'], ['#5b3a8c', 'Plum'], ['#333333', 'Charcoal']
  ];
  const accentInput = $('accentColor');
  const swatchWrap = $('accentSwatches');
  if (accentInput && swatchWrap) {
    SWATCHES.forEach(([hex, name]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.style.background = hex; b.dataset.hex = hex;
      b.title = name; b.setAttribute('aria-label', 'Accent ' + name);
      b.addEventListener('click', () => {
        accentInput.value = hex;
        accentInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      swatchWrap.appendChild(b);
    });
  }
  function syncSwatches() {
    if (!accentInput) return;
    const v = accentInput.value.toLowerCase();
    swatchWrap?.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex === v)));
  }

  /* ---------- CV health ---------- */
  const VERBS = /^(led|lead|managed|built|developed|designed|created|implemented|improved|increased|reduced|delivered|analy[sz]ed|coordinated|conducted|organi[sz]ed|launched|supported|trained|maintained|prepared|assisted|collaborated|researched|established|streamlined|achieved|executed|supervised|monitored|produced|presented|resolved|handled|operated|performed|planned|wrote|taught|mentored|negotiated|generated|optimi[sz]ed|configured|deployed|tested|evaluated|collected|recorded|processed|drove|ran|owned|initiated|redesigned|automated|authored|published|screened|cultivated|surveyed|measured|documented|participated|contributed)\b/i;
  const sectionEl = (key) => (key === 'personal' ? $('sec-personal') : document.querySelector('#sectionsContainer [data-key="' + key + '"]'));

  function analyze(d) {
    const out = [];
    const add = (id, w, state, msg, hint, target) => out.push({ id, w, state, msg, hint, target });
    const email = (d.email || '').trim();
    const digits = (d.mobile || '').replace(/\D/g, '');

    add('name', 10, d.fullName ? 'ok' : 'todo', d.fullName ? 'Name is at the top of your CV' : 'Add your full name', null, 'personal');
    add('email', 10, !email ? 'todo' : (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? 'ok' : 'warn'),
      !email ? 'Add an email address' : (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? 'Email looks valid' : 'That email address looks incomplete'), null, 'personal');
    add('phone', 8, digits.length >= 7 ? 'ok' : (digits.length ? 'warn' : 'todo'),
      digits.length >= 7 ? 'Phone number included' : (digits.length ? 'Phone number looks short' : 'Add a phone number'),
      digits.length >= 7 && !/^\s*\+/.test(d.mobile) ? 'Tip: a country code (+880…) helps employers abroad.' : null, 'personal');

    const obj = (d.objective || '').trim();
    const objState = !obj ? 'todo' : (obj.length < 100 ? 'warn' : (obj.length > 650 ? 'warn' : 'ok'));
    add('objective', 12, objState,
      !obj ? 'Add a short objective or summary' : (obj.length < 100 ? 'Objective is very short — 2–3 sentences read best' : (obj.length > 650 ? 'Objective is long — aim for 2–4 lines' : 'Objective length is just right')),
      null, 'objective');

    const edu = d.education.filter((e) => e.degree || e.institution);
    add('education', 10, edu.length ? 'ok' : 'todo', edu.length ? 'Education listed' : 'Add your education', null, 'education');

    const itCount = (d.itSkills || '').split('\n').filter((x) => x.trim()).length;
    const skillCount = d.skills.filter((s) => s.text).length + itCount;
    add('skills', 8, skillCount >= 5 ? 'ok' : (skillCount ? 'warn' : 'todo'),
      skillCount >= 5 ? skillCount + ' skills listed' : (skillCount ? 'Only ' + skillCount + ' skill' + (skillCount > 1 ? 's' : '') + ' — 5+ helps keyword matching' : 'Add your key skills'),
      null, 'skills');

    const exp = d.experience.filter((e) => e.position || e.company);
    const alt = d.training.filter((t) => t.text).length + d.activities.filter((a) => a.text).length;
    add('experience', 10, exp.length ? 'ok' : (alt ? 'warn' : 'todo'),
      exp.length ? 'Experience listed' : 'Add experience, internships or projects',
      !exp.length && alt ? 'Training and activities are there — a project or internship would strengthen it.' : null, 'experience');

    const lines = [];
    exp.forEach((e) => (e.description || '').split('\n').map((x) => x.trim()).filter(Boolean).forEach((l) => lines.push(l)));
    if (lines.length) {
      const verbLines = lines.filter((l) => VERBS.test(l.replace(/^[\-•–\s]+/, ''))).length;
      const ratio = verbLines / lines.length;
      add('verbs', 8, ratio >= 0.6 ? 'ok' : 'warn',
        ratio >= 0.6 ? 'Bullets start with action verbs' : 'Start more bullets with action verbs',
        ratio >= 0.6 ? null : 'Try Led, Built, Reduced, Organised… instead of “Responsible for”.', 'experience');
      const withNum = lines.filter((l) => /\d/.test(l)).length;
      add('numbers', 6, withNum ? 'ok' : 'warn',
        withNum ? 'Includes measurable results' : 'Add at least one measurable result',
        withNum ? null : 'Numbers, %, team size or scale make achievements concrete.', 'experience');
    }

    const info = window.cvPageInfo;
    if (info && info.contentH > 40) {
      const p = info.pages;
      add('length', 8, p <= 2.05 ? 'ok' : 'warn',
        p <= 1.02 ? 'Fits on one page' : (p <= 2.05 ? 'About ' + Math.min(2, Math.ceil(p - 0.02)) + ' pages — a good length' : 'About ' + p.toFixed(1) + ' pages — most recruiters prefer 1–2'),
        p > 2.05 ? 'Trim older roles or switch to a compact body size.' : null, null);
    }
    return out;
  }

  let lastHealthKey = '';
  function renderHealth(d) {
    const checks = analyze(d);
    const key = JSON.stringify(checks.map((c) => [c.id, c.state, c.msg]));
    if (key === lastHealthKey) return;
    lastHealthKey = key;
    const total = checks.reduce((a, c) => a + c.w, 0) || 1;
    const got = checks.reduce((a, c) => a + c.w * (c.state === 'ok' ? 1 : c.state === 'warn' ? 0.5 : 0), 0);
    const score = Math.round((got / total) * 100);
    const ring = $('healthRing');
    if (ring) {
      ring.style.setProperty('--p', score);
      ring.style.setProperty('--c', score >= 80 ? 'var(--ok)' : score >= 50 ? 'var(--warn)' : 'var(--danger)');
    }
    $('healthScore').textContent = score;
    const open = checks.filter((c) => c.state !== 'ok').length;
    $('healthSummary').textContent = open === 0 ? 'Looking strong — nothing to fix' : open + ' suggestion' + (open > 1 ? 's' : '') + ' to polish';
    const prog = $('cvProgress');
    if (prog) { prog.firstElementChild.style.width = score + '%'; prog.setAttribute('aria-valuenow', score); }
    const order = { todo: 0, warn: 1, ok: 2 };
    const icon = { ok: '✓', warn: '!', todo: '○' };
    $('healthList').innerHTML = checks.slice().sort((a, b) => order[a.state] - order[b.state]).map((c) =>
      '<li><span class="hi ' + c.state + '" aria-hidden="true">' + icon[c.state] + '</span>' +
      '<span class="msg">' + esc2(c.msg) + (c.hint ? '<small>' + esc2(c.hint) + '</small>' : '') + '</span>' +
      (c.target && c.state !== 'ok' ? '<button type="button" class="health-go" data-go="' + c.target + '">Fix</button>' : '') + '</li>'
    ).join('');
  }
  $('healthList')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    goToSection(sectionEl(b.dataset.go), true);
  });

  function goToSection(el, focus) {
    if (!el) return;
    el.classList.remove('collapsed');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (focus) {
      setTimeout(() => {
        const f = el.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]), textarea');
        if (f) f.focus({ preventScroll: true });
      }, 350);
    }
  }

  /* ---------- Jump nav ---------- */
  const jump = $('jumpNav');
  let jumpSig = '';
  function buildJump() {
    if (!jump) return;
    const items = [];
    const t = $('sec-template'); if (t) items.push([t, 'Template']);
    const p = $('sec-personal'); if (p) items.push([p, 'Personal']);
    document.querySelectorAll('#sectionsContainer > .section:not(.is-hidden-from-cv)').forEach((el) => {
      const h = el.querySelector('.heading-display');
      items.push([el, (h ? h.textContent : el.dataset.key || 'Section').trim()]);
    });
    const dec = $('includeDeclaration')?.closest('.section');
    if (dec) items.push([dec, 'Declaration']);
    const sig = items.map((i) => i[1]).join('|');
    if (sig === jumpSig) return;
    jumpSig = sig;
    jump.innerHTML = '';
    items.forEach(([el, label]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'jump-chip'; b.textContent = label;
      b._target = el;
      b.addEventListener('click', () => goToSection(el, false));
      jump.appendChild(b);
    });
    markActive();
  }
  let activeRaf = 0;
  function markActive() {
    if (!jump) return;
    cancelAnimationFrame(activeRaf);
    activeRaf = requestAnimationFrame(() => {
      const chips = Array.from(jump.children);
      let cur = null;
      chips.forEach((c) => { if (c._target && c._target.getBoundingClientRect().top <= 150) cur = c; });
      chips.forEach((c) => c.classList.toggle('active', c === cur));
      if (cur) {
        const left = cur.offsetLeft - jump.clientWidth / 2 + cur.offsetWidth / 2;
        if (Math.abs(jump.scrollLeft - left) > 40) jump.scrollTo({ left, behavior: 'smooth' });
      }
    });
  }
  window.addEventListener('scroll', markActive, { passive: true });

  /* ---------- Preview: page badge + zoom ---------- */
  function updateBadge() {
    const el = $('pageBadge'); const info = window.cvPageInfo;
    if (!el || !info) return;
    if (info.contentH < 30) { el.textContent = '—'; el.classList.remove('warn'); return; }
    const p = info.pages;
    el.textContent = p <= 1 ? '1 page · ' + Math.max(1, Math.round(p * 100)) + '% full' : '≈ ' + p.toFixed(1) + ' pages';
    el.classList.toggle('warn', p > 2.05);
  }
  const reframe = () => { if (typeof updatePrintPageFrame === 'function') { updatePrintPageFrame(); updateBadge(); } };
  $('zoomIn')?.addEventListener('click', () => { window.cvZoom = Math.min(2, (window.cvPageInfo?.scale || 1) + 0.1); reframe(); });
  $('zoomOut')?.addEventListener('click', () => { window.cvZoom = Math.max(0.3, (window.cvPageInfo?.scale || 1) - 0.1); reframe(); });
  $('zoomFit')?.addEventListener('click', () => { window.cvZoom = 'fit'; reframe(); });
  const scrollBox = document.querySelector('.print-layout-scroll');
  if (scrollBox && 'ResizeObserver' in window) {
    let lastW = 0;
    new ResizeObserver(() => {
      const w = scrollBox.clientWidth;
      if (w !== lastW) { lastW = w; if (window.cvZoom === 'fit') requestAnimationFrame(reframe); }
    }).observe(scrollBox);
  }

  /* ---------- Render hook ---------- */
  document.addEventListener('cv:render', (ev) => {
    updateBadge();
    syncSwatches();
    idle(() => { buildJump(); renderHealth(ev.detail.data); });
  });

  /* ---------- Undo / redo ---------- */
  const hist = { stack: [], idx: -1, lock: false };
  const snap = () => { const d = collectData(); delete d.photo; delete d.signature; return JSON.stringify(d); };
  function syncHistBtns() {
    const u = $('undoBtn'), r = $('redoBtn');
    if (u) u.disabled = hist.idx <= 0;
    if (r) r.disabled = hist.idx >= hist.stack.length - 1;
  }
  function pushHist() {
    if (hist.lock) return;
    const s = snap();
    if (hist.stack[hist.idx] === s) return;
    hist.stack.length = hist.idx + 1;
    hist.stack.push(s);
    if (hist.stack.length > 60) hist.stack.shift();
    hist.idx = hist.stack.length - 1;
    syncHistBtns();
  }
  const pushSoon = debounce(pushHist, 700);
  function stepHist(dir) {
    const n = hist.idx + dir;
    if (n < 0 || n >= hist.stack.length) return;
    hist.lock = true;
    try {
      const d = JSON.parse(hist.stack[n]);
      d.photo = null; d.signature = null;
      hist.idx = n;
      applyData(d, { skipPhoto: true });
      renderPreview();
      hist.stack[n] = snap();
      if (typeof scheduleDraftSave === 'function') scheduleDraftSave();
    } finally { hist.lock = false; }
    syncHistBtns();
  }
  $('undoBtn')?.addEventListener('click', () => { pushHist(); stepHist(-1); });
  $('redoBtn')?.addEventListener('click', () => stepHist(1));
  const form = $('cvForm');
  ['input', 'change', 'click', 'drop'].forEach((evn) => form.addEventListener(evn, pushSoon));

  /* ---------- My CVs (profiles) ---------- */
  const PKEY = 'cvbuilder_profiles_v1';
  const readProfiles = () => { try { return JSON.parse(localStorage.getItem(PKEY)) || []; } catch (e) { return []; } };
  const writeProfiles = (arr) => { try { localStorage.setItem(PKEY, JSON.stringify(arr)); return true; } catch (e) { toast('Browser storage is full — use Export JSON instead.', 4500); return false; } };
  const dlg = $('profilesDialog');
  const fmtWhen = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function renderProfiles() {
    const list = $('profileList');
    const arr = readProfiles().sort((a, b) => (a.id === 'backup') - (b.id === 'backup') || b.updated - a.updated);
    if (!arr.length) { list.innerHTML = '<li class="profile-empty">No saved CVs yet. Name this one and press “Save current”.</li>'; return; }
    list.innerHTML = arr.map((p) =>
      '<li class="profile-item" data-id="' + esc2(p.id) + '"><div class="pi-main"><div class="pi-name">' + esc2(p.name) + '</div>' +
      '<div class="pi-meta">' + (p.id === 'backup' ? 'Automatic copy of what you had before the last switch · ' : '') + fmtWhen(p.updated) + '</div></div>' +
      '<div class="pi-actions"><button type="button" class="link-btn" data-act="open">Open</button>' +
      (p.id === 'backup' ? '' : '<button type="button" class="link-btn" data-act="update">Update</button>') +
      '<button type="button" class="link-btn danger" data-act="delete">Delete</button></div></li>'
    ).join('');
  }
  function currentFull() { return collectData(); }
  function saveBackup() {
    const arr = readProfiles().filter((p) => p.id !== 'backup');
    arr.push({ id: 'backup', name: 'Previous CV (auto-backup)', updated: Date.now(), data: currentFull() });
    writeProfiles(arr);
  }
  function loadProfile(p) {
    saveBackup();
    const d = p.data;
    if (!d.photo && $('photoRemoveBtn')) $('photoRemoveBtn').click();
    if (!d.signature && $('sigRemoveBtn')) $('sigRemoveBtn').click();
    applyData(d);
    renderPreview();
    saveDraft();
    pushHist();
    toast('Opened “' + p.name + '”');
  }
  $('profilesBtn')?.addEventListener('click', () => {
    renderProfiles();
    const nm = $('profileName'); if (nm) nm.value = (collectData().fullName ? collectData().fullName + ' — CV' : '');
    dlg.showModal();
  });
  $('profilesClose')?.addEventListener('click', () => dlg.close());
  dlg?.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('profileSave')?.addEventListener('click', () => {
    const name = ($('profileName').value || '').trim() || 'Untitled CV';
    const arr = readProfiles();
    const found = arr.find((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== 'backup');
    if (found) { found.data = currentFull(); found.updated = Date.now(); }
    else arr.push({ id: 'p' + Date.now().toString(36), name, updated: Date.now(), data: currentFull() });
    if (writeProfiles(arr)) { renderProfiles(); toast(found ? 'Updated “' + name + '”' : 'Saved “' + name + '”'); }
  });
  $('profileList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const id = btn.closest('.profile-item').dataset.id;
    const arr = readProfiles();
    const p = arr.find((x) => x.id === id); if (!p) return;
    if (btn.dataset.act === 'open') { loadProfile(p); dlg.close(); }
    else if (btn.dataset.act === 'update') { p.data = currentFull(); p.updated = Date.now(); if (writeProfiles(arr)) { renderProfiles(); toast('Updated “' + p.name + '”'); } }
    else if (btn.dataset.act === 'delete') {
      if (confirm('Delete “' + p.name + '”? This cannot be undone.')) { writeProfiles(arr.filter((x) => x.id !== id)); renderProfiles(); }
    }
  });
  $('profileNew')?.addEventListener('click', () => {
    if (!confirm('Start a blank CV? Your current one is kept under My CVs → “Previous CV (auto-backup)”.')) return;
    saveBackup();
    window.__cvNoFlush = true;
    try { clearTimeout(draftTimer); localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    location.reload();
  });

  /* ---------- Copy as plain text ---------- */
  $('copyTextBtn')?.addEventListener('click', async () => {
    const text = ($('livePreview').innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) { toast('Nothing to copy yet — fill in a few fields first.'); return; }
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) { /* ignore */ } ta.remove();
    }
    toast('CV text copied — paste it into any online form.');
  });

  /* ---------- Entry polish: animate + focus new entries ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    setTimeout(() => {
      const list = $(b.dataset.add + 'List');
      const el = list && list.lastElementChild;
      if (!el || !el.classList.contains('entry')) return;
      el.classList.add('is-new');
      const f = el.querySelector('input:not([type=hidden]), textarea');
      if (f) f.focus({ preventScroll: false });
    }, 0);
  });

  /* ---------- Shortcuts ---------- */
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      const b = $('generateBtn'); if (b && !b.disabled) b.click();
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      $('printBtn')?.click();
    } else if (e.altKey && !mod && e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) $('redoBtn')?.click(); else $('undoBtn')?.click();
    } else if (e.key === 'Escape') {
      const col = $('previewCol');
      if (col && col.classList.contains('is-open')) $('closePreviewBtn')?.click();
    }
  });

  /* ---------- Mobile preview sheet: lock body scroll ---------- */
  const col = $('previewCol');
  if (col) {
    new MutationObserver(() => {
      document.body.classList.toggle('preview-open', col.classList.contains('is-open') && matchMedia('(max-width:980px)').matches);
      if (col.classList.contains('is-open')) requestAnimationFrame(reframe);
    }).observe(col, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- Save button busy state ---------- */
  const gen = $('generateBtn');
  if (gen) new MutationObserver(() => gen.setAttribute('aria-busy', String(gen.disabled))).observe(gen, { attributes: true, attributeFilter: ['disabled'] });

  /* ---------- Safety: flush draft when the tab is hidden ---------- */
  const flush = () => { if (!window.__cvNoFlush && typeof saveDraft === 'function') saveDraft(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('offline', () => toast('You’re offline — everything still works.'));

  /* ---------- Warm the Word library when the browser is idle ---------- */
  window.addEventListener('load', () => setTimeout(() => idle(() => window.loadDocxLib && window.loadDocxLib().catch(() => {})), 1500));

  /* ---------- Init ---------- */
  syncSwatches();
  buildJump();
  setTimeout(() => { pushHist(); updateBadge(); renderHealth(collectData()); }, 0);
})();
