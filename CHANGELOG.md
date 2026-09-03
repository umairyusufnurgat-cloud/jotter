# Changelog

## v1.8 — note graph & find in note

- 🕸 **Note graph** — your whole notebook as a living map: every note is a bubble (bigger = more `[[wiki-links]]`), every link a connection. It's a real force-directed physics simulation in pure SVG — drag bubbles around and watch them settle, scroll to zoom, drag the background to pan, double-click to re-fit, click a bubble to open the note. Open it with the **Note graph** button under *Today's journal* or via `Ctrl`+`K`
- 🔍 **Find in note** — `Ctrl`+`F` now highlights every match in the rendered preview with a match counter and Enter/Shift+Enter to jump between them; the sidebar search stays on `/`

## v1.7 — version history & share-as-link

- 🕰 **Version history** — Jotter snapshots the note you're editing automatically (at most one every ~10 minutes, only when something changed). Open *More ▾ → Version history* to browse the last 10 versions, preview any of them rendered, and restore in one click — restoring saves a snapshot of the current state first, so it's always undoable. Snapshots travel with backups and sync, and total snapshot storage is capped (~1.5 MB, oldest pruned first)
- 🔗 **Share a note as a link** — *More ▾ → Share as link* copies a URL that carries the whole note inside it; anyone who opens it (on any device, no account needed) gets a copy saved to their Jotter. Text notes only — image-heavy notes are redirected to Backup/Sync
- 📊 Insights now show how many version snapshots are stored and how much space they use

## v1.6 — sidebar overhaul, calendar, fixes

- 🐛 **Fixed the accent-colour menu** opening partly off the left edge of the screen (same root cause as the v1.5 Backup-menu fix — menus now anchor to their full button row)
- 🐛 **Fixed the squeezed sidebar header** — the brand row now fits all six buttons at the default width, and compresses gracefully when you drag narrower
- 📏 **Resizable & hideable sidebar** — drag its right edge to any width (240–520px, remembered); double-click the edge, press `Ctrl`/`⌘`+`\` or click the ☰ toolbar button to hide it completely for full-width writing
- 🗓 **Calendar view** — third tab in the sidebar bottom: a month grid with a dot on every day you wrote something; click a day to see that day's notes or start a dated journal entry (counts toward your 🔥 streak)

## v1.5 — insights & Backup-menu fix

- 🐛 **Fixed the Backup menu** opening partly off the left edge of the screen — footer menus now anchor to the full footer row, so they can never clip
- 📊 **Notebook insights** — new 📊 button in the sidebar (also via `Ctrl`+`K`): total notes & words written, 🔥 journaling streak, a 14-day activity chart, notes-created-per-month chart, top tags, records (longest/oldest/average), and storage usage with a live browser-storage bar

## v1.4 — playground & images

- 🎓 **Markdown playground template** — *New note ▾ → Markdown playground* creates a live, editable note demonstrating every single feature: text formatting, escapes, headings, clickable task lists, nested lists, quotes, code blocks, tables with alignment, wiki-links (real and dashed), embedded images, and timestamps — plus a checklist of things to try
- 🖼 **Paste screenshots into notes** — `Ctrl`/`⌘` + `V` embeds clipboard images (auto-resized to max 1200px, stored locally in the note, never uploaded); drag & drop image files works too
- ⏱ `Ctrl`/`⌘` + `;` inserts a timestamp (date + time) — great for journals and logs
- 🛡 Storage-quota detection — if the browser ever runs out of space, you get a clear warning instead of a silent failure
- 🔒 Markdown renderer now allows `data:image/…` URLs for images only (links stay strictly sanitised)
- 🩹 Help center updated: new buttons-guide rows, v1.4 in What's new; SW bumped to v5

## v1.3 — help center & fixes

- 🩹 Fixed the accent-colour menu (it opened off-screen, so clicking the droplet appeared to do nothing)
- 🩹 Fixed the Outline button (an inverted condition meant it never opened)
- 📖 **Built-in Help & guide** — press `?` (or the ? icon in the sidebar): three tabs covering a getting-started guide, a reference for what every button does, and the version history
- ⌨️ New shortcut: `?` opens help; the command palette gained a Help action
- 🩹 Service worker bumped to v4

## v1.2 — sync & focus

- ☁️ **GitHub Gist sync** — free private cloud for your notes, stored as a secret gist on your *own* GitHub account. Paste a gist-scope token in Settings, then sync manually or enable auto-sync. Notes merge with newest-edit-wins, and "delete forever" travels between devices via tombstones
- 📑 **Outline** — new toolbar button lists every heading in the note; click one to jump straight to it
- 🧘 **Focus mode** — `Ctrl`/`⌘` + `.` hides everything but your words. `Esc` brings the app back
- 🏷️ **Tag tools** — right-click any tag chip in the sidebar to rename it or remove it from all notes (with confirm)
- 🔍 **Search highlighting** — matches are marked in the notes list as you type
- 📱 **Real PNG icons** (192/512) — proper install prompts on Android/iOS
- 🩹 Misc: snippets no longer leak `>` quote markers; palette gained settings / outline / focus / sync actions

## v1.1 — the power update

- ⌘ **Command palette** — press `Ctrl`/`⌘` + `K` to fuzzy-search every note or run any action (new note, templates, theme, backup, import, empty trash, switch view…) from one place
- 🔗 **Wiki-links** — type `[[` in the editor to link to another note by name, with an autocomplete popup. Clicking a link opens the note, or **creates it** if it doesn't exist yet (dashed underline = not created yet)
- 🧩 **Note templates** — the New note button is now a split button: ▾ offers Today's journal, Meeting notes, Reading notes, Project plan, and Brain dump
- 🔥 **Journaling streak** — the Today's journal button shows a 🔥 streak counter once you write 2+ days in a row
- 📥 **Import Markdown files** — via the Import menu, or just **drag & drop** `.md` / `.txt` files onto the app (`.json` drops restore a backup)
- 📤 **Export all notes as one Markdown file** — perfect for migrating or printing your whole notebook
- 🎨 **Six accent colours** — droplet icon in the sidebar (indigo, teal, blue, rose, green, amber)
- 📱 **Floating "+" button** on mobile for one-tap new notes
- 🔄 **"Update ready" prompt** — the app now tells you when a new version is deployed, with a one-click reload
- 🩹 Service worker is now network-first, so updates apply immediately; offline still fully works
- ✍️ Fresh installs get an updated welcome note that demos wiki-links

## v1.0 — initial release

- Markdown editor with split preview and interactive task lists
- Tags, pin/star, instant search, three sort modes
- Today's journal with a dated template
- Trash with 30-day recovery
- JSON backup & restore, single-note `.md` export, copy markdown
- Light/dark themes, keyboard shortcuts, print-to-PDF styles
- PWA: installable + offline via service worker
- Zero dependencies, no build step
