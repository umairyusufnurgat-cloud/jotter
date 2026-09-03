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
    xS: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 11),
    plusL: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 24),
    cmd: svg('<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>', 16),
    chevDown: svg('<polyline points="6 9 12 15 18 9"/>', 14),
    users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 15),
    bookOpen: svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', 15),
    zap: svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', 15),
    listIcon: svg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>', 15),
    fileText: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', 15),
    droplet: svg('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>', 16),
    columns: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>', 15),
    sliders: svg('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>', 16),
    maximize: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>', 16),
    cloud: svg('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>', 14),
    pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>', 14)
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
  var VER_KEY = 'jotter.ver';
  var PURGED_KEY = 'jotter.purged.v1';
  var SYNC_KEY = 'jotter.sync.v1';

  /* ---------------- state ---------------- */
  var notes = [];
  var settings = { theme: null, sort: 'updated', view: 'split', lastId: null, accent: 'indigo' };
  var ui = { activeId: null, search: '', tag: null, trash: false };
  var dirty = false;
  var purgeArm = { id: null, t: null };
  var wikiPop = { open: false, items: [], sel: 0, startIdx: 0, caret: 0 };
  var purged = []; // tombstones for notes deleted forever (so sync doesn't resurrect them)

  /* ---------------- dom refs ---------------- */
  var sidebar = $('#sidebar'), overlay = $('#overlay'), toastEl = $('#toast');
  var notesList = $('#notesList'), tagFilters = $('#tagFilters'), searchInput = $('#searchInput'), sortSelect = $('#sortSelect');
  var newNoteBtn = $('#newNoteBtn'), dailyBtn = $('#dailyBtn'), themeBtn = $('#themeBtn');
  var notesViewBtn = $('#notesViewBtn'), trashViewBtn = $('#trashViewBtn'), trashCount = $('#trashCount');
  var exportAllBtn = $('#expJsonBtn'), importBtn = $('#restoreJsonBtn'), importFile = $('#importFile'), importMdFile = $('#importMdFile');
  var backupBtn = $('#backupBtn'), backupMenu = $('#backupMenu'), expMdBtn = $('#expMdBtn');
  var impBtn = $('#impBtn'), impMenu = $('#impMenu'), importMdBtn = $('#importMdBtn');
  var templateBtn = $('#templateBtn'), templateMenu = $('#templateMenu');
  var accentBtn = $('#accentBtn'), accentMenu = $('#accentMenu');
  var cmdBtn = $('#cmdBtn'), cmdkOverlay = $('#cmdkOverlay'), cmdkInput = $('#cmdkInput'), cmdkList = $('#cmdkList');
  var fabNew = $('#fabNew'), dropOverlay = $('#dropOverlay');
  var toastMsg = $('#toastMsg'), toastAct = $('#toastAct');
  var wikiPopEl = $('#wikiPop'), streakBadge = $('#streakBadge');
  var settingsBtn = $('#settingsBtn'), settingsOverlay = $('#settingsOverlay'), settingsCloseBtn = $('#settingsCloseBtn');
  var syncTokenInput = $('#syncTokenInput'), syncSaveBtn = $('#syncSaveBtn'), syncStatus = $('#syncStatus');
  var syncNowBtn = $('#syncNowBtn'), syncAutoChk = $('#syncAutoChk'), syncDisconnectBtn = $('#syncDisconnectBtn'), aboutInfo = $('#aboutInfo');
  var promptOverlay = $('#promptOverlay'), promptTitle = $('#promptTitle'), promptInput = $('#promptInput');
  var promptOkBtn = $('#promptOkBtn'), promptCancelBtn = $('#promptCancelBtn'), promptCloseBtn = $('#promptCloseBtn');
  var ctxMenu = $('#ctxMenu'), outlineBtn = $('#outlineBtn'), outlineMenu = $('#outlineMenu');
  var zenBtn = $('#zenBtn'), zenExitBtn = $('#zenExitBtn');
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

  function persist() {
    store.set(NOTES_KEY, JSON.stringify(notes));
    if (!syncing) scheduleAutoSync();
  }
  function persistSettings() { store.set(SETTINGS_KEY, JSON.stringify(settings)); }
  function persistPurged() { store.set(PURGED_KEY, JSON.stringify(purged)); }

  /* merge incoming notes into local state — newest edit wins per note */
  function mergeNotes(incoming) {
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
    return { added: added, updated: updated, skipped: skipped, changed: (added + updated) > 0 };
  }

  /* tombstones: notes deleted forever, so other devices don't resurrect them */
  function recordPurge(ids) {
    var now = Date.now();
    ids.forEach(function (id) {
      var x = null;
      for (var i = 0; i < purged.length; i++) if (purged[i].id === id) { x = purged[i]; break; }
      if (x) x.at = now; else purged.push({ id: id, at: now });
    });
  }

  function applyPurged(remoteList) {
    var changed = false;
    (remoteList || []).forEach(function (p) {
      if (!p || !p.id) return;
      var local = null;
      for (var i = 0; i < purged.length; i++) if (purged[i].id === p.id) { local = purged[i]; break; }
      if (!local) { purged.push({ id: p.id, at: +p.at || Date.now() }); changed = true; }
      else if ((+p.at || 0) > local.at) { local.at = +p.at; changed = true; }
      var before = notes.length;
      notes = notes.filter(function (n) { return n.id !== p.id; });
      if (notes.length !== before) changed = true;
    });
    return changed;
  }

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
    '## \uD83D\uDD17 Link notes together',
    '',
    'Type `[[` while writing to link to another note by name \u2014 for example, [[Ideas]]. Clicking a link opens that note, or creates it if it doesn\u2019t exist yet.',
    '',
    '---',
    '',
    '\uD83D\uDCA1 Tip: press **Ctrl K** for the command palette, **N** for a new note, and **/** to search.'
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
    var removed = notes.filter(function (n) { return n.deleted && n.deletedAt && n.deletedAt < cutoff; });
    if (removed.length) {
      removed.forEach(function (n) { recordPurge(n.id); });
      notes = notes.filter(function (n) { return removed.indexOf(n) === -1; });
      persist(); persistPurged();
    }
    var cut2 = Date.now() - 180 * 24 * 60 * 60 * 1000; // prune very old tombstones
    var before = purged.length;
    purged = purged.filter(function (p) { return (p.at || 0) > cut2; });
    if (purged.length !== before) persistPurged();
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
    var pr = store.get(PURGED_KEY);
    if (pr) { try { var pa = JSON.parse(pr); if (Array.isArray(pa)) purged = pa.filter(function (p) { return p && p.id; }); } catch (e) {} }
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
    s = s.replace(/^\s*>\s?/gm, '');
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
    var streak = journalStreak();
    streakBadge.hidden = streak < 2;
    if (streak >= 2) streakBadge.textContent = '\uD83D\uDD25 ' + streak;
    dailyBtn.title = streak >= 2 ? streak + '-day journaling streak' : 'Create today\u2019s journal entry';
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

  /* highlight search matches in escaped text */
  function hi(text) {
    var esc = escapeHtml(text);
    var q = ui.search.trim();
    if (!q) return esc;
    var qe = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return esc.replace(new RegExp('(' + qe + ')', 'gi'), '<mark>$1</mark>'); }
    catch (e) { return esc; }
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
      '<div class="nc-top"><span class="nc-title">' + hi(title) + '</span>' +
      (icons ? '<span class="nc-icons">' + icons + '</span>' : '') + '</div>' +
      (snip ? '<div class="nc-snippet">' + hi(snip) + '</div>' : '') +
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
    markMissingWikiLinks();
  }

  function markMissingWikiLinks() {
    $$('.wiki-link', previewArea).forEach(function (a) {
      var t = (a.getAttribute('data-wiki') || '').trim().toLowerCase();
      var ok = notes.some(function (n) {
        return !n.deleted && (n.title || '').trim().toLowerCase() === t;
      });
      if (!ok) a.classList.add('missing');
    });
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
    var line = count + ' note' + (count === 1 ? '' : 's') + ' · ' + fmtBytes(size) + ' · saved in this browser';
    if (sync.lastSync) {
      line += ' · \u2601\uFE0F ' + new Date(sync.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    storageNote.textContent = line;
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
    recordPurge([id]);
    notes = notes.filter(function (n) { return n.id !== id; });
    persist(); persistPurged();
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
    var wl = e.target.closest ? e.target.closest('a.wiki-link') : null;
    if (wl) {
      e.preventDefault();
      openWikiLink(wl.getAttribute('data-wiki') || '');
      return;
    }
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
  editorArea.addEventListener('input', function () { markDirty(); updateWikiPop(); });
  titleInput.addEventListener('input', markDirty);

  editorArea.addEventListener('keydown', function (e) {
    if (wikiPop.open && wikiPop.items.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); wikiPop.sel = (wikiPop.sel + 1) % wikiPop.items.length; renderWikiSel(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); wikiPop.sel = (wikiPop.sel - 1 + wikiPop.items.length) % wikiPop.items.length; renderWikiSel(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); completeWiki(); return; }
      if (e.key === 'Escape') { e.preventDefault(); hideWikiPop(); return; }
    }
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
    var open = noteMenu.hidden;
    closeAllMenus();
    noteMenu.hidden = !open;
    noteMenuBtn.setAttribute('aria-expanded', String(!noteMenu.hidden));
  });
  document.addEventListener('click', function (e) {
    if (!(e.target.closest && e.target.closest('#ctxMenu'))) ctxMenu.hidden = true;
    if (!(e.target.closest && e.target.closest('.menu-anchor'))) closeAllMenus();
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
    applyAccent();
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

  function exportBackup() {
    var payload = { app: 'jotter', version: 1, exportedAt: new Date().toISOString(), notes: notes };
    download('jotter-backup-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify(payload, null, 2), 'application/json');
    toast('Backup downloaded — keep it somewhere safe');
  }

  function exportAllMd() {
    var list = notes.filter(function (n) { return !n.deleted; })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    if (!list.length) { toast('No notes to export yet'); return; }
    var parts = list.map(function (n) {
      var head = '# ' + (n.title || 'Untitled');
      var b = String(n.body || '');
      if (b.slice(0, head.length).toLowerCase() !== head.toLowerCase()) b = head + '\n\n' + b;
      if (n.tags.length) b += '\n\n*Tags: ' + n.tags.join(', ') + '*';
      return b + '\n\n---\n\n';
    });
    download('jotter-notes-' + new Date().toISOString().slice(0, 10) + '.md', parts.join(''), 'text/markdown');
    toast('Exported ' + list.length + ' note' + (list.length === 1 ? '' : 's') + ' as Markdown');
  }

  function importJsonFile(f) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var incoming = Array.isArray(data) ? data : data.notes;
        if (!Array.isArray(incoming)) throw new Error('bad');
        var m = mergeNotes(incoming);
        if (data && Array.isArray(data.purged)) applyPurged(data.purged);
        persist(); persistPurged();
        if (ui.activeId && !getNote(ui.activeId)) ui.activeId = null;
        renderAll();
        toast('Restored: ' + m.added + ' added, ' + m.updated + ' updated' + (m.skipped ? ', ' + m.skipped + ' skipped' : ''));
      } catch (err) {
        toast('\u26A0\uFE0F Could not read that file — is it a Jotter backup?');
      }
    };
    reader.readAsText(f);
  }

  function importMdFiles(fileList) {
    var files = Array.prototype.slice.call(fileList)
      .filter(function (f) { return /\.(md|markdown|txt)$/i.test(f.name); });
    if (!files.length) { toast('No .md / .txt files found'); return; }
    var done = 0, last = null, count = files.length;
    files.forEach(function (f) {
      var r = new FileReader();
      r.onload = function () {
        var text = String(r.result || '');
        var title = f.name.replace(/\.(md|markdown|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported note';
        var head = '# ' + title;
        if (text.slice(0, head.length).toLowerCase() === head.toLowerCase()) {
          text = text.slice(head.length).replace(/^\s+/, '');
        }
        var note = normalizeNote({ title: title, body: text, tags: [] });
        notes.unshift(note);
        last = note;
        finish();
      };
      r.onerror = function () { finish(); };
      r.readAsText(f);
    });
    function finish() {
      if (++done < count) return;
      persist();
      if (last) { ui.activeId = last.id; ui.trash = false; }
      renderAll();
      toast('Imported ' + count + ' note' + (count === 1 ? '' : 's'));
    }
  }

  exportAllBtn.addEventListener('click', function () { closeAllMenus(); exportBackup(); });
  expMdBtn.addEventListener('click', function () { closeAllMenus(); exportAllMd(); });
  importBtn.addEventListener('click', function () { closeAllMenus(); importFile.click(); });
  importMdBtn.addEventListener('click', function () { closeAllMenus(); importMdFile.click(); });
  bindMenu(backupBtn, backupMenu);
  bindMenu(impBtn, impMenu);

  importFile.addEventListener('change', function () {
    var f = importFile.files && importFile.files[0];
    importFile.value = '';
    if (f) importJsonFile(f);
  });
  importMdFile.addEventListener('change', function () {
    var fs = importMdFile.files;
    importMdFile.value = '';
    if (fs && fs.length) importMdFiles(fs);
  });

  /* drag & drop import */
  var dragDepth = 0;
  function hasFiles(e) {
    return !!(e.dataTransfer && e.dataTransfer.types &&
      Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1);
  }
  window.addEventListener('dragenter', function (e) {
    if (!hasFiles(e)) return;
    dragDepth++;
    dropOverlay.hidden = false;
  });
  window.addEventListener('dragleave', function (e) {
    if (!hasFiles(e)) return;
    if (--dragDepth <= 0) { dragDepth = 0; dropOverlay.hidden = true; }
  });
  window.addEventListener('dragover', function (e) { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dropOverlay.hidden = true;
    var files = Array.prototype.slice.call(e.dataTransfer.files);
    var json = files.filter(function (f) { return /\.json$/i.test(f.name); })[0];
    var md = files.filter(function (f) { return /\.(md|markdown|txt)$/i.test(f.name); });
    if (json) importJsonFile(json);
    if (md.length) importMdFiles(md);
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
  function toast(msg, opts) {
    opts = opts || {};
    toastMsg.textContent = msg;
    if (opts.actionLabel) {
      toastAct.textContent = opts.actionLabel;
      toastAct.hidden = false;
      toastAct.onclick = function () {
        toastEl.classList.remove('show');
        if (opts.onAction) opts.onAction();
      };
    } else {
      toastAct.hidden = true;
      toastAct.onclick = null;
    }
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, opts.timeout || 2800);
  }

  /* ---------------- global shortcuts ---------------- */
  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey;
    var ae = document.activeElement;
    var inField = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    var k = e.key.toLowerCase();

    if (mod && k === 'k') {
      e.preventDefault();
      if (settingsOverlay.hidden && promptOverlay.hidden) togglePalette();
    }
    else if (mod && e.key === '.') { e.preventDefault(); toggleZen(); }
    else if (mod && e.altKey && k === 'n') { e.preventDefault(); createNote(); }
    else if (mod && k === 'f') { e.preventDefault(); focusSearch(); }
    else if (mod && k === 's') { e.preventDefault(); saveActive(); toast('Saved'); }
    else if (mod && k === 'e') { e.preventDefault(); cycleView(); }
    else if (k === '/' && !inField) { e.preventDefault(); focusSearch(); }
    else if (k === 'n' && !inField && !mod && !e.altKey) { createNote(); }
    else if (e.key === 'Escape') {
      if (!ctxMenu.hidden) ctxMenu.hidden = true;
      else if (!promptOverlay.hidden) closePrompt();
      else if (!settingsOverlay.hidden) closeSettings();
      else if (!cmdkOverlay.hidden) closePalette();
      else if (wikiPop.open) hideWikiPop();
      else if (document.body.classList.contains('zen')) toggleZen();
      else {
        closeAllMenus();
        closeMobileSidebar();
        if (ae === searchInput) searchInput.blur();
      }
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
      navigator.serviceWorker.register('service-worker.js').then(function (reg) {
        if (reg.waiting && navigator.serviceWorker.controller) { updateToast(); return; }
        reg.addEventListener('updatefound', function () {
          var w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', function () {
            if (w.state === 'installed' && navigator.serviceWorker.controller) updateToast();
          });
        });
      }).catch(function () { /* fine */ });
    });
  }
  function updateToast() {
    toast('\u2728 A new version of Jotter is ready', {
      actionLabel: 'Reload',
      onAction: function () { location.reload(); },
      timeout: 12000
    });
  }

  /* ============================================================
     v1.1 — accent colours, streak, templates, command palette,
     wiki-links, split new-note button, mobile FAB
     ============================================================ */

  /* ---------- generic menus ---------- */
  var ALL_MENUS = null;
  function closeAllMenus() {
    (ALL_MENUS || []).forEach(function (p) {
      p[0].hidden = true;
      p[1].setAttribute('aria-expanded', 'false');
    });
  }
  function bindMenu(btn, menu) {
    btn.addEventListener('click', function () {
      var open = menu.hidden;
      closeAllMenus();
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(!menu.hidden));
    });
  }
  ALL_MENUS = [
    [noteMenu, noteMenuBtn],
    [templateMenu, templateBtn],
    [accentMenu, accentBtn],
    [backupMenu, backupBtn],
    [impMenu, impBtn],
    [outlineMenu, outlineBtn]
  ];
  bindMenu(templateBtn, templateMenu);
  bindMenu(accentBtn, accentMenu);

  /* ---------- accent colours ---------- */
  var ACCENTS = {
    indigo: { l: '#6558d3', lh: '#5448c0', d: '#948cf4', dh: '#a9a2f7' },
    teal: { l: '#0f9187', lh: '#0c7a72', d: '#5fd3c7', dh: '#7fded4' },
    blue: { l: '#2563eb', lh: '#1e54cc', d: '#7aa5f8', dh: '#94b8fa' },
    rose: { l: '#d64560', lh: '#c13650', d: '#f797a7', dh: '#f9acb9' },
    green: { l: '#2f9e44', lh: '#288739', d: '#69db7c', dh: '#85e396' },
    amber: { l: '#b45309', lh: '#9c4708', d: '#f5b942', dh: '#f7c861' }
  };

  function hexToRgba(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return 'rgba(101,88,211,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function applyAccent() {
    var a = ACCENTS[settings.accent] || ACCENTS.indigo;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var main = dark ? a.d : a.l;
    var hover = dark ? a.dh : a.lh;
    var s = document.documentElement.style;
    s.setProperty('--accent', main);
    s.setProperty('--accent-hover', hover);
    s.setProperty('--accent-soft', hexToRgba(main, dark ? 0.18 : 0.12));
    s.setProperty('--ring', hexToRgba(main, dark ? 0.4 : 0.3));
  }

  function updateAccentMenu() {
    $$('.swatch', accentMenu).forEach(function (s) {
      s.classList.toggle('active', s.getAttribute('data-accent') === (settings.accent || 'indigo'));
    });
  }
  accentMenu.addEventListener('click', function (e) {
    var s = e.target.closest ? e.target.closest('[data-accent]') : null;
    if (!s) return;
    settings.accent = s.getAttribute('data-accent');
    persistSettings();
    applyAccent();
    updateAccentMenu();
    closeAllMenus();
    toast('Accent colour updated');
  });

  /* ---------- journaling streak ---------- */
  function journalStreak() {
    function dayTitle(d) {
      return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    function dayHas(d) {
      var title = dayTitle(d);
      var ds = d.toDateString();
      return notes.some(function (n) {
        if (n.deleted) return false;
        if (n.title === title) return true;
        if (n.tags.indexOf('journal') !== -1) {
          var t = n.updatedAt || n.createdAt;
          return new Date(t).toDateString() === ds;
        }
        return false;
      });
    }
    var streak = 0;
    var d = new Date();
    if (!dayHas(d)) d.setDate(d.getDate() - 1); // today not written yet — streak counts up to yesterday
    while (dayHas(d)) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  /* ---------- note templates ---------- */
  function dShort() {
    return new Date().toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }
  var TEMPLATES = {
    meeting: function () {
      return {
        title: 'Meeting — ' + dShort(), tags: ['meeting'],
        body: '# Meeting — ' + dShort() + '\n\n**Attendees:** \n\n## Agenda\n- \n\n## Discussion\n\n## Decisions\n- \n\n## Action items\n- [ ] \n- [ ] \n'
      };
    },
    reading: function () {
      return {
        title: 'Reading notes', tags: ['reading'],
        body: '# Reading notes\n\n**Title:** \n**Author:** \n**Rating:** \u2B50\u2B50\u2B50\u2B50\u2B50\n\n## Summary\n\n## Key ideas\n- \n\n## Quotes\n> \n\n## How I\u2019ll apply this\n- \n'
      };
    },
    project: function () {
      return {
        title: 'Project plan', tags: ['project'],
        body: '# Project — \n\n## Goal\n\n## Success looks like\n- \n\n## Milestones\n\n| Target date | Milestone | Status |\n| --- | --- | --- |\n| | | Not started |\n\n## Risks & notes\n- \n'
      };
    },
    braindump: function () {
      return {
        title: 'Brain dump — ' + dShort(), tags: [],
        body: '# Brain dump — ' + dShort() + '\n\n- \n- \n- \n'
      };
    }
  };
  function openTemplate(key) {
    if (key === 'journal') { openDaily(); return; }
    var t = TEMPLATES[key] && TEMPLATES[key]();
    if (!t) return;
    createNote({ title: t.title, tags: t.tags, body: t.body });
  }
  templateMenu.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-tpl]') : null;
    if (!b) return;
    closeAllMenus();
    openTemplate(b.getAttribute('data-tpl'));
  });

  /* ---------- command palette ---------- */
  var pal = { items: [], sel: 0 };

  function notePaletteItem(n) {
    return {
      type: 'note',
      label: n.title || 'Untitled',
      sub: fmtDate(n.updatedAt) + (n.tags.length ? ' · #' + n.tags[0] : ''),
      icon: ICONS.file,
      run: function () { openNote(n.id); }
    };
  }

  function buildActions() {
    var acts = [];
    function A(label, sub, icon, run) {
      acts.push({ type: 'action', label: label, sub: sub, icon: icon, run: run });
    }
    A('New note', 'Ctrl Alt N', ICONS.filePlus, function () { createNote(); });
    A('Today\u2019s journal', '', ICONS.calendar, function () { openDaily(); });
    A('New from template: Meeting notes', '', ICONS.users, function () { openTemplate('meeting'); });
    A('New from template: Reading notes', '', ICONS.bookOpen, function () { openTemplate('reading'); });
    A('New from template: Project plan', '', ICONS.listIcon, function () { openTemplate('project'); });
    A('New from template: Brain dump', '', ICONS.zap, function () { openTemplate('braindump'); });
    A('Cycle view (Edit / Split / Preview)', 'Ctrl E', ICONS.columns, function () { cycleView(); });
    A('Toggle focus mode', 'Ctrl .', ICONS.maximize, toggleZen);
    A('Show outline (headings)', '', ICONS.listIcon, function () { buildOutline(); closeAllMenus(); outlineMenu.hidden = false; });
    A('Toggle light / dark theme', '', ICONS.moon, function () { themeBtn.click(); });
    A('Open settings & sync', '', ICONS.sliders, openSettings);
    if (sync.token) A('Sync notes now', '', ICONS.cloud, function () { syncNow(false); });
    A('Backup notes (JSON)', '', ICONS.download, function () { exportBackup(); });
    A('Export all notes as Markdown', '', ICONS.fileText, function () { exportAllMd(); });
    A('Restore JSON backup', '', ICONS.upload, function () { importFile.click(); });
    A('Import Markdown files', '', ICONS.fileText, function () { importMdFile.click(); });
    var trashed = notes.filter(function (n) { return n.deleted; }).length;
    if (trashed) {
      A('Empty trash (' + trashed + ' note' + (trashed === 1 ? '' : 's') + ')', '', ICONS.trash, function () {
        notes = notes.filter(function (n) { return !n.deleted; });
        persist();
        if (ui.activeId && getNote(ui.activeId) && getNote(ui.activeId).deleted) ui.activeId = null;
        renderAll();
        toast('Trash emptied');
      });
    }
    A(ui.trash ? 'Go to Notes' : 'Go to Trash', '', ui.trash ? ICONS.file : ICONS.trash, function () {
      (ui.trash ? notesViewBtn : trashViewBtn).click();
    });
    return acts;
  }

  function paletteItems(q) {
    q = (q || '').trim().toLowerCase();
    var noteItems = [];
    var live = notes.filter(function (n) { return !n.deleted; });
    if (!q) {
      live.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; })
        .slice(0, 7).forEach(function (n) { noteItems.push(notePaletteItem(n)); });
    } else {
      var scored = [];
      live.forEach(function (n) {
        var t = (n.title || 'Untitled').toLowerCase();
        var s = 0;
        if (t.indexOf(q) === 0) s = 100;
        else if (t.indexOf(q) !== -1) s = 80;
        else if (n.tags.some(function (tg) { return tg.toLowerCase().indexOf(q) !== -1; })) s = 65;
        else if ((n.body || '').toLowerCase().indexOf(q) !== -1) s = 45;
        if (s) scored.push([s, n]);
      });
      scored.sort(function (a, b) { return (b[0] - a[0]) || (b[1].updatedAt - a[1].updatedAt); });
      scored.slice(0, 8).forEach(function (x) { noteItems.push(notePaletteItem(x[1])); });
    }
    var acts = buildActions().filter(function (a) {
      return !q || a.label.toLowerCase().indexOf(q) !== -1;
    });
    var items = [];
    if (noteItems.length) {
      if (!q) items.push({ type: 'sep', label: 'Recent notes' });
      items = items.concat(noteItems);
    }
    if (acts.length) {
      if (!q) items.push({ type: 'sep', label: 'Actions' });
      items = items.concat(acts);
    }
    return items.slice(0, 16);
  }

  function renderPalette() {
    var q = cmdkInput.value;
    pal.items = paletteItems(q);
    if (pal.sel >= pal.items.length) pal.sel = 0;
    if (!pal.items.length) {
      cmdkList.innerHTML = '<div class="cmdk-empty">Nothing found for \u201C' + escapeHtml(q) + '\u201D</div>';
      return;
    }
    var html = '';
    pal.items.forEach(function (it, i) {
      if (it.type === 'sep') { html += '<div class="cmdk-sec">' + escapeHtml(it.label) + '</div>'; return; }
      html += '<div class="cmdk-item' + (i === pal.sel ? ' sel' : '') + '" data-i="' + i + '" role="option">' +
        '<span class="ci-icon">' + it.icon + '</span>' +
        '<span class="ci-body"><span class="ci-label">' + escapeHtml(it.label) + '</span>' +
        (it.sub ? '<span class="ci-sub">' + escapeHtml(it.sub) + '</span>' : '') +
        '</span></div>';
    });
    cmdkList.innerHTML = html;
    var selEl = cmdkList.querySelector('.cmdk-item.sel');
    if (selEl && selEl.scrollIntoView) selEl.scrollIntoView({ block: 'nearest' });
  }

  function openPalette() {
    cmdkOverlay.hidden = false;
    cmdkInput.value = '';
    pal.sel = 0;
    renderPalette();
    setTimeout(function () { cmdkInput.focus(); }, 0);
  }
  function closePalette() { cmdkOverlay.hidden = true; }
  function togglePalette() { if (cmdkOverlay.hidden) openPalette(); else closePalette(); }

  cmdBtn.addEventListener('click', openPalette);
  cmdkOverlay.addEventListener('click', function (e) { if (e.target === cmdkOverlay) closePalette(); });
  cmdkInput.addEventListener('input', function () { pal.sel = 0; renderPalette(); });
  cmdkInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!pal.items.length) return;
      var d = e.key === 'ArrowDown' ? 1 : -1;
      pal.sel = (pal.sel + d + pal.items.length) % pal.items.length;
      renderPalette();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      var it = pal.items[pal.sel];
      if (it && it.run) { closePalette(); it.run(); }
    }
  });
  cmdkList.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.cmdk-item') : null;
    if (!el) return;
    var it = pal.items[+el.getAttribute('data-i')];
    if (it && it.run) { closePalette(); it.run(); }
  });

  /* ---------- wiki links ---------- */
  function wikiTargets(q) {
    q = (q || '').toLowerCase();
    return notes.filter(function (n) {
      return !n.deleted && n.id !== ui.activeId &&
        (n.title || '').trim() !== '' &&
        (n.title || '').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return b.updatedAt - a.updatedAt; }).slice(0, 6);
  }

  function updateWikiPop() {
    var n = getNote(ui.activeId);
    if (!n || n.deleted || settings.view === 'preview') { hideWikiPop(); return; }
    var caret = editorArea.selectionStart;
    var before = editorArea.value.slice(0, caret);
    var m = before.match(/\[\[([^\][\n]*)$/);
    if (!m) { hideWikiPop(); return; }
    var targets = wikiTargets(m[1].toLowerCase());
    if (!targets.length) { hideWikiPop(); return; }
    wikiPop.open = true;
    wikiPop.items = targets;
    wikiPop.sel = 0;
    wikiPop.startIdx = caret - m[0].length;
    wikiPop.caret = caret;
    var html = '<div class="wp-head"><span>Link to note</span><span>\u21B5 complete · esc</span></div>';
    targets.forEach(function (t, i) {
      html += '<div class="wp-item' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '">' +
        '<span>' + escapeHtml(t.title || 'Untitled') + '</span>' +
        '<span class="wp-date">' + fmtDate(t.updatedAt) + '</span></div>';
    });
    wikiPopEl.innerHTML = html;
    wikiPopEl.hidden = false;
  }

  function renderWikiSel() {
    $$('.wp-item', wikiPopEl).forEach(function (el, i) {
      el.classList.toggle('sel', i === wikiPop.sel);
    });
  }

  function hideWikiPop() {
    wikiPop.open = false;
    wikiPopEl.hidden = true;
  }

  function completeWiki(idx) {
    var t = wikiPop.items[idx != null ? idx : wikiPop.sel];
    if (!t) { hideWikiPop(); return; }
    var title = t.title || 'Untitled';
    var insert = '[[' + title + ']]';
    editorArea.value = editorArea.value.slice(0, wikiPop.startIdx) + insert + editorArea.value.slice(wikiPop.caret);
    var pos = wikiPop.startIdx + insert.length;
    editorArea.setSelectionRange(pos, pos);
    editorArea.focus();
    hideWikiPop();
    markDirty();
  }

  function openWikiLink(title) {
    title = (title || '').trim();
    if (!title) return;
    var target = null;
    notes.forEach(function (n) {
      if (!n.deleted && (n.title || '').trim().toLowerCase() === title.toLowerCase()) target = n;
    });
    if (target) { openNote(target.id); return; }
    createNote({ title: title });
    toast('Created new note \u201C' + title + '\u201D');
  }

  wikiPopEl.addEventListener('mousedown', function (e) { e.preventDefault(); });
  wikiPopEl.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.wp-item') : null;
    if (el) completeWiki(+el.getAttribute('data-i'));
  });

  /* ---------- mobile FAB ---------- */
  fabNew.addEventListener('click', function () { createNote(); });

  /* ============================================================
     v1.2 — GitHub gist sync, outline, focus mode, tag tools
     ============================================================ */

  /* ---------- gist sync ---------- */
  var sync = { token: '', gistId: '', auto: false, lastSync: 0 };
  var syncing = false;
  var scheduleAutoSync = debounce(function () {
    if (sync.token && sync.auto && !syncing) syncNow(true);
  }, 5000);

  function loadSync() {
    var raw = store.get(SYNC_KEY);
    if (!raw) return;
    try {
      var s = JSON.parse(raw);
      sync.token = s.token || '';
      sync.gistId = s.gistId || '';
      sync.auto = !!s.auto;
      sync.lastSync = +s.lastSync || 0;
    } catch (e) { /* ignore */ }
  }
  function saveSyncCfg() { store.set(SYNC_KEY, JSON.stringify(sync)); }

  function gh(path, opts) {
    return fetch('https://api.github.com' + path, Object.assign({
      headers: {
        'Authorization': 'token ' + sync.token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      }
    }, opts || {}));
  }

  function syncPayload() {
    return JSON.stringify({
      app: 'jotter', version: 2,
      exportedAt: new Date().toISOString(),
      notes: notes,
      purged: purged
    });
  }

  async function syncNow(silent) {
    if (syncing) return;
    if (!sync.token) {
      if (!silent) { openSettings(); toast('Add a GitHub token to enable sync'); }
      return;
    }
    syncing = true;
    updateSyncStatus('Syncing…');
    if (dirty) saveActive(); // let unsaved edits participate in the merge
    try {
      // 1. pull + merge
      var remote = null;
      if (sync.gistId) {
        var res = await gh('/gists/' + sync.gistId);
        if (res.status === 404) sync.gistId = '';
        else if (res.status === 401) throw new Error('token rejected (401)');
        else if (!res.ok) throw new Error('GitHub ' + res.status);
        else {
          var g = await res.json();
          var f = g.files && g.files['jotter-notes.json'];
          if (f) {
            var content = f.content || '';
            if (f.truncated && f.raw_url) {
              var r2 = await fetch(f.raw_url);
              content = await r2.text();
            }
            if (content) remote = JSON.parse(content);
          }
        }
      }
      var changed = false;
      if (remote && Array.isArray(remote.notes)) changed = mergeNotes(remote.notes).changed;
      if (remote && Array.isArray(remote.purged)) changed = applyPurged(remote.purged) || changed;

      var activeNote = getNote(ui.activeId);
      var activeStamp = activeNote ? activeNote.updatedAt : 0;

      if (changed) { persist(); persistPurged(); }

      // 2. push merged state
      var body = JSON.stringify({
        description: 'Jotter notes sync (auto-generated — do not edit)',
        files: { 'jotter-notes.json': { content: syncPayload() } }
      });
      if (sync.gistId) {
        var pr = await gh('/gists/' + sync.gistId, { method: 'PATCH', body: body });
        if (pr.status === 404) sync.gistId = '';
        else if (pr.status === 401) throw new Error('token rejected (401)');
        else if (!pr.ok) throw new Error('GitHub ' + pr.status);
      }
      if (!sync.gistId) {
        var cr = await gh('/gists', { method: 'POST', body: body });
        if (cr.status === 401) throw new Error('token rejected (401)');
        if (!cr.ok) throw new Error('GitHub ' + cr.status);
        var cg = await cr.json();
        sync.gistId = cg.id;
      }
      sync.lastSync = Date.now();
      saveSyncCfg();
      updateSyncStatus();

      // only re-render the editor if the open note actually changed remotely
      var an = getNote(ui.activeId);
      if (!an || an.updatedAt !== activeStamp) renderAll();
      else { renderSidebar(); updateStorageNote(); }

      if (!silent) toast('\u2601\uFE0F Synced with GitHub');
    } catch (err) {
      updateSyncStatus('\u26A0\uFE0F ' + err.message);
      if (!silent) toast('\u26A0\uFE0F Sync failed — ' + err.message);
    } finally {
      syncing = false;
    }
  }

  /* ---------- settings modal ---------- */
  function openSettings() {
    syncTokenInput.value = sync.token || '';
    syncAutoChk.checked = !!sync.auto;
    updateSyncStatus();
    var count = notes.filter(function (n) { return !n.deleted; }).length;
    var size = 0;
    try { size = new Blob([JSON.stringify(notes)]).size; } catch (e) {}
    aboutInfo.textContent = 'Jotter v1.2 · ' + count + ' note' + (count === 1 ? '' : 's') +
      ' · ' + fmtBytes(size) + ' · your data lives in this browser.';
    settingsOverlay.hidden = false;
    setTimeout(function () { if (!sync.token) syncTokenInput.focus(); }, 0);
  }
  function closeSettings() { settingsOverlay.hidden = true; }
  settingsBtn.addEventListener('click', openSettings);
  settingsCloseBtn.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', function (e) { if (e.target === settingsOverlay) closeSettings(); });

  function updateSyncStatus(msg) {
    if (msg) { syncStatus.textContent = msg; return; }
    if (!sync.token) { syncStatus.textContent = 'Not configured.'; return; }
    var last = sync.lastSync
      ? new Date(sync.lastSync).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
      : 'never';
    syncStatus.innerHTML = sync.gistId
      ? '\u2713 Secret gist <a href="https://gist.github.com/' + escapeHtml(sync.gistId) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(sync.gistId.slice(0, 8)) + '\u2026</a> · last sync: ' + last
      : 'Ready — the first sync will create a secret gist. Last sync: ' + last;
  }

  syncSaveBtn.addEventListener('click', async function () {
    var t = syncTokenInput.value.trim();
    sync.token = t;
    if (!t) {
      saveSyncCfg(); updateSyncStatus();
      toast('Sync token cleared');
      return;
    }
    updateSyncStatus('Checking token…');
    try {
      var r = await gh('/gists?per_page=1');
      if (r.status === 401) {
        updateSyncStatus('\u26A0\uFE0F Token rejected (401) — make sure it has the gist scope.');
        toast('\u26A0\uFE0F GitHub rejected that token');
        return;
      }
      if (!r.ok) throw new Error('GitHub ' + r.status);
      saveSyncCfg(); updateSyncStatus();
      toast('\u2713 Sync token saved');
    } catch (e) {
      updateSyncStatus('\u26A0\uFE0F ' + e.message);
    }
  });

  syncNowBtn.addEventListener('click', function () { syncNow(false); });
  syncAutoChk.addEventListener('change', function () {
    sync.auto = syncAutoChk.checked;
    saveSyncCfg();
    if (sync.auto && !sync.token) toast('Add a token first to enable auto-sync');
    else toast(sync.auto ? 'Auto-sync on — notes sync a few seconds after each change' : 'Auto-sync off');
  });
  withConfirm(syncDisconnectBtn, 'Really disconnect?', function () {
    sync = { token: '', gistId: '', auto: false, lastSync: 0 };
    saveSyncCfg();
    updateSyncStatus();
    updateStorageNote();
    toast('Sync disconnected — your notes stay in this browser');
  });

  /* ---------- prompt modal (generic input dialog) ---------- */
  var promptCb = null;
  function openPromptModal(title, value, okLabel, cb) {
    promptTitle.textContent = title;
    promptInput.value = value || '';
    promptOkBtn.textContent = okLabel || 'OK';
    promptCb = cb;
    promptOverlay.hidden = false;
    setTimeout(function () { promptInput.focus(); promptInput.select(); }, 0);
  }
  function closePrompt() { promptOverlay.hidden = true; promptCb = null; }
  function submitPrompt() {
    var v = promptInput.value;
    var cb = promptCb;
    closePrompt();
    if (cb) cb(v);
  }
  promptOkBtn.addEventListener('click', submitPrompt);
  promptCancelBtn.addEventListener('click', closePrompt);
  promptCloseBtn.addEventListener('click', closePrompt);
  promptOverlay.addEventListener('click', function (e) { if (e.target === promptOverlay) closePrompt(); });
  promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitPrompt(); }
  });

  /* ---------- outline (headings) ---------- */
  function buildOutline() {
    renderPreview(); // ensure fresh content
    var hs = $$('h1,h2,h3,h4,h5,h6', previewArea);
    if (!hs.length) {
      outlineMenu.innerHTML = '<div class="ol-empty">No headings yet — add some with # in the editor.</div>';
      return;
    }
    var html = hs.map(function (h, i) {
      var lvl = parseInt(h.tagName.slice(1), 10);
      return '<button class="ol-item lvl-' + lvl + '" data-h="' + i + '" style="padding-left:' + (10 + (lvl - 1) * 13) + 'px">' +
        escapeHtml(h.textContent || ('H' + lvl)) + '</button>';
    }).join('');
    outlineMenu.innerHTML = html;
  }
  outlineBtn.addEventListener('click', function () {
    var open = outlineMenu.hidden;
    closeAllMenus();
    if (!open) { buildOutline(); outlineMenu.hidden = false; }
    outlineBtn.setAttribute('aria-expanded', String(!outlineMenu.hidden));
  });
  outlineMenu.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-h]') : null;
    if (!b) return;
    var i = +b.getAttribute('data-h');
    closeAllMenus();
    if (settings.view === 'edit') setView('split');
    renderPreview();
    var hs = $$('h1,h2,h3,h4,h5,h6', previewArea);
    if (hs[i] && hs[i].scrollIntoView) hs[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- zen / focus mode ---------- */
  function toggleZen() {
    document.body.classList.toggle('zen');
    if (!document.body.classList.contains('zen')) return;
    if (!getNote(ui.activeId)) createNote();
    else editorArea.focus();
  }
  zenBtn.addEventListener('click', toggleZen);
  zenExitBtn.addEventListener('click', toggleZen);

  /* ---------- tag tools (rename / delete everywhere) ---------- */
  var ctxTarget = null;
  var ctxArmed = false;
  function showCtx(tag, x, y) {
    ctxTarget = tag;
    ctxArmed = false;
    ctxMenu.innerHTML =
      '<button id="ctxRename">' + ICONS.pencil + '<span>Rename \u201C' + escapeHtml(tag) + '\u201D\u2026</span></button>' +
      '<button id="ctxDelete" class="danger">' + ICONS.trashS + '<span>Delete tag from all notes</span></button>';
    ctxMenu.style.left = Math.max(8, Math.min(x, window.innerWidth - 240)) + 'px';
    ctxMenu.style.top = Math.max(8, Math.min(y, window.innerHeight - 130)) + 'px';
    ctxMenu.hidden = false;
  }
  tagFilters.addEventListener('contextmenu', function (e) {
    var chip = e.target.closest ? e.target.closest('[data-tag]') : null;
    if (!chip) return;
    e.preventDefault();
    showCtx(chip.getAttribute('data-tag'), e.clientX, e.clientY);
  });
  ctxMenu.addEventListener('click', function (e) {
    var r = e.target.closest ? e.target.closest('#ctxRename') : null;
    if (r) {
      ctxMenu.hidden = true;
      var tag = ctxTarget;
      openPromptModal('Rename tag', tag, 'Rename', function (v) { renameTag(tag, v); });
      return;
    }
    var d = e.target.closest ? e.target.closest('#ctxDelete') : null;
    if (d) {
      if (ctxArmed) { ctxMenu.hidden = true; deleteTagEverywhere(ctxTarget); return; }
      ctxArmed = true;
      d.classList.add('armed');
      d.innerHTML = '<span>Really delete \u201C' + escapeHtml(ctxTarget) + '\u201D everywhere?</span>';
      setTimeout(function () { ctxMenu.hidden = true; }, 2600);
    }
  });

  function renameTag(oldT, newT) {
    newT = String(newT || '').replace(/#/g, '').replace(/,/g, '').trim().slice(0, 24);
    if (!newT || newT.toLowerCase() === (oldT || '').toLowerCase()) return;
    var count = 0;
    notes.forEach(function (n) {
      var i = n.tags.indexOf(oldT);
      if (i === -1) return;
      n.tags.splice(i, 1);
      if (!n.tags.some(function (t) { return t.toLowerCase() === newT.toLowerCase(); })) n.tags.push(newT);
      n.updatedAt = Date.now();
      count++;
    });
    if (count) {
      if (ui.tag === oldT) ui.tag = newT;
      persist(); renderAll();
      toast('Renamed tag on ' + count + ' note' + (count === 1 ? '' : 's'));
    }
  }

  function deleteTagEverywhere(t) {
    var count = 0;
    notes.forEach(function (n) {
      var i = n.tags.indexOf(t);
      if (i !== -1) { n.tags.splice(i, 1); n.updatedAt = Date.now(); count++; }
    });
    if (ui.tag === t) ui.tag = null;
    persist(); renderAll();
    toast('Removed tag from ' + count + ' note' + (count === 1 ? '' : 's'));
  }

  /* ---------------- boot ---------------- */
  function init() {
    $$('[data-icon]').forEach(function (el) {
      var ic = ICONS[el.getAttribute('data-icon')];
      if (ic) el.insertAdjacentHTML('afterbegin', ic);
    });
    loadSync();
    load();
    applyTheme();
    updateAccentMenu();
    if (settings.lastId && getNote(settings.lastId) && !getNote(settings.lastId).deleted) {
      ui.activeId = settings.lastId;
    } else {
      var first = visibleNotes()[0];
      ui.activeId = first ? first.id : null;
    }
    renderAll();
    if (sync.token && sync.auto) setTimeout(function () { syncNow(true); }, 2500);
    var ver = store.get(VER_KEY);
    if (ver !== '3') {
      store.set(VER_KEY, '3');
      if (ver !== null) {
        setTimeout(function () {
          toast('\u2728 Jotter updated to v1.2 — focus mode, outline, GitHub sync & tag tools', { timeout: 6500 });
        }, 700);
      }
    }
  }

  init();
})();
