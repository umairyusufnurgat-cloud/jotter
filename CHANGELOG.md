# Changelog

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
