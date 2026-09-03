/* ============================================================
   Jotter — app logic
   Vanilla JS, zero dependencies. Notes persist to localStorage
   (with an in-memory fallback for sandboxed previews).
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- tiny helpers ---------------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; });
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function fmtDate(ts) {
    if (!ts) return '';
    var d = new Date(ts), now = new Date();
    var time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'Today ' + time;
    var y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday ' + time;
    var opts = d.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString([], opts);
  }

  /* ---------------- icons (inline SVG, feather-style) ---------------- */
  function svg(inner, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var ICONS = {
    book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', 20),
    bookBig: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', 40),
    plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    filePlus: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    search: svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', 16),
    file: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>', 15),
    star: svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
    starFill: svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/>'),
    starS: svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/>', 13),
    pin: svg('<path d="M12 17v5"/><path d="M9 4h6"/><path d="M15 4v5.5l3.7 5.5H5.3L9 9.5V4"/>'),
    pinS: svg('<path d="M12 17v5"/><path d="M9 4h6"/><path d="M15 4v5.5l3.7 5.5H5.3L9 9.5V4"/>', 13),
    trash: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 15),
    trashS: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 13),
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
    upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    printer: svg('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    more: svg('<circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/><circle cx="5" cy="12" r="1.6"/>'),
    sun: svg('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'),
    moon: svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
    menu: svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'),
    copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    undo: svg('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>', 14),
    undoS: svg('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>', 13),
    x: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    xS: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 11)
  };

  /* ---------------- storage (localStorage w/ fallback) ---------------- */
  var MEM = {};
  var persistent = true;
  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); }
      catch (e) { persistent = false; return Object.prototype.hasOwnProperty.call(MEM, key) ? MEM[key] : null; }
    },
    set: function (key, val) {
      try { window.localStorage.setItem(key, val); }
      catch (e) { persistent = false; MEM[key] = val; }
    }
  };

  var NOTES_KEY = 'jotter.notes.v1';
  var SETTINGS_KEY = 'jotter.settings.v1';

  /* ---------------- state ---------------- */
  var notes = [];
  var settings = { theme: null, sort: 'updated', view: 'split', lastId: null };
  var ui = { activeId: null, search: '', tag: null, trash: false };
  var dirty = false;
  var purgeArm = { id: null, t: null };

  /* ---------------- dom refs ---------------- */
  var sidebar = $('#sidebar'), overlay = $('#overlay'), toastEl = $('#toast');
  var notesList = $('#notesList'), tagFilters = $('#tagFilters'), searchInput = $('#searchInput'), sortSelect = $('#sortSelect');
  var newNoteBtn = $('#newNoteBtn'), dailyBtn = $('#dailyBtn'), themeBtn = $('#themeBtn');
  var notesViewBtn = $('#notesViewBtn'), trashViewBtn = $('#trashViewBtn'), trashCount = $('#trashCount');
  var exportAllBtn = $('#exportAllBtn'), importBtn = $('#importBtn'), importFile = $('#importFile');
  var storageNote = $('#storageNote'), emptyTrashBtn = $('#emptyTrashBtn');
  var emptyState = $('#emptyState'), emptyTitle = $('#emptyTitle'), emptyText = $('#emptyText');
  var emptyNewBtn = $('#emptyNewBtn'), emptyDailyBtn = $('#emptyDailyBtn'), clearFiltersBtn = $('#clearFiltersBtn');
  var editor = $('#editor'), trashBanner = $('#trashBanner'), restoreBtn = $('#restoreBtn'), deleteForeverBtn = $('#deleteForeverBtn');
  var sidebarToggle = $('#sidebarToggle'), viewSeg = $('#viewSeg');
  var starBtn = $('#starBtn'), pinBtn = $('#pinBtn'), downloadNoteBtn = $('#downloadNoteBtn'), printBtn = $('#printBtn');
  var noteMenuBtn = $('#noteMenuBtn'), noteMenu = $('#noteMenu'), duplicateBtn = $('#duplicateBtn');
  var copyMdBtn = $('#copyMdBtn'), trashCurrentBtn = $('#trashCurrentBtn');
  var titleInput = $('#titleInput'), chips = $('#chips'), tagInput = $('#tagInput');
  var panes = $('#panes'), editorArea = $('#editorArea'), previewArea = $('#previewArea');
  var statsInfo = $('#statsInfo'), saveStatus = $('#saveStatus');

  /* ---------------- data helpers ---------------- */
  function getNote(id) {
    for (var i = 0; i < notes.length; i++) if (notes[i].id === id) return notes[i];
    return null;
  }

  function normalizeNote(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var tags = Array.isArray(raw.tags)
      ? raw.tags.filter(function (t) { return typeof t === 'string' && t.trim(); }).map(function (t) { return t.trim().slice(0, 24); })
      : [];
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : '',
      body: typeof raw.body === 'string' ? raw.body : '',
      tags: tags,
      pinned: !!raw.pinned,
      starred: !!raw.starred,
      createdAt: +raw.createdAt || Date.now(),
      updatedAt: +raw.updatedAt || +raw.createdAt || Date.now(),
      deleted: !!raw.deleted,
      deletedAt: +raw.deletedAt || null
    };
  }

  function persist() { store.set(NOTES_KEY, JSON.stringify(notes)); }
  function persistSettings() { store.set(SETTINGS_KEY, JSON.stringify(settings)); }

  var WELCOME_BODY = [
    '# Welcome to Jotter \uD83D\uDC4B',
    '',
    'Jotter is a **fast, private, markdown-powered** notebook & journal. Everything is stored **in your browser** \u2014 no account, no server, no tracking.',
    '',
    '## \u2705 Try me',
    '',
    '- [x] Click this checkbox in **Preview** or **Split** view \u2014 it updates the markdown source too',
    '- [ ] Write your first thought below',
    '- Press **Ctrl E** to cycle Edit \u2192 Split \u2192 Preview',
    '',
    '## \uD83C\uDFA8 Formatting',
    '',
    '| Syntax | Result |',
    '| --- | --- |',
    '| `**bold**` | **bold** |',
    '| `*italic*` | *italic* |',
    '| `~~strikethrough~~` | ~~strikethrough~~ |',
    '| `[link](https://example.com)` | [link](https://example.com) |',
    '',
    '> Blockquotes are great for capturing memorable lines.',
    '',
    '## \uD83D\uDCBB Code',
    '',
    '```js',
    'const idea = "Write it down before it escapes.";',
    'console.log(idea);',
    '```',
    '',
    '## \uD83D\uDDC2 Organise',
    '',
    '- Add **tags** with the chips above the editor, then filter by them in the sidebar',
    '- **Pin** \uD83D\uDCCC or **star** \u2B50 notes to keep the important ones on top',
    '- Use **Today\u2019s journal** for a dated daily entry, pre-filled with a template',
    '',
    '## \uD83D\uDD12 Your data',
    '',
    '- Notes live in this browser\u2019s local storage \u2014 use **Backup** in the sidebar to export them any time',
    '- **Restore** merges a backup file back in; the newest edit always wins',
    '',
    '---',
    '',
    '\uD83D\uDCA1 Tip: press **N** to start a new note, **/** to search, and **Ctrl Alt N** from anywhere.'
  ].join('\n');

  function seed() {
    notes = [{
      id: uid(),
      title: 'Welcome to Jotter',
      body: WELCOME_BODY,
      tags: ['getting-started'],
      pinned: true,
      starred: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deleted: false,
      deletedAt: null
    }];
    persist();
  }

  function purgeOldTrash() {
    var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    var before = notes.length;
    notes = notes.filter(function (n) { return !(n.deleted && n.deletedAt && n.deletedAt < cutoff); });
    if (notes.length !== before) persist();
  }

  function load() {
    var raw = store.get(NOTES_KEY);
    if (raw !== null) {
      try {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          notes = arr.map(normalizeNote).filter(Boolean);
        }
      } catch (e) { /* corrupt — fall through */ }
    }
    if (raw === null && !notes.length) seed();
    var s = store.get(SETTINGS_KEY);
    if (s) { try { var so = JSON.parse(s); for (var k in so) if (k in settings) settings[k] = so[k]; } catch (e) {} }
    purgeOldTrash();
  }

  /* ---------------- queries ---------------- */
  function visibleNotes() {
    var list = notes.filter(function (n) { return !!n.deleted === ui.trash; });
    var q = ui.search.trim().toLowerCase();
    if (q) {
      list = list.filter(function (n) {
        return (n.title + '\n' + n.body + ' ' + n.tags.join(' ')).toLowerCase().indexOf(q) !== -1;
      });
    }
    if (!ui.trash && ui.tag) list = list.filter(function (n) { return n.tags.indexOf(ui.tag) !== -1; });

    if (ui.trash) {
      return list.sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); });
    }
    var sorters = {
      updated: function (a, b) { return b.updatedAt - a.updatedAt; },
      created: function (a, b) { return b.createdAt - a.createdAt; },
      title: function (a, b) { return (a.title || 'Untitled').localeCompare(b.title || 'Untitled'); }
    };
    var srt = sorters[settings.sort] || sorters.updated;
    return list.sort(function (a, b) { return (b.pinned - a.pinned) || srt(a, b); });
  }

  function snippet(n) {
    var s = String(n.body || '');
    s = s.replace(/```[\s\S]*?```/g, ' ');
    s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    s = s.replace(/^\s*&gt;\s?/gm, '');
    s = s.replace(/^(\s*)([-*+]|\d{1,9}[.)])\s+(\[[ xX]\]\s+)?/gm, '$1');
    s = s.replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, '');
    s = s.replace(/\[\s?[xX ]?\s?\]/g, '');
    s = s.replace(/[*_~`]/g, '');
    s = s.replace(/\s+/g, ' ').trim();
    var title = (n.title || '').trim().toLowerCase();
    if (title && s.toLowerCase().indexOf(title) === 0) s = s.slice(title.length).replace(/^[\s\-–—:.,]+/, '');
    return s.slice(0, 130);
  }

  /* ---------------- rendering ---------------- */
  function renderAll() { renderSidebar(); renderEditor(); updateStorageNote(); }

  function renderSidebar() {
    sortSelect.value = settings.sort;
    notesViewBtn.classList.toggle('active', !ui.trash);
    trashViewBtn.classList.toggle('active', ui.trash);
    var trashed = notes.filter(function (n) { return n.deleted; }).length;
    trashCount.textContent = trashed > 0 ? String(trashed) : '';
    trashCount.hidden = trashed === 0;
    emptyTrashBtn.hidden = !(ui.trash && trashed > 0);
    renderTagFilters();
    renderNotesList();
  }

  function renderTagFilters() {
    if (ui.trash) { tagFilters.innerHTML = ''; return; }
    var counts = {};
    notes.forEach(function (n) {
      if (n.deleted) return;
      n.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    var entries = Object.keys(counts).sort(function (a, b) {
      return (counts[b] - counts[a]) || a.localeCompare(b);
    }).slice(0, 18);
    if (ui.tag && entries.indexOf(ui.tag) === -1) entries.unshift(ui.tag);
    tagFilters.innerHTML = entries.map(function (t) {
      var active = ui.tag === t;
      return '<button class="tag-chip' + (active ? ' active' : '') + '" data-tag="' + escapeHtml(t) + '">' +
        '#' + escapeHtml(t) + '<span class="tag-count">' + counts[t] + '</span></button>';
    }).join('');
  }

  function cardHtml(n) {
    var active = n.id === ui.activeId;
    var title = n.title || 'Untitled';
    var icons =
      (n.pinned ? '<span class="ico-pin" title="Pinned">' + ICONS.pinS + '</span>' : '') +
      (n.starred ? '<span class="ico-star" title="Starred">' + ICONS.starS + '</span>' : '');
    var snip = snippet(n);
    var date = fmtDate(ui.trash ? (n.deletedAt || n.updatedAt) : n.updatedAt);
    var tags = n.tags.slice(0, 4).map(function (t) {
      return '<span class="mini-tag">' + escapeHtml(t) + '</span>';
    }).join('');
    var actions = '';
    if (ui.trash) {
      var armed = purgeArm.id === n.id;
      actions = '<div class="nc-actions">' +
        '<button class="mini-btn" data-act="restore" data-id="' + n.id + '">' + ICONS.undoS + '<span>Restore</span></button>' +
        '<button class="mini-btn danger' + (armed ? ' armed' : '') + '" data-act="purge" data-id="' + n.id + '">' +
        ICONS.trashS + '<span>' + (armed ? 'Sure?' : 'Delete') + '</span></button>' +
        '</div>';
    }
    return '<div class="note-card' + (active ? ' active' : '') + (ui.trash ? ' trashed' : '') + '" data-id="' + n.id +
      '" role="button" tabindex="0" aria-label="' + escapeHtml(title) + '">' +
      '<div class="nc-top"><span class="nc-title">' + escapeHtml(title) + '</span>' +
      (icons ? '<span class="nc-icons">' + icons + '</span>' : '') + '</div>' +
      (snip ? '<div class="nc-snippet">' + escapeHtml(snip) + '</div>' : '') +
      '<div class="nc-meta"><span>' + date + '</span>' +
      (tags ? '<span class="nc-tags">' + tags + '</span>' : '') + '</div>' +
      actions + '</div>';
  }

  function renderNotesList() {
    var list = visibleNotes();
    if (!list.length) {
      var msg = ui.trash ? 'Trash is empty.<br>Deleted notes rest here for 30 days.'
        : (ui.search.trim() || ui.tag) ? 'No notes match your filters.'
        : 'No notes yet — create your first one!';
      notesList.innerHTML = '<div class="list-empty">' + ICONS.search + '<p>' + msg + '</p></div>';
      return;
    }
    notesList.innerHTML = list.map(cardHtml).join('');
  }

  function updateEmptyState() {
    var filtering = ui.search.trim() || ui.tag;
    if (ui.trash) {
      emptyTitle.textContent = 'Trash is empty';
      emptyText.textContent = 'Notes you delete rest here for 30 days before being removed forever.';
      emptyNewBtn.hidden = emptyDailyBtn.hidden = true;
      clearFiltersBtn.hidden = true;
    } else if (filtering) {
      emptyTitle.textContent = 'Nothing found';
      var what = (ui.tag ? '#' + ui.tag : '') + (ui.search.trim() ? ' \u201C' + ui.search.trim() + '\u201D' : '');
      emptyText.textContent = 'No notes match ' + what.trim() + '.';
      emptyNewBtn.hidden = emptyDailyBtn.hidden = true;
      clearFiltersBtn.hidden = false;
    } else {
      emptyTitle.textContent = 'Welcome to Jotter';
      emptyText.textContent = 'Capture ideas, keep a daily journal, and organise everything with tags — all private, right in your browser.';
      emptyNewBtn.hidden = emptyDailyBtn.hidden = false;
      clearFiltersBtn.hidden = true;
    }
  }

  function renderEditor() {
    var n = getNote(ui.activeId);
    editor.hidden = !n;
    emptyState.hidden = !!n;
    if (!n) { updateEmptyState(); return; }

    titleInput.value = n.title;
    editorArea.value = n.body;
    var ro = !!n.deleted;
    titleInput.readOnly = ro;
    editorArea.readOnly = ro;
    tagInput.disabled = ro;
    trashBanner.hidden = !ro;
    renderTagsEditor();
    updateToggles(n);
    panes.dataset.view = settings.view;
    $$('#viewSeg button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === settings.view);
    });
    renderPreview();
    updateStats();
    saveStatus.textContent = 'Saved';
  }

  function renderTagsEditor() {
    var n = getNote(ui.activeId);
    var tags = n ? n.tags : [];
    chips.innerHTML = tags.map(function (t, i) {
      return '<span class="chip"><span>#' + escapeHtml(t) + '</span>' +
        '<button class="chip-x" data-i="' + i + '" aria-label="Remove tag ' + escapeHtml(t) + '" title="Remove">' + ICONS.xS + '</button></span>';
    }).join('');
    tagInput.placeholder = tags.length ? 'Add tag…' : 'Add a tag…';
  }

  function updateToggles(n) {
    starBtn.innerHTML = n.starred ? ICONS.starFill : ICONS.star;
    starBtn.classList.toggle('active', !!n.starred);
    starBtn.setAttribute('aria-pressed', String(!!n.starred));
    starBtn.title = n.starred ? 'Unstar' : 'Star';
    pinBtn.classList.toggle('active', !!n.pinned);
    pinBtn.setAttribute('aria-pressed', String(!!n.pinned));
    pinBtn.title = n.pinned ? 'Unpin' : 'Pin';
  }

  function renderPreview() {
    var val = editorArea.value || '';
    previewArea.innerHTML = window.JotterMD
      ? window.JotterMD.render(val)
      : '<p>' + escapeHtml(val) + '</p>';
    if (!val.trim()) previewArea.innerHTML = '<p class="placeholder-line">Nothing to preview yet…</p>';
  }

  function updateStats() {
    var val = editorArea.value || '';
    var words = (val.trim().match(/\S+/g) || []).length;
    var chars = val.length;
    var mins = words === 0 ? 0 : Math.max(1, Math.round(words / 200));
    statsInfo.textContent = words.toLocaleString() + ' words · ' + chars.toLocaleString() + ' chars · ~' + mins + ' min read';
  }

  function updateStorageNote() {
    if (!persistent) {
      storageNote.innerHTML = '\u26A0\uFE0F Preview mode — browser storage is blocked here, so changes won\u2019t be saved.';
      return;
    }
    var count = notes.filter(function (n) { return !n.deleted; }).length;
    var size = 0;
    try { size = new Blob([JSON.stringify(notes)]).size; } catch (e) {}
    storageNote.textContent = count + ' note' + (count === 1 ? '' : 's') + ' · ' + fmtBytes(size) + ' · saved in this browser';
  }

  /* ---------------- note actions ---------------- */
  function touch(n) {
    n.updatedAt = Date.now();
    persist();
    renderNotesList();
    updateStorageNote();
  }

  function createNote(opts) {
    opts = opts || {};
    var now = Date.now();
    var note = {
      id: uid(),
      title: opts.title || '',
      body: opts.body || '',
      tags: opts.tags || [],
      pinned: opts.pinned || false,
      starred: opts.starred || false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      deletedAt: null
    };
    notes.unshift(note);
    persist();
    ui.activeId = note.id;
    ui.trash = false;
    ui.search = '';
    ui.tag = null;
    searchInput.value = '';
    settings.lastId = note.id;
    persistSettings();
    renderAll();
    if (note.body) {
      editorArea.focus();
      editorArea.setSelectionRange(note.body.length, note.body.length);
    } else {
      titleInput.focus();
    }
    return note;
  }

  function openNote(id) {
    var n = getNote(id);
    if (!n) return;
    ui.activeId = id;
    ui.trash = !!n.deleted;
    settings.lastId = id;
    persistSettings();
    renderAll();
    if (window.matchMedia('(min-width: 901px)').matches) {
      if (n.body) {
        editorArea.focus();
        editorArea.setSelectionRange(n.body.length, n.body.length);
      } else {
        titleInput.focus();
      }
    }
    closeMobileSidebar();
  }

  function trashNote(id) {
    var n = getNote(id);
    if (!n) return;
    n.deleted = true;
    n.deletedAt = Date.now();
    n.pinned = false;
    persist();
    if (ui.activeId === id) ui.activeId = null;
    renderAll();
    toast('Moved to trash — restore it any time within 30 days');
  }

  function restoreNote(id) {
    var n = getNote(id);
    if (!n) return;
    n.deleted = false;
    n.deletedAt = null;
    persist();
    ui.trash = false;
    ui.activeId = id;
    renderAll();
    toast('Note restored');
  }

  function purgeNote(id) {
    notes = notes.filter(function (n) { return n.id !== id; });
    persist();
    if (ui.activeId === id) ui.activeId = null;
    renderAll();
    toast('Deleted forever');
  }

  function requestPurge(id) {
    if (purgeArm.id === id) {
      clearTimeout(purgeArm.t);
      purgeArm.id = null;
      purgeNote(id);
      return;
    }
    clearTimeout(purgeArm.t);
    purgeArm.id = id;
    renderNotesList();
    purgeArm.t = setTimeout(function () {
      purgeArm.id = null;
      renderNotesList();
    }, 2600);
  }

  function duplicateNote() {
    var n = getNote(ui.activeId);
    if (!n) return;
    var copy = normalizeNote(JSON.parse(JSON.stringify({
      id: uid(), title: (n.title || 'Untitled') + ' (copy)', body: n.body, tags: n.tags.slice(),
      pinned: false, starred: n.starred, createdAt: Date.now(), updatedAt: Date.now(), deleted: false, deletedAt: null
    })));
    notes.unshift(copy);
    persist();
    ui.activeId = copy.id;
    ui.trash = false;
    renderAll();
    toast('Note duplicated');
  }

  function dailyTitle() {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function openDaily() {
    var title = dailyTitle();
    var existing = null;
    notes.forEach(function (n) { if (!n.deleted && n.title === title) existing = n; });
    if (existing) { openNote(existing.id); return; }
    var body = '# ' + title + '\n\n**Mood:**\n\n**Weather:**\n\n## Highlights\n- \n\n## Grateful for\n1. \n2. \n3. \n\n## Free thoughts\n\n';
    createNote({ title: title, tags: ['journal'], body: body });
    editorArea.focus();
    editorArea.setSelectionRange(body.length, body.length);
  }

  /* ---------------- editing ---------------- */
  function markDirty() {
    dirty = true;
    saveStatus.textContent = 'Saving…';
    scheduleSave();
    if (settings.view === 'split') renderPreviewLive();
  }

  var scheduleSave = debounce(function () { saveActive(); }, 600);
  var renderPreviewLive = debounce(function () { renderPreview(); updateStats(); }, 250);

  function saveActive() {
    var n = getNote(ui.activeId);
    if (!n) { dirty = false; return; }
    n.title = titleInput.value.slice(0, 200);
    n.body = editorArea.value;
    n.updatedAt = Date.now();
    persist();
    dirty = false;
    saveStatus.textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    renderNotesList();
    updateStorageNote();
  }

  function setView(v) {
    settings.view = v;
    persistSettings();
    $$('#viewSeg button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === v);
    });
    panes.dataset.view = v;
    if (v !== 'edit') renderPreview();
  }

  function cycleView() {
    var order = ['edit', 'split', 'preview'];
    setView(order[(order.indexOf(settings.view) + 1) % order.length]);
  }

  /* task checkbox toggling inside the preview */
  previewArea.addEventListener('click', function (e) {
    var cb = e.target.closest ? e.target.closest('input[type="checkbox"][data-task]') : null;
    if (!cb) return;
    var n = getNote(ui.activeId);
    if (!n || n.deleted) return;
    var lineIdx = parseInt(cb.getAttribute('data-task'), 10);
    var lines = n.body.split('\n');
    if (lines[lineIdx] == null) return;
    lines[lineIdx] = cb.checked
      ? lines[lineIdx].replace(/^(\s*[-*+]\s+\[)([ xX])(\])/, '$1x$3')
      : lines[lineIdx].replace(/^(\s*[-*+]\s+\[)([ xX])(\])/, '$1 $3');
    n.body = lines.join('\n');
    editorArea.value = n.body;
    n.updatedAt = Date.now();
    persist();
    var st = previewArea.scrollTop;
    renderPreview();
    previewArea.scrollTop = st;
    updateStats();
    renderNotesList();
  });

  /* split-view scroll sync (editor drives preview) */
  editorArea.addEventListener('scroll', function () {
    if (settings.view !== 'split') return;
    var denom = editorArea.scrollHeight - editorArea.clientHeight;
    if (denom <= 0) return;
    var ratio = editorArea.scrollTop / denom;
    var pdenom = previewArea.scrollHeight - previewArea.clientHeight;
    if (pdenom > 0) previewArea.scrollTop = ratio * pdenom;
  });

  /* editor niceties */
  editorArea.addEventListener('input', markDirty);
  titleInput.addEventListener('input', markDirty);

  editorArea.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Tab') { e.preventDefault(); handleTab(e); }
    else if (e.key === 'Enter' && !e.shiftKey && !mod) { handleEnter(e); }
    else if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); wrapSelection('**', 'bold text'); }
    else if (mod && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); wrapSelection('*', 'italic text'); }
  });

  function handleTab(e) {
    var el = editorArea, val = el.value;
    var start = el.selectionStart, end = el.selectionEnd;
    var lineStart = val.lastIndexOf('\n', start - 1) + 1;
    var nl = val.indexOf('\n', end);
    var lineEnd = nl === -1 ? val.length : nl;
    var block = val.slice(lineStart, lineEnd);

    var next;
    if (e.shiftKey) {
      next = block.split('\n').map(function (l) { return l.replace(/^ {1,2}/, ''); }).join('\n');
    } else {
      next = block.split('\n').map(function (l) { return '  ' + l; }).join('\n');
    }
    el.value = val.slice(0, lineStart) + next + val.slice(lineEnd);
    el.setSelectionRange(lineStart, lineStart + next.length);
    markDirty();
  }

  function handleEnter(e) {
    var el = editorArea, val = el.value;
    var start = el.selectionStart;
    var lineStart = val.lastIndexOf('\n', start - 1) + 1;
    var line = val.slice(lineStart, start);
    var m = line.match(/^(\s*)(?:([-*+])|(\d{1,9})([.)]))\s+(\[[ xX]\]\s+)?(.*)$/);
    if (!m) return;
    e.preventDefault();
    var indent = m[1], bullet = m[2], num = m[3], punct = m[4] || '.', task = m[5] || '', content = m[6] || '';
    if (!content.trim()) {
      // empty item — exit the list
      el.value = val.slice(0, lineStart) + val.slice(start);
      el.setSelectionRange(lineStart, lineStart);
    } else {
      var marker = bullet ? bullet : (parseInt(num, 10) + 1) + punct;
      var ins = '\n' + indent + marker + ' ' + (task ? '[ ] ' : '');
      el.value = val.slice(0, start) + ins + val.slice(start);
      el.setSelectionRange(start + ins.length, start + ins.length);
    }
    markDirty();
  }

  function wrapSelection(wrap, placeholder) {
    var el = editorArea, val = el.value;
    var s = el.selectionStart, e = el.selectionEnd;
    var sel = val.slice(s, e);
    var before = val.slice(Math.max(0, s - wrap.length), s);
    var after = val.slice(e, e + wrap.length);
    if (sel && before === wrap && after === wrap) {
      el.value = val.slice(0, s - wrap.length) + sel + val.slice(e + wrap.length);
      el.setSelectionRange(s - wrap.length, e - wrap.length);
    } else if (sel) {
      el.value = val.slice(0, s) + wrap + sel + wrap + val.slice(e);
      el.setSelectionRange(s + wrap.length, e + wrap.length);
    } else {
      var ph = placeholder || 'text';
      el.value = val.slice(0, s) + wrap + ph + wrap + val.slice(e);
      el.setSelectionRange(s + wrap.length, s + wrap.length + ph.length);
    }
    el.focus();
    markDirty();
  }

  /* tags editor */
  chips.addEventListener('click', function (e) {
    var x = e.target.closest ? e.target.closest('.chip-x') : null;
    if (!x) return;
    var n = getNote(ui.activeId);
    if (!n || n.deleted) return;
    n.tags.splice(parseInt(x.getAttribute('data-i'), 10), 1);
    touch(n);
    renderTagsEditor();
    renderTagFilters();
  });

  tagInput.addEventListener('keydown', function (e) {
    var n = getNote(ui.activeId);
    if (!n) return;
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTag(); }
    else if (e.key === 'Backspace' && !tagInput.value && n.tags.length) {
      n.tags.pop();
      touch(n);
      renderTagsEditor();
      renderTagFilters();
    }
  });
  tagInput.addEventListener('blur', function () { if (tagInput.value.trim()) commitTag(); });

  function commitTag() {
    var n = getNote(ui.activeId);
    if (!n || n.deleted) { tagInput.value = ''; return; }
    var t = tagInput.value.replace(/#/g, '').replace(/,/g, '').trim().slice(0, 24);
    tagInput.value = '';
    if (!t) return;
    var dup = n.tags.some(function (x) { return x.toLowerCase() === t.toLowerCase(); });
    if (dup) return;
    n.tags.push(t);
    touch(n);
    renderTagsEditor();
    renderTagFilters();
  }

  /* toolbar */
  viewSeg.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-view]') : null;
    if (b) setView(b.getAttribute('data-view'));
  });

  starBtn.addEventListener('click', function () {
    var n = getNote(ui.activeId);
    if (!n || n.deleted) return;
    n.starred = !n.starred;
    touch(n);
    updateToggles(n);
  });

  pinBtn.addEventListener('click', function () {
    var n = getNote(ui.activeId);
    if (!n || n.deleted) return;
    n.pinned = !n.pinned;
    touch(n);
    updateToggles(n);
  });

  noteMenuBtn.addEventListener('click', function () {
    noteMenu.hidden = !noteMenu.hidden;
    noteMenuBtn.setAttribute('aria-expanded', String(!noteMenu.hidden));
  });
  document.addEventListener('click', function (e) {
    if (!(e.target.closest && e.target.closest('.menu-anchor'))) {
      noteMenu.hidden = true;
      noteMenuBtn.setAttribute('aria-expanded', 'false');
    }
  });
  duplicateBtn.addEventListener('click', function () { noteMenu.hidden = true; duplicateNote(); });
  copyMdBtn.addEventListener('click', function () { noteMenu.hidden = true; copyMarkdown(); });
  trashCurrentBtn.addEventListener('click', function () {
    noteMenu.hidden = true;
    if (ui.activeId) trashNote(ui.activeId);
  });

  downloadNoteBtn.addEventListener('click', function () {
    var n = getNote(ui.activeId);
    if (!n) return;
    download(slug(n.title) + '.md', (n.title ? '# ' + n.title + '\n\n' : '') + n.body, 'text/markdown');
  });

  printBtn.addEventListener('click', function () { window.print(); });

  /* trash banner */
  restoreBtn.addEventListener('click', function () { if (ui.activeId) restoreNote(ui.activeId); });
  withConfirm(deleteForeverBtn, 'Really delete?', function () { if (ui.activeId) purgeNote(ui.activeId); });

  /* two-step confirm helper */
  function withConfirm(btn, label, fn) {
    var timer = null;
    btn.addEventListener('click', function () {
      if (btn.classList.contains('armed')) {
        clearTimeout(timer);
        btn.classList.remove('armed');
        if (btn.dataset.orig) { btn.innerHTML = btn.dataset.orig; delete btn.dataset.orig; }
        fn();
        return;
      }
      btn.classList.add('armed');
      btn.dataset.orig = btn.innerHTML;
      btn.innerHTML = label;
      timer = setTimeout(function () {
        btn.classList.remove('armed');
        if (btn.dataset.orig) { btn.innerHTML = btn.dataset.orig; delete btn.dataset.orig; }
      }, 2600);
    });
  }

  /* sidebar interactions */
  notesList.addEventListener('click', function (e) {
    var act = e.target.closest ? e.target.closest('[data-act]') : null;
    if (act) {
      e.stopPropagation();
      if (act.getAttribute('data-act') === 'restore') restoreNote(act.getAttribute('data-id'));
      else if (act.getAttribute('data-act') === 'purge') requestPurge(act.getAttribute('data-id'));
      return;
    }
    var card = e.target.closest ? e.target.closest('.note-card') : null;
    if (card) openNote(card.getAttribute('data-id'));
  });
  notesList.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest ? e.target.closest('.note-card') : null;
    if (card) { e.preventDefault(); openNote(card.getAttribute('data-id')); }
  });

  tagFilters.addEventListener('click', function (e) {
    var chip = e.target.closest ? e.target.closest('[data-tag]') : null;
    if (!chip) return;
    var t = chip.getAttribute('data-tag');
    ui.tag = ui.tag === t ? null : t;
    renderSidebar();
    if (!getNote(ui.activeId)) renderEditor();
  });

  searchInput.addEventListener('input', function () {
    ui.search = searchInput.value;
    renderNotesList();
    if (!getNote(ui.activeId)) renderEditor();
  });

  sortSelect.addEventListener('change', function () {
    settings.sort = sortSelect.value;
    persistSettings();
    renderNotesList();
  });

  notesViewBtn.addEventListener('click', function () {
    if (!ui.trash) return;
    ui.trash = false;
    var n = getNote(ui.activeId);
    if (!n || n.deleted) ui.activeId = null;
    renderAll();
  });
  trashViewBtn.addEventListener('click', function () {
    if (ui.trash) return;
    ui.trash = true;
    var n = getNote(ui.activeId);
    if (!n || !n.deleted) ui.activeId = null;
    renderAll();
  });

  newNoteBtn.addEventListener('click', function () { createNote(); });
  emptyNewBtn.addEventListener('click', function () { createNote(); });
  dailyBtn.addEventListener('click', openDaily);
  emptyDailyBtn.addEventListener('click', openDaily);
  clearFiltersBtn.addEventListener('click', function () {
    ui.search = '';
    ui.tag = null;
    searchInput.value = '';
    renderSidebar();
    if (!getNote(ui.activeId)) renderEditor();
  });

  withConfirm(emptyTrashBtn, 'Really empty trash?', function () {
    notes = notes.filter(function (n) { return !n.deleted; });
    persist();
    ui.activeId = null;
    renderAll();
    toast('Trash emptied');
  });

  /* mobile sidebar */
  function closeMobileSidebar() {
    sidebar.classList.remove('open');
    overlay.hidden = true;
  }
  sidebarToggle.addEventListener('click', function () {
    sidebar.classList.add('open');
    overlay.hidden = false;
  });
  overlay.addEventListener('click', closeMobileSidebar);

  /* theme */
  function applyTheme() {
    var dark = settings.theme === 'dark' ||
      (!settings.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    themeBtn.innerHTML = dark ? ICONS.sun : ICONS.moon;
  }
  themeBtn.addEventListener('click', function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    settings.theme = dark ? 'light' : 'dark';
    persistSettings();
    applyTheme();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (!settings.theme) applyTheme();
  });

  /* import / export */
  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function slug(s) {
    var out = (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return out || 'untitled';
  }

  exportAllBtn.addEventListener('click', function () {
    var payload = { app: 'jotter', version: 1, exportedAt: new Date().toISOString(), notes: notes };
    download('jotter-backup-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify(payload, null, 2), 'application/json');
    toast('Backup downloaded — keep it somewhere safe');
  });

  importBtn.addEventListener('click', function () { importFile.click(); });
  importFile.addEventListener('change', function () {
    var f = importFile.files && importFile.files[0];
    importFile.value = '';
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var incoming = Array.isArray(data) ? data : data.notes;
        if (!Array.isArray(incoming)) throw new Error('bad');
        var added = 0, updated = 0, skipped = 0;
        incoming.forEach(function (raw) {
          var n = normalizeNote(raw);
          if (!n) { skipped++; return; }
          var existing = getNote(n.id);
          if (!existing) { notes.push(n); added++; }
          else if (n.updatedAt > existing.updatedAt) {
            for (var k in n) existing[k] = n[k];
            updated++;
          } else skipped++;
        });
        persist();
        if (ui.activeId && !getNote(ui.activeId)) ui.activeId = null;
        renderAll();
        toast('Restored: ' + added + ' added, ' + updated + ' updated' + (skipped ? ', ' + skipped + ' skipped' : ''));
      } catch (err) {
        toast('\u26A0\uFE0F Could not read that file — is it a Jotter backup?');
      }
    };
    reader.readAsText(f);
  });

  function copyMarkdown() {
    var n = getNote(ui.activeId);
    if (!n) return;
    var text = (n.title ? '# ' + n.title + '\n\n' : '') + n.body;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast('Markdown copied to clipboard'); },
        function () { legacyCopy(text); }
      );
    } else legacyCopy(text);
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Markdown copied to clipboard');
    } catch (e) {
      toast('\u26A0\uFE0F Copy is not available here');
    }
  }

  /* ---------------- toasts ---------------- */
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }

  /* ---------------- global shortcuts ---------------- */
  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    var ae = document.activeElement;
    var inField = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    var k = e.key.toLowerCase();

    if (mod && e.altKey && k === 'n') { e.preventDefault(); createNote(); }
    else if (mod && k === 'f') { e.preventDefault(); focusSearch(); }
    else if (mod && k === 's') { e.preventDefault(); saveActive(); toast('Saved'); }
    else if (mod && k === 'e') { e.preventDefault(); cycleView(); }
    else if (k === '/' && !inField) { e.preventDefault(); focusSearch(); }
    else if (k === 'n' && !inField && !mod && !e.altKey) { createNote(); }
    else if (e.key === 'Escape') {
      noteMenu.hidden = true;
      closeMobileSidebar();
      if (ae === searchInput) searchInput.blur();
    }
  });

  function focusSearch() {
    searchInput.focus();
    searchInput.select();
  }

  /* ---------------- misc ---------------- */
  window.addEventListener('beforeprint', function () {
    if (!getNote(ui.activeId)) return;
    renderPreview(); // always print the rendered view, with the latest text
  });

  window.addEventListener('storage', function (e) {
    if (e.key !== NOTES_KEY) return;
    if (dirty) saveActive();
    load();
    if (ui.activeId && !getNote(ui.activeId)) ui.activeId = null;
    renderAll();
  });

  /* ---------------- service worker (offline + installable) ---------------- */
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () { /* fine */ });
    });
  }

  /* ---------------- boot ---------------- */
  function init() {
    $$('[data-icon]').forEach(function (el) {
      var ic = ICONS[el.getAttribute('data-icon')];
      if (ic) el.insertAdjacentHTML('afterbegin', ic);
    });
    load();
    applyTheme();
    if (settings.lastId && getNote(settings.lastId) && !getNote(settings.lastId).deleted) {
      ui.activeId = settings.lastId;
    } else {
      var first = visibleNotes()[0];
      ui.activeId = first ? first.id : null;
    }
    renderAll();
  }

  init();
})();
