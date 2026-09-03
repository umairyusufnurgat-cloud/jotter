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
    pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>', 14),
    help: svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 16),
    check: svg('<polyline points="20 6 9 17 4 12"/>', 16),
    play: svg('<polygon points="5 3 19 12 5 21 5 3"/>', 15),
    image: svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>', 16),
    clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', 16),
    chart: svg('<line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="19" y1="20" x2="19" y2="9"/><path d="M2 20h20"/>', 16),
    chevLeft: svg('<polyline points="15 18 9 12 15 6"/>', 16),
    chevRight: svg('<polyline points="9 18 15 12 9 6"/>', 16),
    panelLeft: svg('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/>', 16),
    link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', 16),
    graph: svg('<circle cx="5" cy="6" r="3"/><circle cx="19" cy="6" r="3"/><circle cx="12" cy="19" r="3"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="7.2" y1="8.2" x2="10.5" y2="16.6"/><line x1="16.8" y1="8.2" x2="13.5" y2="16.6"/>', 16),
    chevUp: svg('<polyline points="6 15 12 9 18 15"/>', 16),
    lock: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 16),
    lockS: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 13),
    lockBig: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 30),
    folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', 16),
    folderS: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', 13),
    fileS: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>', 13)
  };

  /* ---------------- storage (localStorage w/ fallback) ---------------- */
  var MEM = {};
  var persistent = true;
  var storeQuota = false; // set when a write fails because storage is full
  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); }
      catch (e) { persistent = false; return Object.prototype.hasOwnProperty.call(MEM, key) ? MEM[key] : null; }
    },
    set: function (key, val) {
      try { window.localStorage.setItem(key, val); storeQuota = false; return true; }
      catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
          storeQuota = true; // storage full — data kept in memory for this session
        } else {
          persistent = false;
          MEM[key] = val;
        }
        return false;
      }
    }
  };

  var NOTES_KEY = 'jotter.notes.v1';
  var SETTINGS_KEY = 'jotter.settings.v1';
  var VER_KEY = 'jotter.ver';
  var PURGED_KEY = 'jotter.purged.v1';
  var SYNC_KEY = 'jotter.sync.v1';

  /* ---------------- state ---------------- */
  var notes = [];
  var settings = { theme: null, sort: 'updated', view: 'split', lastId: null, accent: 'indigo', sideWidth: 302, sideCollapsed: false, foldersFolded: false };
  var ui = { activeId: null, search: '', tag: null, folder: null, all: false, trash: false, cal: false, calMonth: new Date(), calDay: null };
  var dirty = false;
  var purgeArm = { id: null, t: null };
  var wikiPop = { open: false, items: [], sel: 0, startIdx: 0, caret: 0 };
  var purged = []; // tombstones for notes deleted forever (so sync doesn't resurrect them)

  /* ---------------- dom refs ---------------- */
  var sidebar = $('#sidebar'), overlay = $('#overlay'), toastEl = $('#toast');
  var notesList = $('#notesList'), tagFilters = $('#tagFilters'), searchInput = $('#searchInput'), sortSelect = $('#sortSelect');
  var newNoteBtn = $('#newNoteBtn'), dailyBtn = $('#dailyBtn'), themeBtn = $('#themeBtn');
  var notesViewBtn = $('#notesViewBtn'), trashViewBtn = $('#trashViewBtn'), trashCount = $('#trashCount');
  var calViewBtn = $('#calViewBtn'), calPanel = $('#calPanel'), calPrevBtn = $('#calPrevBtn'), calNextBtn = $('#calNextBtn');
  var calTodayBtn = $('#calTodayBtn'), calTitle = $('#calTitle'), calGrid = $('#calGrid'), calDayBox = $('#calDay');
  var sideMeta = $('#sideMeta'), sideResizer = $('#sideResizer');
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
  var statsBtn = $('#statsBtn'), statsOverlay = $('#statsOverlay'), statsCloseBtn = $('#statsCloseBtn'), statsBody = $('#statsBody');
  var histOverlay = $('#histOverlay'), histCloseBtn = $('#histCloseBtn'), histNote = $('#histNote'), histSnapBtn = $('#histSnapBtn');
  var histList = $('#histList'), histPreview = $('#histPreview'), histPreviewTitle = $('#histPreviewTitle');
  var histRestoreBtn = $('#histRestoreBtn'), histMd = $('#histMd'), histBtn = $('#histBtn'), shareBtn = $('#shareBtn');
  var graphBtn = $('#graphBtn'), graphOverlay = $('#graphOverlay'), graphCloseBtn = $('#graphCloseBtn'), graphFitBtn = $('#graphFitBtn');
  var graphMeta = $('#graphMeta'), graphWrap = $('#graphWrap'), graphSvg = $('#graphSvg');
  var findBar = $('#findBar'), findInput = $('#findInput'), findCount = $('#findCount');
  var findPrevBtn = $('#findPrevBtn'), findNextBtn = $('#findNextBtn'), findCloseBtn = $('#findCloseBtn');
  var dlMdBtn = $('#dlMdBtn'), printMdBtn = $('#printMdBtn');
  var lockScreen = $('#lockScreen'), lockPinInput = $('#lockPinInput'), lockUnlockBtn = $('#lockUnlockBtn'), lockErr = $('#lockErr');
  var setLockOverlay = $('#setLockOverlay'), setLockCloseBtn = $('#setLockCloseBtn'), setLockCancelBtn = $('#setLockCancelBtn');
  var setLockGoBtn = $('#setLockGoBtn'), setLockPin = $('#setLockPin'), setLockPin2 = $('#setLockPin2'), lockNoteBtn = $('#lockNoteBtn');
  var moveBtn = $('#moveBtn');
  var foldersSec = $('#foldersSec'), foldersHead = $('#foldersHead'), foldersList = $('#foldersList');
  var folderOverlay = $('#folderOverlay'), folderCloseBtn = $('#folderCloseBtn'), folderPick = $('#folderPick');
  var newFolderInput = $('#newFolderInput'), newFolderBtn = $('#newFolderBtn'), folderNoteHint = $('#folderNoteHint'), sbFolder = $('#sbFolder');
  var locBar = $('#locBar'), locBackBtn = $('#locBackBtn'), locIco = $('#locIco'), locName = $('#locName'),
      locCount = $('#locCount'), locNewBtn = $('#locNewBtn');
  var syncTokenInput = $('#syncTokenInput'), syncSaveBtn = $('#syncSaveBtn'), syncStatus = $('#syncStatus');
  var syncNowBtn = $('#syncNowBtn'), syncAutoChk = $('#syncAutoChk'), syncDisconnectBtn = $('#syncDisconnectBtn'), aboutInfo = $('#aboutInfo');
  var promptOverlay = $('#promptOverlay'), promptTitle = $('#promptTitle'), promptInput = $('#promptInput');
  var promptOkBtn = $('#promptOkBtn'), promptCancelBtn = $('#promptCancelBtn'), promptCloseBtn = $('#promptCloseBtn');
  var ctxMenu = $('#ctxMenu'), outlineBtn = $('#outlineBtn'), outlineMenu = $('#outlineMenu');
  var zenBtn = $('#zenBtn'), zenExitBtn = $('#zenExitBtn');
  var helpBtn = $('#helpBtn'), helpOverlay = $('#helpOverlay'), helpCloseBtn = $('#helpCloseBtn'), helpTabsEl = $('#helpTabs');
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
      deletedAt: +raw.deletedAt || null,
      folder: typeof raw.folder === 'string' ? raw.folder.trim().slice(0, 60) : '',
      locked: !!(raw.locked && validEnc(raw.enc)),
      enc: (raw.locked && validEnc(raw.enc)) ? { v: 1, iv: String(raw.enc.iv), salt: String(raw.enc.salt), ct: String(raw.enc.ct) } : null,
      history: (Array.isArray(raw.history) ? raw.history : []).filter(function (h) {
        return h && typeof h === 'object' && typeof h.body === 'string' && +h.ts;
      }).map(function (h) {
        return { ts: +h.ts, title: typeof h.title === 'string' ? h.title.slice(0, 200) : '', body: h.body };
      }).slice(0, 10)
    };
  }

  var quotaWarned = false;
  function persist() {
    var ok = store.set(NOTES_KEY, JSON.stringify(notes));
    if (ok) {
      quotaWarned = false;
    } else if (storeQuota && !quotaWarned) {
      quotaWarned = true;
      toast('\u26A0\uFE0F Browser storage is full \u2014 the latest change could not be saved. Remove a large image or some notes, and consider taking a Backup.', { timeout: 6500 });
    }
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
    '- Open **New note \u25BE \u2192 Markdown playground** for a live tour of every feature',
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
    '\uD83D\uDCA1 Tip: press **Ctrl K** for the command palette, **?** for the full guide, **N** for a new note, and **/** to search.'
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
      recordPurge(removed.map(function (n) { return n.id; }));
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
    foldersOpen = !settings.foldersFolded;
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
    if (!ui.trash) {
      if (ui.folder) list = list.filter(function (n) { return n.folder === ui.folder; });
      // home shows only unfiled notes once folders exist — but search/tags look everywhere
      else if (!ui.all && !q && !ui.tag && folderExists()) list = list.filter(function (n) { return !n.folder; });
    }

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
    notesViewBtn.classList.toggle('active', !ui.trash && !ui.cal);
    calViewBtn.classList.toggle('active', ui.cal && !ui.trash);
    trashViewBtn.classList.toggle('active', ui.trash);
    var trashed = notes.filter(function (n) { return n.deleted; }).length;
    trashCount.textContent = trashed > 0 ? String(trashed) : '';
    trashCount.hidden = trashed === 0;
    emptyTrashBtn.hidden = !(ui.trash && trashed > 0);
    var streak = journalStreak();
    streakBadge.hidden = streak < 2;
    if (streak >= 2) streakBadge.textContent = '\uD83D\uDD25 ' + streak;
    dailyBtn.title = streak >= 2 ? streak + '-day journaling streak' : 'Create today\u2019s journal entry';
    var calView = ui.cal && !ui.trash;
    calPanel.hidden = !calView;
    sideMeta.hidden = calView;
    tagFilters.hidden = calView;
    notesList.hidden = calView;
    renderFolders(); // handles trash/cal hiding itself
    renderLocBar();
    if (calView) renderCalendar();
    else { renderTagFilters(); renderNotesList(); }
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
      (n.locked ? '<span class="ico-lock" title="Locked with a PIN">' + ICONS.lockS + '</span>' : '') +
      (n.pinned ? '<span class="ico-pin" title="Pinned">' + ICONS.pinS + '</span>' : '') +
      (n.starred ? '<span class="ico-star" title="Starred">' + ICONS.starS + '</span>' : '');
    var snip = snippet(n);
    var date = fmtDate(ui.trash ? (n.deletedAt || n.updatedAt) : n.updatedAt);
    var folderChip = (!ui.trash && n.folder) ? '<span class="nc-folder" title="Folder: ' + escapeHtml(n.folder) + '">' + ICONS.folderS + escapeHtml(n.folder) + '</span>' : '';
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
    return '<div class="note-card' + (active ? ' active' : '') + (ui.trash ? ' trashed' : '') + '" data-id="' + n.id + '"' +
      (ui.trash ? '' : ' draggable="true"') +
      ' role="button" tabindex="0" aria-label="' + escapeHtml(title) + '">' +
      '<div class="nc-top"><span class="nc-title">' + hi(title) + '</span>' +
      (icons ? '<span class="nc-icons">' + icons + '</span>' : '') + '</div>' +
      (snip ? '<div class="nc-snippet">' + hi(snip) + '</div>' : '') +
      '<div class="nc-meta">' + folderChip + '<span>' + date + '</span>' +
      (tags ? '<span class="nc-tags">' + tags + '</span>' : '') + '</div>' +
      actions + '</div>';
  }

  function renderNotesList() {
    var list = visibleNotes();
    if (!list.length) {
      var msg = ui.trash ? 'Trash is empty.<br>Deleted notes rest here for 30 days.'
        : (ui.search.trim() || ui.tag) ? 'No notes match your filters.'
        : ui.folder ? 'No notes in this folder yet.<br>Create one — it lands right here.'
        : (ui.all || !folderExists()) ? 'No notes yet — create your first one!'
        : 'All your notes are in folders.<br>Open one above — or view All notes.';
      notesList.innerHTML = '<div class="list-empty">' + ICONS.search + '<p>' + msg + '</p></div>';
      return;
    }
    notesList.innerHTML = list.map(cardHtml).join('');
  }

  function updateEmptyState() {
    var filtering = ui.search.trim() || ui.tag || ui.folder || ui.all;
    if (ui.trash) {
      emptyTitle.textContent = 'Trash is empty';
      emptyText.textContent = 'Notes you delete rest here for 30 days before being removed forever.';
      emptyNewBtn.hidden = emptyDailyBtn.hidden = true;
      clearFiltersBtn.hidden = true;
    } else if (filtering) {
      emptyTitle.textContent = 'Nothing found';
      var what = (ui.folder ? '\uD83D\uDCC1 ' + ui.folder : '') + (ui.tag ? (ui.folder ? ' · ' : '') + '#' + ui.tag : '') + (ui.search.trim() ? ' \u201C' + ui.search.trim() + '\u201D' : '');
      emptyText.textContent = 'No notes match ' + (what.trim() || 'these filters') + '.';
      emptyNewBtn.hidden = emptyDailyBtn.hidden = true;
      clearFiltersBtn.hidden = !ui.search.trim() && !ui.tag;
    } else if (folderExists()) {
      emptyTitle.textContent = 'Nothing unfiled';
      emptyText.textContent = 'All your notes live in folders — pick one in the sidebar, or click All notes to see everything.';
      emptyNewBtn.hidden = emptyDailyBtn.hidden = false;
      clearFiltersBtn.hidden = true;
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
    var sess = n.locked ? unlockSess[n.id] : null;
    var showLock = !!(n.locked && !sess);
    lockScreen.hidden = !showLock;
    editor.classList.toggle('locked', showLock);
    editorArea.value = sess ? sess.text : (n.locked ? '' : n.body);
    sbFolder.innerHTML = n.folder ? ICONS.folderS + escapeHtml(n.folder) : '';
    sbFolder.hidden = !n.folder;
    updateNoteMenu();
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
    var n = getNote(ui.activeId);
    if (n && n.locked && !unlockSess[n.id]) {
      previewArea.innerHTML = '<p class="placeholder-line">\uD83D\uDD12 This note is locked — unlock it to read and edit.</p>';
      return;
    }
    var val = editorArea.value || '';
    previewArea.innerHTML = window.JotterMD
      ? window.JotterMD.render(val)
      : '<p>' + escapeHtml(val) + '</p>';
    if (!val.trim()) previewArea.innerHTML = '<p class="placeholder-line">Nothing to preview yet…</p>';
    markMissingWikiLinks();
    if (!findBar.hidden) queueFind();
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
      deletedAt: null,
      folder: opts.folder !== undefined ? String(opts.folder).slice(0, 60) : (ui.folder && !ui.trash && !ui.cal ? ui.folder : ''),
      locked: false,
      enc: null,
      history: []
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

  function duplicateNote(noteId) {
    var n = getNote(noteId || ui.activeId);
    if (!n) return;
    var copy = normalizeNote(JSON.parse(JSON.stringify({
      id: uid(), title: (n.title || 'Untitled') + ' (copy)', body: n.body, tags: n.tags.slice(),
      pinned: false, starred: n.starred, createdAt: Date.now(), updatedAt: Date.now(), deleted: false, deletedAt: null,
      folder: n.folder,
      locked: n.locked, enc: n.locked && n.enc ? JSON.parse(JSON.stringify(n.enc)) : null
    })));
    notes.unshift(copy);
    persist();
    ui.activeId = copy.id;
    ui.trash = false;
    renderAll();
    toast(n.locked ? 'Note duplicated \u2014 still locked with the same PIN' : 'Note duplicated');
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
    n.updatedAt = Date.now();
    if (n.locked) {
      if (unlockSess[n.id]) {
        unlockSess[n.id].text = editorArea.value; // plaintext only in memory
        queueRelock(n.id); // re-encrypt to storage shortly
      }
      // no session → note is showing its lock screen; body stays encrypted/empty
    } else {
      n.body = editorArea.value;
      pushHistory(n);
    }
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
    var sess = n.locked ? unlockSess[n.id] : null;
    var src = sess ? sess.text : n.body;
    var lines = src.split('\n');
    if (lines[lineIdx] == null) return;
    lines[lineIdx] = cb.checked
      ? lines[lineIdx].replace(/^(\s*[-*+]\s+\[)([ xX])(\])/, '$1x$3')
      : lines[lineIdx].replace(/^(\s*[-*+]\s+\[)([ xX])(\])/, '$1 $3');
    if (sess) {
      sess.text = lines.join('\n');
      queueRelock(n.id);
    } else {
      n.body = lines.join('\n');
    }
    editorArea.value = sess ? sess.text : n.body;
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
    else if (mod && e.key === ';') { e.preventDefault(); insertTimestamp(); }
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

  /* insert text at the caret */
  function insertAtCursor(text) {
    var el = editorArea;
    var s = el.selectionStart, e = el.selectionEnd;
    el.value = el.value.slice(0, s) + text + el.value.slice(e);
    el.setSelectionRange(s + text.length, s + text.length);
    el.focus();
    markDirty();
  }

  /* Ctrl+; — timestamp for journals & logs */
  function insertTimestamp() {
    var d = new Date();
    insertAtCursor('**' + d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '** \u2014 ');
  }

  /* ---------- embedded images (paste / drop) ---------- */
  function downscaleImage(dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      try {
        var maxW = 1200;
        if (!img.width || img.width <= maxW) { cb(null); return; }
        var scale = maxW / img.width;
        var canvas = document.createElement('canvas');
        canvas.width = maxW;
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        var type = dataUrl.indexOf('data:image/png') === 0 ? 'image/png' : 'image/jpeg';
        cb(canvas.toDataURL(type, 0.85));
      } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = dataUrl;
  }

  function embedImageFile(file) {
    if (!file || !/^image\//.test(file.type || '')) { toast('\u26A0\uFE0F That file is not an image'); return; }
    if (file.size > 8 * 1024 * 1024) { toast('\u26A0\uFE0F Image too large (over 8 MB)'); return; }
    var n = getNote(ui.activeId);
    if (!n || n.deleted) { toast('Open a note first, then paste or drop the image'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var src = String(reader.result || '');
      downscaleImage(src, function (small) {
        var uri = small || src;
        if (uri.length > 2500000) { toast('\u26A0\uFE0F Image too large to embed \u2014 try a smaller one'); return; }
        var label = 'pasted ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        insertAtCursor('\n![' + label + '](' + uri + ')\n');
        toast('\uD83D\uDDBC Image embedded' + (small ? ' (auto-resized)' : ''));
      });
    };
    reader.readAsDataURL(file);
  }

  editorArea.addEventListener('paste', function (e) {
    var n = getNote(ui.activeId);
    if (!n || n.deleted) return;
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && /^image\//.test(items[i].type || '')) {
        var f = items[i].getAsFile();
        if (f) { e.preventDefault(); embedImageFile(f); }
        return;
      }
    }
  });

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

  function downloadCurrentNote() {
    var n = getNote(ui.activeId);
    if (!n) return;
    if (n.locked && !unlockSess[n.id]) { toast('Unlock the note first'); return; }
    var body = n.locked ? unlockSess[n.id].text : n.body;
    download(slug(n.title) + '.md', (n.title ? '# ' + n.title + '\n\n' : '') + body, 'text/markdown');
  }
  downloadNoteBtn.addEventListener('click', function () {
    noteMenu.hidden = true;
    downloadCurrentNote();
  });
  printBtn.addEventListener('click', function () { if (isLockedActive()) { toast('Unlock the note first'); return; } window.print(); });
  dlMdBtn.addEventListener('click', function () { noteMenu.hidden = true; downloadCurrentNote(); });
  printMdBtn.addEventListener('click', function () {
    noteMenu.hidden = true;
    if (isLockedActive()) { toast('Unlock the note first'); return; }
    window.print();
  });

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
    if (Date.now() < lpUntil) return; // ignore the ghost click after a long-press menu
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
    if (ui.cal && !ui.trash) { ui.cal = false; renderAll(); return; }
    renderNotesList();
    if (!getNote(ui.activeId)) renderEditor();
  });

  sortSelect.addEventListener('change', function () {
    settings.sort = sortSelect.value;
    persistSettings();
    renderNotesList();
  });

  notesViewBtn.addEventListener('click', function () {
    if (!ui.trash && !ui.cal && !ui.folder && !ui.all) return;
    ui.trash = false;
    ui.cal = false;
    ui.folder = null; // the Notes tab is the way home: back to unfiled notes
    ui.all = false;
    var n = getNote(ui.activeId);
    if (!n || n.deleted) ui.activeId = null;
    renderAll();
  });
  trashViewBtn.addEventListener('click', function () {
    if (ui.trash) return;
    ui.trash = true;
    ui.cal = false;
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

  /* mobile sidebar + desktop resize/collapse */
  function closeMobileSidebar() {
    sidebar.classList.remove('open');
    overlay.hidden = true;
  }
  function isMobileLayout() { return window.innerWidth <= 900; }

  function setSideWidth(w) {
    w = Math.round(Math.max(SIDE_MIN, Math.min(SIDE_MAX, w)));
    settings.sideWidth = w;
    document.documentElement.style.setProperty('--side-w', w + 'px');
  }
  function updateSideNarrow() {
    if (isMobileLayout()) { sidebar.classList.remove('narrow'); return; }
    sidebar.classList.toggle('narrow', sidebar.clientWidth < 292);
  }
  function toggleSidebar() {
    if (isMobileLayout()) {
      if (sidebar.classList.contains('open')) closeMobileSidebar();
      else { sidebar.classList.add('open'); overlay.hidden = false; }
      return;
    }
    var on = document.body.classList.toggle('side-collapsed');
    settings.sideCollapsed = on;
    persistSettings();
    sidebarToggle.title = on ? 'Show sidebar (Ctrl \\)' : 'Hide sidebar (Ctrl \\)';
    document.body.classList.add('side-anim');
    setTimeout(function () {
      document.body.classList.remove('side-anim');
      updateSideNarrow();
    }, 240);
  }
  sidebarToggle.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', closeMobileSidebar);

  sideResizer.addEventListener('pointerdown', function (e) {
    if (isMobileLayout()) return;
    e.preventDefault();
    try { sideResizer.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    sideResizer.classList.add('active');
    document.body.classList.add('resizing');
  });
  sideResizer.addEventListener('pointermove', function (e) {
    if (!sideResizer.classList.contains('active')) return;
    setSideWidth(e.clientX);
    updateSideNarrow();
  });
  function endSideDrag() {
    if (!sideResizer.classList.contains('active')) return;
    sideResizer.classList.remove('active');
    document.body.classList.remove('resizing');
    persistSettings();
  }
  sideResizer.addEventListener('pointerup', endSideDrag);
  sideResizer.addEventListener('pointercancel', endSideDrag);
  sideResizer.addEventListener('dblclick', toggleSidebar);
  window.addEventListener('resize', updateSideNarrow);

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
      if (n.locked) b = '> \uD83D\uDD12 This note is locked; its content is encrypted.';
      else if (b.slice(0, head.length).toLowerCase() !== head.toLowerCase()) b = head + '\n\n' + b;
      if (n.tags.length) b += '\n\n*Tags: ' + n.tags.join(', ') + '*';
      if (n.folder) b = '*Folder: ' + n.folder + '*\n\n' + b;
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
    var imgs = files.filter(function (f) { return /^image\//.test(f.type || ''); });
    if (imgs.length) { imgs.forEach(embedImageFile); return; }
    var json = files.filter(function (f) { return /\.json$/i.test(f.name); })[0];
    var md = files.filter(function (f) { return /\.(md|markdown|txt)$/i.test(f.name); });
    if (json) importJsonFile(json);
    if (md.length) importMdFiles(md);
  });

  function copyMarkdown() {
    var n = getNote(ui.activeId);
    if (!n) return;
    if (n.locked && !unlockSess[n.id]) { toast('Unlock the note first'); return; }
    var text = (n.title ? '# ' + n.title + '\n\n' : '') + (n.locked ? unlockSess[n.id].text : n.body);
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
      if (settingsOverlay.hidden && promptOverlay.hidden && helpOverlay.hidden) togglePalette();
    }
    else if (mod && e.key === '.') { e.preventDefault(); toggleZen(); }
    else if (mod && e.altKey && k === 'n') { e.preventDefault(); createNote(); }
    else if (mod && k === 'f') { e.preventDefault(); openFind(); }
    else if (mod && k === 's') { e.preventDefault(); saveActive(); toast('Saved'); }
    else if (mod && k === 'e') { e.preventDefault(); cycleView(); }
    else if (mod && k === '\\') { e.preventDefault(); toggleSidebar(); }
    else if (k === '/' && !inField) { e.preventDefault(); focusSearch(); }
    else if (e.key === '?' && !inField) { e.preventDefault(); openHelp(); }
    else if (k === 'n' && !inField && !mod && !e.altKey) { createNote(); }
    else if (e.key === 'Escape') {
      if (!ctxMenu.hidden) ctxMenu.hidden = true;
      else if (!findBar.hidden) closeFind();
      else if (!setLockOverlay.hidden) closeSetLock();
      else if (!folderOverlay.hidden) closeFolderPicker();
      else if (!promptOverlay.hidden) closePrompt();
      else if (!histOverlay.hidden) closeHist();
      else if (!statsOverlay.hidden) closeStats();
      else if (!settingsOverlay.hidden) closeSettings();
      else if (!helpOverlay.hidden) closeHelp();
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
    playground: function () {
      return {
        title: 'Markdown playground', tags: ['guide'],
        body: [
          '# \uD83C\uDF93 Markdown playground',
          '',
          '> This note demonstrates **everything** the notebook can do \u2014 and it\u2019s a completely normal note, so click around, edit, break things. It autosaves, and you can trash it any time.',
          '',
          '---',
          '',
          '## \uD83D\uDCDD Text formatting',
          '',
          '**bold** \u00B7 *italic* \u00B7 ***bold italic*** \u00B7 ~~strikethrough~~ \u00B7 `inline code` \u00B7 [a link](https://example.com) \u00B7 a bare link: https://example.com',
          '',
          'Backslash escapes show characters literally: \\*not italic\\* \u00B7 \\[\\[not a wiki link\\]\\]',
          '',
          '## \uD83D\uDCD1 Headings & structure',
          '',
          '# Heading 1',
          '## Heading 2',
          '### Heading 3',
          '#### Heading 4 \u2014 rarely needed',
          '',
          'Tip: use the **Outline** button in the toolbar to jump between headings in long notes.',
          '',
          '## \u2705 Task lists \u2014 click these in Preview or Split view',
          '',
          '- [x] Checkboxes are clickable in the rendered preview',
          '- [ ] Click me \u2014 the markdown source updates itself',
          '  - [ ] Tasks can be nested',
          '',
          '## \uD83D\uDCCB Lists',
          '',
          '1. Ordered lists',
          '2. With nesting',
          '   - A nested bullet',
          '     - Even deeper',
          '3. And back again',
          '',
          '- Bullets work too, with **formatting** inside',
          '',
          '## \uD83D\uDCAC Quotes',
          '',
          '> Multi-line blockquotes',
          '> look like this.',
          '> \u2014 Someone wise',
          '',
          '## \uD83D\uDCBB Code',
          '',
          'Inline code: `const x = 42`, plus fenced blocks with a language label:',
          '',
          '```js',
          '// Fenced code block with a language label',
          'function greet(name) {',
          '  return `Hello, ${name}!`;',
          '}',
          "greet('Jotter');",
          '```',
          '',
          '## \uD83D\uDCCA Tables (with alignment)',
          '',
          '| Feature | Supported | Notes |',
          '| --- | :---: | --- |',
          '| Tables | \u2705 | this column is centred |',
          '| Tasks | \u2705 | clickable |',
          '| Wiki-links | \u2705 | [[Ideas]] \u2190 dashed = not created yet |',
          '',
          '## \uD83D\uDD17 Wiki-links \u2014 connect your notes',
          '',
          'Link to any note by name, e.g. [[Welcome to Jotter]]. A **dashed** link like [[Ideas]] creates that note when clicked. Type `[[` in the editor for autocomplete.',
          '',
          '## \uD83D\uDDBC Images',
          '',
          'Images embed directly in your notes \u2014 here\u2019s one now:',
          '',
          '![Jotter icon](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAADeklEQVR4nO3bMU4cQRCG0cbyFQgQuSM4inM4ABwKDgC5jwKRc0TAIXCEvAJkvMvMVjX/e6ml3XZXf9MrjRgDAAAAAAAAAAAAAAAAgDkcVC9gaRdnd8//+vfHp4dVvvfo8HiVz+3o+vb0y5ybL/Ef+ejQbxLAsmaPYdrFb3PoNwlgPTPGMN2Cdz34LwSwvplC+Fa9gG189vCzHzPNaYpSl9xQN8B+db8N2t8AMz1NeKv7/FoH0H3z+D+d59g2gM6bxva6zrNlAF03i8/pONd2AXTcJJbTbb6tAui2Oayj05xbBQD71iaATk8F1tdl3i0C6LIZ7FeHubcIAKqUB9DhKUCd6vmXBwCVBEC00gCqrz96qDwHbgCiCYBoZQH4+cOmqvPgBiCaAIgmAKIJgGgCIJoAiCYAogmAaAIgmgCIJgCiCYBo36sXwF9XNyfVS9jJ5fl99RJ25gYgmgCIJgCiCYBoAiCaAIgmAKIJgGgCIJo3wY3M/EZ1Vm4AogmAaAIgmgCIJgCiCYBoAiCaAIgmAKIJgGgCIJoAiCYAogmAaAIgmgCIJgCiCYBoAiCavwlu5Orm5Hf1GnZxeX7/o3oNu3IDEE0ARBMA0QRANAEQTQBEEwDRBEA0ARDNm+BGZn6jOis3ANEEQDQBEE0ARBMA0QRANAEQTQBEEwDRBEA0ARBNAEQTANEEQDQBEE0ARBMA0QRANAEQzd8EN3J1c/Kr6rsvz+9/Vn13JTcA0QRANAEQTQBEEwDRBEA0ARBNAEQTANG8CW4k9W1sJTcA0QRANAEQTQBEEwDRBEA0ARBNAEQTANEEQDQBEE0ARBMA0QRANAEQTQBEEwDRBEA0ARBNAEQTANEEQDQBEE0ARBMA0QRANAEQTQBEEwDRygK4vj09qPpu+qk6D24AogmAaKUB+BnEGLXnwA1ANAEQrTwAP4OyVc+/PACo1CKA6qcANTrMvUUAY/TYDPany7zbBAAVWgXQ5anAujrNuVUAY/TaHJbXbb7tAhij3yaxjI5zbRnAGD03i911nWfbAMbou2lsp/McWwcwRu/N42Pd59d6ca9dnN09f/YzHp8elljKG0eHx6t87qy6H/wX7W+ATbNsarqZ5jTNQl/b9TZwA6xnpoP/YroFv2ebGASwrBkP/aapF/+ej2IQwOfNfugBAAAAAAAAAAAAAABgWn8AymuwahjX5FQAAAAASUVORK5CYII=)',
          '',
          '**Paste a screenshot** into the editor (Ctrl+V) or **drag an image file** in \u2014 it\u2019s resized and embedded automatically, and never leaves your browser.',
          '',
          '## \u23F0 Timestamps',
          '',
          'Press **Ctrl+;** in the editor to drop in the current date & time \u2014 perfect for journals and logs:',
          '',
          '> **3 Sep 2026, 14:02** \u2014 timestamps look like this',
          '',
          '---',
          '',
          '## \uD83C\uDFAF Your turn',
          '',
          '- [ ] Write something below',
          '- [ ] Add a tag with the chips above the editor',
          '- [ ] Star \u2B50 or pin \uD83D\uDCCC this note',
          '- [ ] Find it again later with **Ctrl K**',
          '',
          'That\u2019s the whole toolbox \u2014 everything else is just words. \u2728'
        ].join('\n')
      };
    },
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
    A('New: Markdown playground (all examples)', '', ICONS.play, function () { openTemplate('playground'); });
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
    A('Help & guide', '?', ICONS.help, openHelp);
    if (sync.token) A('Sync notes now', '', ICONS.cloud, function () { syncNow(false); });
    A('Backup notes (JSON)', '', ICONS.download, function () { exportBackup(); });
    A('Notebook insights', '', ICONS.chart, function () { openStats(); });
    A('Note graph', '', ICONS.graph, function () { openGraph(); });
    A('Find in note', 'Ctrl F', ICONS.search, function () { openFind(); });
    A('Lock / unlock note', '', ICONS.lock, function () {
      var n = getNote(ui.activeId);
      if (!n || n.deleted || !hasCrypto) { toast('Open a note first'); return; }
      if (n.locked && unlockSess[n.id]) relockNote(n.id);
      else if (n.locked) toast('Enter the PIN on the note\u2019s lock screen');
      else openSetLock();
    });
    A('Move to folder…', '', ICONS.folder, function () { openFolderPicker(); });
    A('Version history', '', ICONS.undo, function () { openHist(); });
    A('Share note as link', '', ICONS.link, function () { shareNoteLink(); });
    A('Toggle sidebar', 'Ctrl \\', ICONS.panelLeft, function () { toggleSidebar(); });
    A('Open calendar', '', ICONS.calendar, function () { ui.cal = true; ui.trash = false; renderAll(); closeMobileSidebar(); });
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
    var folderItems = [];
    if (!ui.trash) {
      Object.keys(folderCounts()).sort(function (a, b) { return a.localeCompare(b); }).slice(0, 6).forEach(function (f) {
        if (!q || f.toLowerCase().indexOf(q) !== -1) {
          folderItems.push({ type: 'action', label: f, sub: 'Go to folder', icon: ICONS.folderS, run: function () {
            ui.folder = f; ui.all = false; ui.trash = false; ui.cal = false; renderAll();
          } });
        }
      });
    }
    var items = [];
    if (noteItems.length) {
      if (!q) items.push({ type: 'sep', label: 'Recent notes' });
      items = items.concat(noteItems);
    }
    if (acts.length) {
      if (!q) items.push({ type: 'sep', label: 'Actions' });
      items = items.concat(acts);
    }
    if (folderItems.length) {
      if (!q) items.push({ type: 'sep', label: 'Folders' });
      items = items.concat(folderItems);
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
    aboutInfo.textContent = 'Jotter v1.12 · ' + count + ' note' + (count === 1 ? '' : 's') +
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
    var wasHidden = outlineMenu.hidden;
    closeAllMenus();
    if (wasHidden) { buildOutline(); outlineMenu.hidden = false; }
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
    if (isLockedActive()) { toast('Unlock the note first'); return; }
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
  var ctxKind = 'tag'; // 'tag' | 'folder'
  function showCtx(tag, x, y) {
    ctxTarget = tag;
    ctxKind = 'tag';
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
    var ca = e.target.closest ? e.target.closest('[data-ca]') : null;
    if (ca && ctxKind === 'card') {
      ctxMenu.hidden = true;
      cardCtxAction(ctxTarget, ca.getAttribute('data-ca'), ca.getAttribute('data-f'));
      return;
    }
    var r = e.target.closest ? e.target.closest('#ctxRename') : null;
    if (r) {
      ctxMenu.hidden = true;
      var tag = ctxTarget;
      if (ctxKind === 'folder') {
        openPromptModal('Rename folder', tag, 'Rename', function (v) { renameFolder(tag, v); });
      } else {
        openPromptModal('Rename tag', tag, 'Rename', function (v) { renameTag(tag, v); });
      }
      return;
    }
    var d = e.target.closest ? e.target.closest('#ctxDelete') : null;
    if (d) {
      if (ctxArmed) {
        ctxMenu.hidden = true;
        if (ctxKind === 'folder') deleteFolder(ctxTarget);
        else deleteTagEverywhere(ctxTarget);
        return;
      }
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

  /* ---------- folders ---------- */
  var foldersOpen = true;
  function folderExists() {
    return notes.some(function (n) { return !n.deleted && !!n.folder; });
  }
  function folderCounts() {
    var counts = {};
    notes.forEach(function (n) {
      if (n.deleted || !n.folder) return;
      counts[n.folder] = (counts[n.folder] || 0) + 1;
    });
    return counts;
  }
  function folderNames() {
    var counts = folderCounts();
    var names = Object.keys(counts);
    if (ui.folder && names.indexOf(ui.folder) === -1) names.unshift(ui.folder); // keep active visible even at 0
    return names.sort(function (a, b) { return a.localeCompare(b); });
  }
  function renderFolders() {
    var hide = ui.trash || ui.cal;
    var names = hide ? [] : folderNames();
    foldersSec.hidden = hide || names.length === 0;
    if (foldersSec.hidden) return;
    foldersSec.classList.toggle('folded', !foldersOpen);
    foldersHead.setAttribute('aria-expanded', String(foldersOpen));
    foldersList.hidden = !foldersOpen;
    var counts = folderCounts();
    var total = notes.filter(function (n) { return !n.deleted; }).length;
    var html = '<div class="folder-row all' + (ui.all && !ui.folder ? ' active' : '') + '" data-folder=""'
      + ' role="button" tabindex="0" title="Every note, filed or not">' +
      '<span class="fr-ico">' + ICONS.fileS + '</span><span class="fr-name">All notes</span>' +
      '<span class="fr-count">' + total + '</span></div>';
    html += names.map(function (f) {
      var active = ui.folder === f;
      return '<div class="folder-row' + (active ? ' active' : '') + '" data-folder="' + escapeHtml(f) + '" role="button" tabindex="0">'
        + '<span class="fr-ico">' + ICONS.folderS + '</span><span class="fr-name">' + escapeHtml(f) + '</span>'
        + '<span class="fr-count">' + (counts[f] || 0) + '</span>'
        + '<button class="fr-plus" data-new="' + escapeHtml(f) + '" title="New note in this folder" aria-label="New note in ' + escapeHtml(f) + '">+</button>'
        + '</div>';
    }).join('');
    foldersList.innerHTML = html;
  }
  foldersHead.addEventListener('click', function () {
    foldersOpen = !foldersOpen;
    settings.foldersFolded = !foldersOpen;
    persistSettings();
    renderFolders();
  });
  foldersList.addEventListener('click', function (e) {
    var plus = e.target.closest ? e.target.closest('[data-new]') : null;
    if (plus) { // quick-create inside a folder, without navigating to it
      createNote({ folder: plus.getAttribute('data-new') });
      toast('New note in \u201C' + plus.getAttribute('data-new') + '\u201D');
      return;
    }
    var row = e.target.closest ? e.target.closest('[data-folder]') : null;
    if (!row) return;
    var f = row.getAttribute('data-folder');
    if (!f) { // "All notes"
      if (ui.all && !ui.folder) { ui.all = false; } // clicking the active row returns to unfiled home
      else { ui.all = true; ui.folder = null; }
    } else if (ui.folder === f) {
      ui.folder = null; ui.all = false; // toggle the active folder off → home
    } else {
      ui.folder = f; ui.all = false;
    }
    renderAll();
  });
  foldersList.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest ? e.target.closest('[data-folder]') : null;
    if (!row) return;
    e.preventDefault();
    row.click();
  });
  foldersList.addEventListener('contextmenu', function (e) {
    var row = e.target.closest ? e.target.closest('[data-folder]') : null;
    if (!row || !row.getAttribute('data-folder')) return;
    e.preventDefault();
    showCtxFolder(row.getAttribute('data-folder'), e.clientX, e.clientY);
  });

  function moveToFolder(n, name) {
    if (!n) return;
    name = String(name || '').trim().slice(0, 60);
    if (n.folder === name) { closeFolderPicker(); return; }
    n.folder = name;
    n.updatedAt = Date.now();
    persist(); renderAll();
    closeFolderPicker();
    toast(name ? 'Moved to \u201C' + name + '\u201D' : 'Removed from folder');
  }
  var pickNoteId = null; // the note the picker is moving (not necessarily the open one)
  function openFolderPicker(id) {
    var n = getNote(id || ui.activeId);
    if (!n || n.deleted) return;
    pickNoteId = n.id;
    folderNoteHint.textContent = '\u201C' + (n.title || 'Untitled') + '\u201D' + (n.folder ? ' is currently in \u201C' + n.folder + '\u201D' : ' is not in a folder yet');
    renderFolderPick();
    newFolderInput.value = '';
    folderOverlay.hidden = false;
    setTimeout(function () { newFolderInput.focus(); }, 0);
  }
  function closeFolderPicker() { folderOverlay.hidden = true; pickNoteId = null; }
  function renderFolderPick() {
    var n = getNote(pickNoteId);
    if (!n) return;
    var counts = folderCounts();
    var names = Object.keys(counts).sort(function (a, b) { return a.localeCompare(b); });
    var html = '<button class="folder-opt' + (n.folder ? '' : ' cur') + '" data-f="">'
      + '<span class="fr-ico">' + ICONS.folderS + '</span><span class="fr-name">No folder</span>'
      + (n.folder ? '' : '<span class="fr-tick" data-icon="check"></span>') + '</button>';
    html += names.map(function (f) {
      return '<button class="folder-opt' + (n.folder === f ? ' cur' : '') + '" data-f="' + escapeHtml(f) + '">'
        + '<span class="fr-ico">' + ICONS.folderS + '</span><span class="fr-name">' + escapeHtml(f) + '</span>'
        + '<span class="fr-count">' + counts[f] + '</span>'
        + (n.folder === f ? '<span class="fr-tick" data-icon="check"></span>' : '')
        + '</button>';
    }).join('');
    folderPick.innerHTML = html;
    folderPick.querySelectorAll('[data-f]').forEach(function (b) {
      b.addEventListener('click', function () { moveToFolder(getNote(pickNoteId), b.getAttribute('data-f')); });
    });
    // late icon injection for dynamically built rows
    folderPick.querySelectorAll('[data-icon]').forEach(function (el) {
      var ic = ICONS[el.getAttribute('data-icon')];
      if (ic && !el.firstChild) el.insertAdjacentHTML('afterbegin', ic);
    });
  }
  newFolderBtn.addEventListener('click', function () {
    var name = newFolderInput.value.replace(/[\\/]/g, '').trim().slice(0, 60);
    if (!name) { toast('Type a folder name first'); newFolderInput.focus(); return; }
    moveToFolder(getNote(pickNoteId), name);
  });
  newFolderInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); newFolderBtn.click(); }
  });
  folderCloseBtn.addEventListener('click', closeFolderPicker);
  folderOverlay.addEventListener('click', function (e) { if (e.target === folderOverlay) closeFolderPicker(); });
  moveBtn.addEventListener('click', function () { noteMenu.hidden = true; openFolderPicker(); });

  function renameFolder(oldF, newF) {
    newF = String(newF || '').replace(/[\\\/]/g, '').trim().slice(0, 60);
    if (!newF || newF === oldF) return;
    var count = 0;
    notes.forEach(function (n) {
      if (n.folder === oldF) { n.folder = newF; n.updatedAt = Date.now(); count++; }
    });
    if (ui.folder === oldF) ui.folder = newF;
    persist(); renderAll();
    toast(count ? 'Renamed folder on ' + count + ' note' + (count === 1 ? '' : 's') : 'Folder renamed');
  }
  function deleteFolder(f) {
    var count = 0;
    notes.forEach(function (n) {
      if (n.folder === f) { n.folder = ''; n.updatedAt = Date.now(); count++; }
    });
    if (ui.folder === f) ui.folder = null;
    persist(); renderAll();
    toast('Unfiled ' + count + ' note' + (count === 1 ? '' : 's') + ' \u2014 nothing was deleted');
  }
  function showCtxFolder(f, x, y) {
    ctxTarget = f;
    ctxKind = 'folder';
    ctxArmed = false;
    ctxMenu.innerHTML =
      '<button id="ctxRename">' + ICONS.pencil + '<span>Rename \u201C' + escapeHtml(f) + '\u201D\u2026</span></button>' +
      '<button id="ctxDelete" class="danger">' + ICONS.trashS + '<span>Delete folder (keep notes)</span></button>';
    ctxMenu.style.left = Math.max(8, Math.min(x, window.innerWidth - 240)) + 'px';
    ctxMenu.style.top = Math.max(8, Math.min(y, window.innerHeight - 130)) + 'px';
    ctxMenu.hidden = false;
  }

  /* drag note cards onto folder rows (desktop) */
  notesList.addEventListener('dragstart', function (e) {
    var card = e.target.closest ? e.target.closest('.note-card') : null;
    if (!card || ui.trash) { e.preventDefault(); return; }
    e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
    e.dataTransfer.effectAllowed = 'move';
  });
  foldersList.addEventListener('dragover', function (e) {
    var row = e.target.closest ? e.target.closest('[data-folder]') : null;
    if (!row) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    row.classList.add('drag-over');
  });
  foldersList.addEventListener('dragleave', function (e) {
    var row = e.target.closest ? e.target.closest('[data-folder]') : null;
    if (row) row.classList.remove('drag-over');
  });
  foldersList.addEventListener('drop', function (e) {
    var row = e.target.closest ? e.target.closest('[data-folder]') : null;
    if (!row) return;
    e.preventDefault();
    row.classList.remove('drag-over');
    var id = e.dataTransfer.getData('text/plain');
    var n = getNote(id);
    if (n && !n.deleted) moveToFolder(n, row.getAttribute('data-folder'));
  });

  /* ---------- note-card context menu (right-click / long-press) ---------- */
  function showCtxCard(id, x, y) {
    var n = getNote(id);
    if (!n || n.deleted) return;
    ctxTarget = id; ctxKind = 'card'; ctxArmed = false;
    var folders = folderNames().filter(function (f) { return f !== n.folder; }).slice(0, 6);
    var html = folders.map(function (f) {
      return '<button data-ca="move" data-f="' + escapeHtml(f) + '">' + ICONS.folderS + '<span>Move to \u201C' + escapeHtml(f) + '\u201D</span></button>';
    }).join('');
    if (n.folder) html += '<button data-ca="unfile">' + ICONS.fileS + '<span>Remove from folder</span></button>';
    html += '<button data-ca="picker">' + ICONS.folder + '<span>Move to folder\u2026</span></button>' +
      '<hr />' +
      '<button data-ca="pin">' + ICONS.pin + '<span>' + (n.pinned ? 'Unpin' : 'Pin to top') + '</span></button>' +
      '<button data-ca="star">' + ICONS.star + '<span>' + (n.starred ? 'Remove star' : 'Add star') + '</span></button>' +
      '<button data-ca="dup">' + ICONS.copy + '<span>Duplicate</span></button>' +
      '<button data-ca="trash" class="danger">' + ICONS.trash + '<span>Move to trash</span></button>';
    ctxMenu.innerHTML = html;
    ctxMenu.style.left = Math.max(8, Math.min(x, window.innerWidth - 240)) + 'px';
    ctxMenu.style.top = Math.max(8, Math.min(y, window.innerHeight - 320)) + 'px';
    ctxMenu.hidden = false;
  }
  function cardCtxAction(id, act, f) {
    var n = getNote(id);
    if (!n || n.deleted) return;
    if (act === 'move') { moveToFolder(n, f); return; }
    if (act === 'unfile') { moveToFolder(n, ''); return; }
    if (act === 'picker') { openFolderPicker(id); return; }
    if (act === 'pin') { n.pinned = !n.pinned; touch(n); if (n.id === ui.activeId) updateToggles(n); return; }
    if (act === 'star') { n.starred = !n.starred; touch(n); if (n.id === ui.activeId) updateToggles(n); return; }
    if (act === 'dup') { duplicateNote(id); return; }
    if (act === 'trash') { trashNote(id); return; }
  }
  notesList.addEventListener('contextmenu', function (e) {
    if (ui.trash) return;
    var card = e.target.closest ? e.target.closest('.note-card') : null;
    if (!card) return;
    e.preventDefault();
    if (e.button !== 2) lpUntil = Date.now() + 700; // touch-synthesized menu: swallow the ghost click; real right-clicks don't produce clicks
    showCtxCard(card.getAttribute('data-id'), e.clientX, e.clientY);
  });

  /* long-press a card on touch = same menu */
  var lpTimer = null, lpPt = null, lpUntil = 0;
  notesList.addEventListener('touchstart', function (e) {
    if (ui.trash || !e.touches || e.touches.length !== 1) return;
    var card = e.target.closest ? e.target.closest('.note-card') : null;
    if (!card) return;
    var t = e.touches[0];
    lpPt = { x: t.clientX, y: t.clientY };
    var id = card.getAttribute('data-id');
    lpTimer = setTimeout(function () {
      lpTimer = null;
      lpUntil = Date.now() + 800;
      showCtxCard(id, lpPt.x, lpPt.y);
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
    }, 500);
  }, { passive: true });
  notesList.addEventListener('touchmove', function (e) {
    if (!lpTimer || !e.touches || !e.touches.length) return;
    var t = e.touches[0];
    if (Math.abs(t.clientX - lpPt.x) > 10 || Math.abs(t.clientY - lpPt.y) > 10) { clearTimeout(lpTimer); lpTimer = null; }
  }, { passive: true });
  ['touchend', 'touchcancel'].forEach(function (ev) {
    notesList.addEventListener(ev, function () { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }, { passive: true });
  });

  /* ---------- location bar (where am I?) ---------- */
  function renderLocBar() {
    if (ui.trash || ui.cal) { locBar.hidden = true; return; }
    locBar.hidden = false;
    var inFolder = !!ui.folder, inAll = !inFolder && ui.all;
    locBackBtn.hidden = !(inFolder || inAll);
    locIco.innerHTML = inFolder ? ICONS.folderS : (inAll ? ICONS.fileS : '');
    locName.textContent = inFolder ? ui.folder : (inAll ? 'All notes' : 'Notes');
    var count;
    if (inFolder) count = folderCounts()[ui.folder] || 0;
    else if (inAll) count = notes.filter(function (n) { return !n.deleted; }).length;
    else count = notes.filter(function (n) { return !n.deleted && !n.folder; }).length;
    locCount.textContent = count;
    locCount.hidden = false;
    locNewBtn.hidden = !inFolder;
  }
  locBackBtn.addEventListener('click', function () {
    ui.folder = null; ui.all = false;
    renderAll();
  });
  locNewBtn.addEventListener('click', function () {
    if (!ui.folder) return;
    createNote({ folder: ui.folder });
  });

  /* ---------- PIN-locked notes (AES-256-GCM via Web Crypto) ---------- */
  var hasCrypto = !!(window.crypto && window.crypto.subtle && window.crypto.subtle.encrypt);
  var unlockSess = {}; // noteId -> { text, key, salt } — plaintext lives ONLY here, never in storage
  var relockQueue = {}, relockTimer = null;

  function u8ToB64(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  function b64ToU8(b64) {
    var s = atob(b64), u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function validEnc(e) {
    return !!(e && typeof e === 'object' && typeof e.ct === 'string' && typeof e.iv === 'string' && typeof e.salt === 'string' &&
      e.ct.length > 0 && e.iv.length > 0 && e.salt.length > 0);
  }
  function deriveKey(pin, saltU8) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']).then(function (km) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltU8, iterations: 150000, hash: 'SHA-256' }, km,
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function encryptWithKey(key, text, saltB64) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(text)).then(function (ct) {
      return { v: 1, iv: u8ToB64(iv), salt: saltB64, ct: u8ToB64(new Uint8Array(ct)) };
    });
  }
  function encryptBody(pin, text) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return deriveKey(pin, salt).then(function (key) {
      return encryptWithKey(key, text, u8ToB64(salt));
    });
  }
  function tryUnlockNote(n, pin) {
    return deriveKey(pin, b64ToU8(n.enc.salt)).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToU8(n.enc.iv) }, key, b64ToU8(n.enc.ct)).then(function (pt) {
        return { text: new TextDecoder().decode(pt), key: key, salt: n.enc.salt };
      }, function () { return null; }); // wrong PIN → GCM auth failure
    });
  }
  function queueRelock(id) {
    // keep localStorage encrypted and fresh: re-encrypt shortly after typing stops
    relockQueue[id] = true;
    clearTimeout(relockTimer);
    relockTimer = setTimeout(flushRelocks, 700);
  }
  function flushRelocks() {
    var ids = Object.keys(relockQueue);
    relockQueue = {};
    var chain = Promise.resolve();
    ids.forEach(function (id) {
      chain = chain.then(function () {
        var n = getNote(id), sess = unlockSess[id];
        if (!n || !n.locked || !sess || !n.enc) return;
        return encryptWithKey(sess.key, sess.text, sess.salt).then(function (enc) {
          n.enc = enc;
        });
      });
    });
    chain.then(function () { if (ids.length) persist(); }).catch(function () { /* keep session; retry on next edit */ });
  }
  function relockNote(id) {
    var n = getNote(id), sess = unlockSess[id];
    if (!n || !sess || !n.locked) return;
    encryptWithKey(sess.key, sess.text, sess.salt).then(function (enc) {
      n.enc = enc;
      n.body = '';
      n.updatedAt = Date.now();
      delete unlockSess[id];
      persist();
      renderAll();
      toast('\uD83D\uDD12 Note locked');
    }, function () { toast('\u26A0\uFE0F Could not re-lock the note'); });
  }

  function isLockedActive() {
    var n = getNote(ui.activeId);
    return !!(n && n.locked && !unlockSess[n.id]);
  }

  function openSetLock() {
    var n = getNote(ui.activeId);
    if (!n || n.deleted || n.locked) return;
    if (!hasCrypto) { toast('Locking needs a secure (https) context'); return; }
    setLockPin.value = ''; setLockPin2.value = '';
    setLockOverlay.hidden = false;
    setTimeout(function () { setLockPin.focus(); }, 0);
  }
  function closeSetLock() { setLockOverlay.hidden = true; }
  function doSetLock() {
    var n = getNote(ui.activeId);
    if (!n || n.locked) return;
    var pin = setLockPin.value, pin2 = setLockPin2.value;
    if (pin.length < 4) { toast('The PIN needs at least 4 characters'); setLockPin.focus(); return; }
    if (pin !== pin2) { toast('The PINs don\u2019t match'); setLockPin2.focus(); return; }
    var text = editorArea.value;
    encryptBody(pin, text).then(function (enc) {
      n.locked = true;
      n.enc = enc;
      n.body = '';
      n.history = []; // never keep plaintext snapshots of a locked note
      persist();
      closeSetLock();
      renderAll();
      toast('\uD83D\uDD12 Note locked \u2014 keep that PIN safe, it cannot be reset');
    }, function () { toast('\u26A0\uFE0F Encryption failed in this browser'); });
  }
  setLockGoBtn.addEventListener('click', doSetLock);
  setLockCloseBtn.addEventListener('click', closeSetLock);
  setLockCancelBtn.addEventListener('click', closeSetLock);
  setLockOverlay.addEventListener('click', function (e) { if (e.target === setLockOverlay) closeSetLock(); });
  [setLockPin, setLockPin2].forEach(function (el) {
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSetLock(); } });
  });

  function doUnlock() {
    var n = getNote(ui.activeId);
    if (!n || !n.locked || unlockSess[n.id]) return;
    var pin = lockPinInput.value;
    if (!pin) return;
    lockErr.hidden = true;
    tryUnlockNote(n, pin).then(function (sess) {
      if (!sess) { lockErr.hidden = false; lockPinInput.select(); return; }
      unlockSess[n.id] = sess;
      persist(); // updatedAt etc. harmless; body stays ''
      renderAll();
      toast('\uD83D\uDD13 Unlocked for this tab \u2014 it re-locks on reload');
    }, function () { toast('\u26A0\uFE0F Could not unlock in this browser'); });
  }
  lockUnlockBtn.addEventListener('click', doUnlock);
  lockPinInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doUnlock(); } });

  function updateNoteMenu() {
    var n = getNote(ui.activeId);
    var can = !!(n && !n.deleted && hasCrypto);
    var lockedNoSess = !!(n && n.locked && !unlockSess[n.id]);
    lockNoteBtn.hidden = !can || lockedNoSess;
    var span = lockNoteBtn.querySelector('span');
    if (span) span.textContent = (n && n.locked) ? 'Lock now' : 'Lock note';
    moveBtn.hidden = !(n && !n.deleted);
  }
  lockNoteBtn.addEventListener('click', function () {
    noteMenu.hidden = true;
    var n = getNote(ui.activeId);
    if (!n) return;
    if (n.locked) relockNote(n.id);
    else openSetLock();
  });

  /* ---------- version history ---------- */
  var HIST_MAX_PER = 10, HIST_BYTE_CAP = 1572864; // ~1.5 MB of snapshots in total
  var histNoteId = null, histSelTs = 0;

  function pushHistory(n, force) {
    if (!n) return;
    if (n.locked) return; // never snapshot plaintext of a locked note
    var now = Date.now();
    var last = n.history && n.history[0];
    if (!force && last && now - last.ts < 10 * 60000) return;   // at most one snapshot per ~10 min
    if (!force && last && last.body === n.body && last.title === n.title) return; // nothing changed
    n.history = Array.isArray(n.history) ? n.history : [];
    n.history.unshift({ ts: now, title: n.title, body: n.body });
    if (n.history.length > HIST_MAX_PER) n.history.length = HIST_MAX_PER;
    pruneHistory();
  }
  function pruneHistory() {
    var total = 0;
    notes.forEach(function (n) {
      (n.history || []).forEach(function (h) { total += h.body.length; });
    });
    var guard = 0;
    while (total > HIST_BYTE_CAP && guard++ < 1000) {
      var target = null; // always drop the single largest oldest snapshot — frees the most, touches the fewest notes
      notes.forEach(function (n) {
        if (!n.history || !n.history.length) return;
        var tail = n.history[n.history.length - 1];
        if (!target || tail.body.length > target.history[target.history.length - 1].body.length) target = n;
      });
      if (!target) break;
      total -= target.history[target.history.length - 1].body.length;
      target.history.pop();
    }
  }

  function openHist() {
    var n = getNote(ui.activeId);
    if (!n || n.deleted) { toast('Open a note first'); return; }
    if (n.locked) { toast('Version history is paused for locked notes'); return; }
    histNoteId = n.id;
    histSelTs = 0;
    histOverlay.hidden = false;
    renderHist();
  }
  function closeHist() {
    histOverlay.hidden = true;
    histNoteId = null;
    histSelTs = 0;
  }
  function renderHist() {
    var n = getNote(histNoteId);
    if (!n) { closeHist(); return; }
    histNote.textContent = (n.title || 'Untitled') + ' — snapshotted automatically while you edit';
    if (!n.history || !n.history.length) {
      histList.innerHTML = '<p class="cal-hint">No snapshots yet — one is kept automatically every ~10 minutes while you edit (and before every restore). The last 10 versions survive here.</p>';
      histPreview.hidden = true;
      return;
    }
    histList.innerHTML = n.history.map(function (h) {
      var d = new Date(h.ts);
      var words = (String(h.body).trim().match(/\S+/g) || []).length;
      return '<button class="hist-item' + (h.ts === histSelTs ? ' sel' : '') + '" data-ts="' + h.ts + '">' +
        '<span class="hist-when">' + d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span>' +
        '<span class="hist-meta">' + words.toLocaleString() + ' words · ' + kbFmt(h.body.length) + '</span></button>';
    }).join('');
    renderHistPreview();
  }
  function renderHistPreview() {
    var n = getNote(histNoteId);
    var h = n && n.history && n.history.filter(function (x) { return x.ts === histSelTs; })[0];
    if (!h) { histPreview.hidden = true; return; }
    histPreview.hidden = false;
    histPreviewTitle.textContent = 'From ' + new Date(h.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    histMd.innerHTML = window.JotterMD.render(h.body);
    histMd.scrollTop = 0;
  }
  histBtn.addEventListener('click', function () { noteMenu.hidden = true; openHist(); });
  histCloseBtn.addEventListener('click', closeHist);
  histOverlay.addEventListener('click', function (e) { if (e.target === histOverlay) closeHist(); });
  histSnapBtn.addEventListener('click', function () {
    var n = getNote(histNoteId);
    if (!n) return;
    pushHistory(n, true);
    persist();
    renderHist();
    toast('Snapshot saved');
  });
  histList.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-ts]') : null;
    if (!b) return;
    var ts = +b.getAttribute('data-ts');
    histSelTs = (histSelTs === ts) ? 0 : ts;
    renderHist();
  });
  histRestoreBtn.addEventListener('click', function () {
    var n = getNote(histNoteId);
    var h = n && n.history && n.history.filter(function (x) { return x.ts === histSelTs; })[0];
    if (!n || !h) return;
    pushHistory(n, true); // keep the current state first — restoring is itself undoable
    n.title = h.title;
    n.body = h.body;
    n.updatedAt = Date.now();
    persist();
    closeHist();
    renderAll();
    toast('Restored version from ' + new Date(h.ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
  });

  /* ---------- share a note as a link ---------- */
  function encodeShare(n) {
    var json = JSON.stringify({ t: n.title || '', b: n.body || '', g: Array.isArray(n.tags) ? n.tags.slice(0, 12) : [] });
    return btoa(unescape(encodeURIComponent(json)));
  }
  function decodeShare(b64) {
    try {
      if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length > 200000) return null;
      var p = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (!p || typeof p !== 'object' || typeof p.b !== 'string') return null;
      return {
        t: typeof p.t === 'string' ? p.t.slice(0, 200) : '',
        b: p.b.slice(0, 500000),
        g: Array.isArray(p.g) ? p.g.filter(function (t) { return typeof t === 'string'; }).slice(0, 12) : []
      };
    } catch (e) { return null; }
  }
  function shareNoteLink() {
    var n = getNote(ui.activeId);
    if (!n || n.deleted) { toast('Open a note first'); return; }
    if (n.locked) { toast('Locked notes can\u2019t be shared as links'); return; }
    var url = location.origin + location.pathname + '#n=' + encodeShare(n);
    if (url.length > 30000) {
      toast('This note is too large to share as a link (embedded images?) — use Backup or Sync instead', { timeout: 6000 });
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast('Link copied — opening it saves a copy of this note in Jotter');
      }, function () { showShareFallback(url); });
    } else showShareFallback(url);
  }
  function showShareFallback(url) {
    openPromptModal('Copy this share link', url, 'Done', function () {});
  }
  function importSharedNote() {
    var m = /^#n=([A-Za-z0-9+/=]+)$/.exec(location.hash || '');
    if (!m) return false;
    var p = decodeShare(m[1]);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
    if (!p) { toast('That shared link looked invalid'); return false; }
    createNote({ title: p.t || 'Shared note', tags: p.g, body: p.b });
    toast('Received a shared note — saved to your notebook');
    return true;
  }
  shareBtn.addEventListener('click', function () { noteMenu.hidden = true; shareNoteLink(); });

  /* ---------- note graph ---------- */
  var GRAPH = { nodes: [], links: [], pan: { x: 0, y: 0 }, zoom: 1, alpha: 0, running: false, dragNode: null, panning: false, moved: false, lastP: null };

  function buildGraphData() {
    var live = notes.filter(function (n) { return !n.deleted; });
    var byTitle = {}, byId = {};
    live.forEach(function (n) {
      var t = (n.title || '').trim().toLowerCase();
      if (t && !byTitle[t]) byTitle[t] = n;
    });
    var nodes = live.map(function (n) {
      var v = { id: n.id, title: n.title || 'Untitled', x: 0, y: 0, vx: 0, vy: 0, deg: 0 };
      byId[n.id] = v;
      return v;
    });
    var seen = {}, links = [];
    live.forEach(function (n) {
      var re = /\[\[([^\[\]]+)\]\]/g, m;
      while ((m = re.exec(String(n.body || '')))) {
        var t = m[1].trim().toLowerCase();
        var target = byTitle[t];
        if (!target || target.id === n.id) continue;
        var key = n.id < target.id ? n.id + '~' + target.id : target.id + '~' + n.id;
        if (seen[key]) continue;
        seen[key] = 1;
        links.push({ a: byId[n.id], b: byId[target.id] });
      }
    });
    links.forEach(function (l) { l.a.deg++; l.b.deg++; });
    return { nodes: nodes, links: links };
  }

  function graphTick() {
    var ns = GRAPH.nodes, ls = GRAPH.links, i, j;
    for (i = 0; i < ns.length; i++) {
      for (j = i + 1; j < ns.length; j++) {
        var a = ns[i], b = ns[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d2 = dx * dx + dy * dy || 0.01;
        if (d2 > 100000) continue;
        var d = Math.sqrt(d2);
        var f = 2600 / d2;
        var fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
    ls.forEach(function (l) {
      var dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      var f = (d - 95) * 0.025;
      var fx = (dx / d) * f, fy = (dy / d) * f;
      l.a.vx += fx; l.a.vy += fy;
      l.b.vx -= fx; l.b.vy -= fy;
    });
    ns.forEach(function (v) {
      v.vx -= v.x * 0.003;
      v.vy -= v.y * 0.003;
      if (v === GRAPH.dragNode) { v.vx = 0; v.vy = 0; return; }
      v.vx *= 0.82; v.vy *= 0.82;
      v.x += v.vx; v.y += v.vy;
    });
  }

  function renderGraph() {
    var w = graphSvg.clientWidth || 600, h = graphSvg.clientHeight || 400;
    var t = 'translate(' + (w / 2 + GRAPH.pan.x).toFixed(1) + ',' + (h / 2 + GRAPH.pan.y).toFixed(1) + ') scale(' + GRAPH.zoom.toFixed(3) + ')';
    var html = '<g transform="' + t + '">';
    GRAPH.links.forEach(function (l) {
      html += '<line class="gl" x1="' + l.a.x.toFixed(1) + '" y1="' + l.a.y.toFixed(1) + '" x2="' + l.b.x.toFixed(1) + '" y2="' + l.b.y.toFixed(1) + '"/>';
    });
    GRAPH.nodes.forEach(function (v) {
      var r = 7 + Math.min(10, v.deg * 2.5);
      html += '<g class="gn' + (v.id === ui.activeId ? ' active' : '') + '" data-id="' + escapeHtml(v.id) + '" transform="translate(' + v.x.toFixed(1) + ',' + v.y.toFixed(1) + ')">' +
        '<title>' + escapeHtml(v.title) + '</title>' +
        '<circle r="' + r.toFixed(1) + '"/>' +
        '<text y="' + (r + 13).toFixed(1) + '">' + escapeHtml(truncTxt(v.title, 18)) + '</text></g>';
    });
    graphSvg.innerHTML = html + '</g>';
  }

  function heatGraph(a) {
    GRAPH.alpha = Math.max(GRAPH.alpha, a);
    if (!GRAPH.running && !graphOverlay.hidden) {
      GRAPH.running = true;
      requestAnimationFrame(graphFrame);
    }
  }
  function graphFrame() {
    if (graphOverlay.hidden) { GRAPH.running = false; return; }
    graphTick();
    renderGraph();
    GRAPH.alpha *= 0.985;
    if (GRAPH.alpha > 0.02 || GRAPH.dragNode) requestAnimationFrame(graphFrame);
    else GRAPH.running = false;
  }

  function fitGraph() {
    if (!GRAPH.nodes.length) return;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    GRAPH.nodes.forEach(function (v) {
      if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    });
    var w = graphSvg.clientWidth || 600, h = graphSvg.clientHeight || 400;
    var bw = Math.max(80, maxX - minX), bh = Math.max(80, maxY - minY);
    GRAPH.zoom = Math.max(0.25, Math.min(2.2, Math.min((w - 130) / bw, (h - 130) / bh)));
    GRAPH.pan.x = -((minX + maxX) / 2) * GRAPH.zoom;
    GRAPH.pan.y = -((minY + maxY) / 2) * GRAPH.zoom;
    renderGraph();
  }

  function openGraph() {
    var live = notes.filter(function (n) { return !n.deleted; });
    if (!live.length) { toast('Create some notes first — the graph shows how they connect'); return; }
    var data = buildGraphData();
    GRAPH.nodes = data.nodes;
    GRAPH.links = data.links;
    var R = 60 + GRAPH.nodes.length * 5;
    GRAPH.nodes.forEach(function (v, i) {
      var ang = (i / GRAPH.nodes.length) * Math.PI * 2;
      v.x = Math.cos(ang) * R; v.y = Math.sin(ang) * R;
      v.vx = 0; v.vy = 0; v.deg = v.deg || 0;
    });
    GRAPH.pan = { x: 0, y: 0 };
    GRAPH.zoom = 1;
    GRAPH.dragNode = null;
    graphMeta.textContent = GRAPH.nodes.length + ' notes · ' + GRAPH.links.length + (GRAPH.links.length === 1 ? ' link' : ' links');
    graphOverlay.hidden = false;
    heatGraph(1);
    setTimeout(fitGraph, 1400);
  }
  function closeGraph() {
    graphOverlay.hidden = true;
    GRAPH.nodes = []; GRAPH.links = []; GRAPH.running = false; GRAPH.dragNode = null;
  }
  graphBtn.addEventListener('click', openGraph);
  graphCloseBtn.addEventListener('click', closeGraph);
  graphFitBtn.addEventListener('click', fitGraph);
  graphOverlay.addEventListener('click', function (e) { if (e.target === graphOverlay) closeGraph(); });

  function toSim(e) {
    var r = graphSvg.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - r.width / 2 - GRAPH.pan.x) / GRAPH.zoom,
      y: (e.clientY - r.top - r.height / 2 - GRAPH.pan.y) / GRAPH.zoom
    };
  }
  graphSvg.addEventListener('pointerdown', function (e) {
    if (graphOverlay.hidden) return;
    GRAPH.moved = false;
    GRAPH.lastP = { x: e.clientX, y: e.clientY };
    var g = e.target.closest ? e.target.closest('g.gn') : null;
    if (g) {
      var id = g.getAttribute('data-id');
      GRAPH.dragNode = GRAPH.nodes.filter(function (v) { return v.id === id; })[0] || null;
    } else {
      GRAPH.panning = true;
    }
    try { graphSvg.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    e.preventDefault();
  });
  graphSvg.addEventListener('pointermove', function (e) {
    if (graphOverlay.hidden || (!GRAPH.dragNode && !GRAPH.panning)) return;
    if (GRAPH.lastP && (Math.abs(e.clientX - GRAPH.lastP.x) > 3 || Math.abs(e.clientY - GRAPH.lastP.y) > 3)) GRAPH.moved = true;
    if (GRAPH.dragNode) {
      var p = toSim(e);
      GRAPH.dragNode.x = p.x; GRAPH.dragNode.y = p.y;
      heatGraph(0.35);
      return;
    }
    GRAPH.pan.x += e.clientX - GRAPH.lastP.x;
    GRAPH.pan.y += e.clientY - GRAPH.lastP.y;
    GRAPH.lastP = { x: e.clientX, y: e.clientY };
    renderGraph();
  });
  graphSvg.addEventListener('pointerup', function (e) {
    var clicked = GRAPH.dragNode;
    GRAPH.panning = false;
    GRAPH.dragNode = null;
    if (clicked && !GRAPH.moved) {
      closeGraph();
      openNote(clicked.id);
    }
  });
  graphSvg.addEventListener('wheel', function (e) {
    if (graphOverlay.hidden) return;
    e.preventDefault();
    var r = graphSvg.getBoundingClientRect();
    var mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
    var nz = Math.max(0.25, Math.min(3, GRAPH.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    GRAPH.pan.x = mx - (mx - GRAPH.pan.x) * (nz / GRAPH.zoom);
    GRAPH.pan.y = my - (my - GRAPH.pan.y) * (nz / GRAPH.zoom);
    GRAPH.zoom = nz;
    renderGraph();
  }, { passive: false });
  graphSvg.addEventListener('dblclick', function (e) {
    if (e.target.closest && e.target.closest('g.gn')) return;
    fitGraph();
  });

  /* ---------- find in note ---------- */
  var findHits = [], findIdx = 0;
  var queueFind = debounce(runFind, 250);

  function clearFindMarks() {
    $$('mark.find-hit', previewArea).forEach(function (m) {
      var p = m.parentNode;
      if (!p) return;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
      p.normalize();
    });
  }
  function runFind() {
    clearFindMarks();
    findHits = [];
    findIdx = 0;
    var q = findInput.value;
    if (!q) { findCount.textContent = ''; return; }
    var lq = q.toLowerCase();
    var walker = document.createTreeWalker(previewArea, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.toLowerCase().indexOf(lq) === -1) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var texts = [], t;
    while ((t = walker.nextNode())) texts.push(t);
    texts.forEach(function (node) {
      var text = node.nodeValue, lt = text.toLowerCase();
      var i = lt.indexOf(lq);
      var frag = document.createDocumentFragment(), pos = 0;
      while (i !== -1) {
        if (i > pos) frag.appendChild(document.createTextNode(text.slice(pos, i)));
        var mk = document.createElement('mark');
        mk.className = 'find-hit';
        mk.textContent = text.slice(i, i + q.length);
        frag.appendChild(mk);
        findHits.push(mk);
        pos = i + q.length;
        i = lt.indexOf(lq, pos);
      }
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    });
    if (findHits.length) focusFindHit(0);
    findCount.textContent = findHits.length ? '1 / ' + findHits.length : '0';
  }
  function focusFindHit(i) {
    findIdx = (i + findHits.length) % findHits.length;
    findHits.forEach(function (m) { m.classList.remove('cur'); });
    var m = findHits[findIdx];
    if (m && m.scrollIntoView) m.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (m) m.classList.add('cur');
    findCount.textContent = (findIdx + 1) + ' / ' + findHits.length;
  }
  function openFind() {
    var n = getNote(ui.activeId);
    if (!n || n.deleted) { toast('Open a note first'); return; }
    if (n.locked && !unlockSess[n.id]) { toast('Unlock the note first'); return; }
    if (settings.view === 'edit') setView('split');
    findBar.hidden = false;
    findInput.focus();
    findInput.select();
    runFind();
  }
  function closeFind() {
    findBar.hidden = true;
    clearFindMarks();
    findCount.textContent = '';
  }
  findInput.addEventListener('input', queueFind);
  findInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); focusFindHit(findIdx + (e.shiftKey ? -1 : 1)); }
  });
  findNextBtn.addEventListener('click', function () { if (findHits.length) focusFindHit(findIdx + 1); });
  findPrevBtn.addEventListener('click', function () { if (findHits.length) focusFindHit(findIdx - 1); });
  findCloseBtn.addEventListener('click', closeFind);

  /* ---------- notebook insights ---------- */
  function noteWords(n) { return (String(n.body || '').trim().match(/\S+/g) || []).length; }
  function truncTxt(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }
  function kbFmt(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(1) + ' KB'; }

  function buildStats() {
    var live = notes.filter(function (n) { return !n.deleted; });
    var trashed = notes.length - live.length;
    var words = 0, chars = 0, withImages = 0, tags = {}, i, d;
    live.forEach(function (n) {
      words += noteWords(n);
      chars += String(n.body || '').length;
      if (String(n.body || '').indexOf('data:image') !== -1) withImages++;
      n.tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    var streak = journalStreak();
    var localBytes = JSON.stringify(notes).length;
    var histCount = 0, histBytes = 0;
    notes.forEach(function (n) {
      (n.history || []).forEach(function (h) { histCount++; histBytes += h.body.length; });
    });

    /* last 14 days of activity (created or last edited) */
    var days = [], dmax = 1;
    var start = new Date(); start.setHours(0, 0, 0, 0);
    for (i = 13; i >= 0; i--) {
      d = new Date(start); d.setDate(d.getDate() - i);
      var dEnd = new Date(d); dEnd.setDate(dEnd.getDate() + 1);
      var c = live.filter(function (n) {
        var t = Math.max(n.createdAt || 0, n.updatedAt || 0);
        return t >= d.getTime() && t < dEnd.getTime();
      }).length;
      if (c > dmax) dmax = c;
      days.push({
        label: d.toLocaleDateString([], { weekday: 'narrow' }),
        title: d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
        count: c
      });
    }

    /* notes created per month, last 6 months */
    var months = [], mmax = 1;
    for (i = 5; i >= 0; i--) {
      var m = new Date(start.getFullYear(), start.getMonth() - i, 1);
      var mNext = new Date(start.getFullYear(), start.getMonth() - i + 1, 1);
      var mc = live.filter(function (n) { var t = n.createdAt || 0; return t >= m.getTime() && t < mNext.getTime(); }).length;
      if (mc > mmax) mmax = mc;
      months.push({ label: m.toLocaleDateString([], { month: 'short' }), count: mc });
    }

    function bars(arr, max) {
      return arr.map(function (b, idx) {
        var pct = b.count ? Math.max(8, Math.round(b.count / max * 100)) : 3;
        var t = (b.title ? b.title + ' \u2014 ' : '') + b.count + ' note' + (b.count === 1 ? '' : 's');
        return '<div class="bar' + (idx === arr.length - 1 ? ' hot' : '') + '" title="' + escapeHtml(t) + '"><i style="height:' + pct + '%"></i></div>';
      }).join('');
    }
    function labels(arr) {
      return arr.map(function (b) { return '<span>' + escapeHtml(b.label) + '</span>'; }).join('');
    }

    var hero = [
      ['Notes', live.length.toLocaleString()],
      ['Words written', words.toLocaleString()],
      ['\uD83D\uDD25 Journal streak', streak > 0 ? streak + (streak === 1 ? ' day' : ' days') : '\u2014'],
      ['Tags in use', Object.keys(tags).length.toLocaleString()]
    ];

    var top = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a] || a.localeCompare(b); }).slice(0, 8);
    var tagHtml = top.length
      ? '<div class="stat-tags">' + top.map(function (t) {
          return '<span class="stat-tag">' + escapeHtml(t) + ' <b>' + tags[t] + '</b></span>';
        }).join('') + '</div>'
      : '<p class="stat-hint">No tags yet \u2014 add them with the tag chips above the editor.</p>';

    var oldest = null, longest = null;
    live.forEach(function (n) {
      if (!oldest || (n.createdAt || 0) < (oldest.createdAt || 0)) oldest = n;
      if (!longest || noteWords(n) > noteWords(longest)) longest = n;
    });
    var recs = [
      ['Longest note', longest ? truncTxt(longest.title || 'Untitled', 34) + ' \u00B7 ' + noteWords(longest).toLocaleString() + ' words' : '\u2014'],
      ['Average length', live.length ? Math.round(words / live.length).toLocaleString() + ' words per note' : '\u2014'],
      ['Oldest note', oldest ? new Date(oldest.createdAt || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ' \u00B7 ' + truncTxt(oldest.title || 'Untitled', 30) : '\u2014'],
      ['In trash', trashed ? trashed + ' note' + (trashed === 1 ? '' : 's') + ' (auto-deleted after 30 days)' : 'Empty \u2713']
    ];

    return (
      '<section class="set-sec"><div class="stat-cards">' +
        hero.map(function (h) { return '<div class="stat-card"><b>' + h[1] + '</b><span>' + escapeHtml(h[0]) + '</span></div>'; }).join('') +
      '</section>' +
      '<section class="set-sec"><h3>\uD83D\uDCCD Last 14 days</h3>' +
        '<div class="stat-chart">' + bars(days, dmax) + '</div>' +
        '<div class="stat-labels">' + labels(days) + '</div>' +
      '</section>' +
      '<section class="set-sec"><h3>\uD83D\uDCC8 Notes created \u00B7 last 6 months</h3>' +
        '<div class="stat-chart">' + bars(months, mmax) + '</div>' +
        '<div class="stat-labels">' + labels(months) + '</div>' +
      '</section>' +
      '<section class="set-sec"><h3>\uD83C\uDFF7\uFE0F Top tags</h3>' + tagHtml + '</section>' +
      '<section class="set-sec"><h3>\uD83C\uDFC5 Records</h3>' +
        '<div class="stat-rows">' + recs.map(function (r) {
          return '<div class="stat-row"><span>' + r[0] + '</span><b>' + escapeHtml(r[1]) + '</b></div>';
        }).join('') + '</div>' +
      '</section>' +
      '<section class="set-sec"><h3>\uD83D\uDDC4\uFE0F Storage</h3>' +
        '<div class="stat-bar"><i id="storeEstimateBar" style="width:0%"></i></div>' +
        '<p class="stat-hint" id="storeEstimate">Checking browser storage\u2026</p>' +
        '<p class="stat-hint">Notes stored in this browser: ' + kbFmt(localBytes) +
        (withImages ? ' \u00B7 ' + withImages + ' note' + (withImages === 1 ? '' : 's') + ' contain embedded images' : '') + '</p>' +
        '<p class="stat-hint">Version snapshots: ' + histCount + (histCount ? ' \u00B7 ' + kbFmt(histBytes) + ' (auto-pruned)' : '') + '</p>' +
      '</section>'
    );
  }

  function fillStorageEstimate() {
    var el = document.getElementById('storeEstimate');
    var bar = document.getElementById('storeEstimateBar');
    if (!el) return;
    if (!(navigator.storage && navigator.storage.estimate)) {
      el.textContent = 'This browser does not report storage usage.';
      return;
    }
    navigator.storage.estimate().then(function (est) {
      var used = est.usage || 0, quota = est.quota || 0;
      var pct = quota ? used / quota * 100 : 0;
      if (bar) bar.style.width = Math.min(100, pct).toFixed(1) + '%';
      el.textContent = 'Browser storage: ' + kbFmt(used) + ' used of about ' + kbFmt(quota) + ' available (' + pct.toFixed(pct < 1 ? 2 : 1) + '%)';
    }).catch(function () {
      el.textContent = 'Could not read storage usage in this browser.';
    });
  }

  function openStats() {
    statsBody.innerHTML = buildStats();
    statsOverlay.hidden = false;
    fillStorageEstimate();
  }
  function closeStats() { statsOverlay.hidden = true; }
  statsBtn.addEventListener('click', openStats);
  statsCloseBtn.addEventListener('click', closeStats);
  statsOverlay.addEventListener('click', function (e) { if (e.target === statsOverlay) closeStats(); });

  /* ---------- calendar view ---------- */
  var SIDE_MIN = 240, SIDE_MAX = 520;

  function calDayNotes(d) {
    var d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var d1 = d0 + 86400000;
    return notes.filter(function (n) {
      if (n.deleted) return false;
      var t = Math.max(n.createdAt || 0, n.updatedAt || 0);
      return t >= d0 && t < d1;
    });
  }
  function calGridHtml() {
    var m = ui.calMonth;
    var lead = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7; // Monday-first
    var count = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var html = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (w) {
      return '<span class="cal-cell cal-hd">' + w + '</span>';
    }).join('');
    for (var i = 0; i < lead; i++) html += '<span class="cal-cell cal-pad"></span>';
    for (var d = 1; d <= count; d++) {
      var dt = new Date(m.getFullYear(), m.getMonth(), d);
      var c = calDayNotes(dt).length;
      var cls = 'cal-cell cal-day' +
        (dt.getTime() === today.getTime() ? ' today' : '') +
        (ui.calDay && dt.getTime() === ui.calDay.getTime() ? ' sel' : '') +
        (c ? ' has' : '');
      html += '<button class="' + cls + '" data-day="' + d + '">' + d + (c ? '<i></i>' : '') + '</button>';
    }
    return html;
  }
  function clampCalSel() {
    if (ui.calDay && (ui.calDay.getFullYear() !== ui.calMonth.getFullYear() || ui.calDay.getMonth() !== ui.calMonth.getMonth())) ui.calDay = null;
  }
  function renderCalendar() {
    calTitle.textContent = ui.calMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });
    calGrid.innerHTML = calGridHtml();
    renderCalDay();
  }
  function renderCalDay() {
    if (!ui.calDay) {
      calDayBox.innerHTML = '<p class="cal-hint">Pick a day to see what you wrote that day.</p>';
      return;
    }
    var d = ui.calDay;
    var list = calDayNotes(d).slice().sort(function (a, b) {
      return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
    });
    var html = '<div class="cal-dayhead"><b>' + d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) + '</b></div>';
    html += list.length ? list.map(function (n) {
      var t = new Date(Math.max(n.createdAt || 0, n.updatedAt || 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return '<button class="cal-note" data-open="' + escapeHtml(n.id) + '">' + ICONS.file +
        '<span class="cal-note-t">' + escapeHtml(n.title || 'Untitled') + '</span>' +
        '<span class="cal-note-time">' + t + '</span></button>';
    }).join('') : '<p class="cal-hint">Nothing on this day yet.</p>';
    html += '<button class="btn small ghost cal-new" data-newday="1">' + ICONS.plusL + '<span>New entry for this day</span></button>';
    calDayBox.innerHTML = html;
  }
  function createCalEntry() {
    if (!ui.calDay) return;
    var title = ui.calDay.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var existing = null;
    notes.forEach(function (n) { if (!n.deleted && n.title === title) existing = n; });
    if (existing) { openNote(existing.id); renderCalendar(); return; }
    createNote({ title: title, tags: ['journal'], body: '# ' + title + '\n\n**Mood:**\n\n## Notes\n- \n\n## Free thoughts\n\n' });
    renderCalendar();
  }
  calViewBtn.addEventListener('click', function () {
    if (ui.cal && !ui.trash) { ui.cal = false; }
    else { ui.cal = true; ui.trash = false; }
    renderAll();
  });
  calPrevBtn.addEventListener('click', function () {
    ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() - 1, 1);
    clampCalSel(); renderCalendar();
  });
  calNextBtn.addEventListener('click', function () {
    ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + 1, 1);
    clampCalSel(); renderCalendar();
  });
  calTodayBtn.addEventListener('click', function () {
    var t = new Date();
    ui.calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
    ui.calDay = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    renderCalendar();
  });
  calGrid.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-day]') : null;
    if (!b) return;
    var d = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth(), +b.getAttribute('data-day'));
    ui.calDay = (ui.calDay && ui.calDay.getTime() === d.getTime()) ? null : d;
    renderCalendar();
  });
  calDayBox.addEventListener('click', function (e) {
    var o = e.target.closest ? e.target.closest('[data-open]') : null;
    if (o) { openNote(o.getAttribute('data-open')); closeMobileSidebar(); return; }
    if (e.target.closest && e.target.closest('[data-newday]')) createCalEntry();
  });

  /* ---------- help center ---------- */
  function openHelp() { helpOverlay.hidden = false; }
  function closeHelp() { helpOverlay.hidden = true; }
  helpBtn.addEventListener('click', openHelp);
  helpCloseBtn.addEventListener('click', closeHelp);
  helpOverlay.addEventListener('click', function (e) { if (e.target === helpOverlay) closeHelp(); });
  helpTabsEl.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-tab]') : null;
    if (!b) return;
    $$('#helpTabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
    $$('.help-pane', helpOverlay).forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-pane') === b.getAttribute('data-tab'));
    });
  });

  /* ---------------- boot ---------------- */
  function init() {
    $$('[data-icon]').forEach(function (el) {
      var ic = ICONS[el.getAttribute('data-icon')];
      if (ic) el.insertAdjacentHTML('afterbegin', ic);
    });
    loadSync();
    load();
    importSharedNote();
    if (settings.sideWidth) document.documentElement.style.setProperty('--side-w', settings.sideWidth + 'px');
    if (settings.sideCollapsed) document.body.classList.add('side-collapsed');
    updateSideNarrow();
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
    if (ver !== '14') {
      store.set(VER_KEY, '14');
      if (ver !== null) {
        setTimeout(function () {
          toast('\u2728 Jotter updated to v1.12 \u2014 folders feel natural: right-click (or long-press) a note for quick moves, plus a location bar above the list', { timeout: 8000 });
        }, 700);
      }
    }
  }

  init();
})();
