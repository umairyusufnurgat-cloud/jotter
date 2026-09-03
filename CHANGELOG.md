# Changelog

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
