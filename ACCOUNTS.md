# Jotter Accounts — Design Considerations

**Status: thinking out loud (v1.10). Nothing here is built, shipped, or promised.**
Jotter today is a zero-dependency, static PWA: HTML + CSS + vanilla JS on GitHub Pages,
data in `localStorage`, optional private sync via a GitHub gist. There is no server of ours
in the loop — and that is a feature worth protecting.

This document is where we think through what "creating your own account" would mean
before writing a single line of backend code.

---

## What an account would be *for*

A Jotter account is only worth having if it gives something the gist sync can't:

1. **Multi-device sync that "just works"** — no PAT, no settings screen ceremony.
2. **A home for locked notes** — end-to-end-encrypted (E2E) storage where the server
   never sees plaintext or the PIN (the crypto from v1.10 is the foundation: notes are
   already AES-256-GCM blobs *before* any server gets involved).
3. **Identity & continuity** — one login, your notes follow you across browsers/devices,
   with trash and version history intact.

## Non-goals (standing decisions)

- No tracking, no analytics, no ads — an account must not change Jotter's privacy posture.
- No lock-in: export-everything (markdown / JSON) must always work without an account.
- The app stays fully usable offline with `localStorage` only; an account is an *enhancement*,
  never a requirement.
- Keep the zero-dependency front end. Vanilla JS, no frameworks.

---

## Option analysis

| # | Approach | How it works | Pros | Cons |
|---|----------|--------------|------|------|
| 1 | **"Jotter account via GitHub"** (formalize what exists) | Keep gist sync; brand it as an account. Add a friendly PAT setup flow, maybe a tiny deep-link into GitHub's token page | Zero new infrastructure; ships in a day; user keeps full control of their data | Not really an account; no email/password; GitHub-only audience; PAT expiry friction |
| 2 | **OAuth device flow + tiny relay worker** | A ~100-line Cloudflare Worker holds an OAuth app secret; the app shows "enter code JX4K2Q at jotter.app/link"; worker exchanges the code for a token that lets the *browser* talk to GitHub directly | Real sign-in feel; secret never lives in the app; still no server-side user data | Needs a domain + a Worker we operate; GitHub account still required underneath |
| 3 | **WebAuthn / passkeys (device-local identity)** | Use the platform authenticator as "who you are" on this device; combine with per-device sync keys | Modern, phishing-resistant, no passwords, no backend for auth itself | Device-bound: doesn't travel between devices by itself; really a *lock*, not an *account* |
| 4 | **Hosted BaaS (Supabase / Firebase)** | Classic auth (email magic links, Google sign-in) + a hosted DB; locked notes stored as ciphertext rows | Fastest path to "real" accounts; polished auth UI out of the box | A third-party dependency and a data processor enter the picture; free tiers have limits; the "no deps" ethos erodes |
| 5 | **Self-hosted sync server (Cloudflare Workers + D1/KV)** | We write a small E2E sync API: accounts = email + passphrase, keys derived client-side (same PBKDF2/AES-GCM code as locked notes), server stores only ciphertext + metadata | True E2E accounts; no third party; ~free at Jotter's scale; we own the roadmap | We now run infrastructure (uptime, abuse, password resets are *impossible* by design — support burden); most work of all options |

## How they stack up

- **Soonest value:** Option 1 — it's mostly wording and onboarding polish.
- **Best effort/ownership ratio:** Option 2 — small step, big UX win over raw PATs.
- **Most "real":** Option 5 — the only one that is a genuine Jotter account with E2E,
  but it means operating a service.

## Recommended phases

1. **Phase A (now):** v1.10 locked notes land the *client-side crypto foundation* —
   PBKDF2 → AES-256-GCM, non-extractable keys, PIN never stored. Any future account
   builds on exactly this primitive. Meanwhile, keep GitHub sync as the de-facto cloud.
2. **Phase B:** Option 2 — device-flow OAuth relay on a Worker, making GitHub sign-in
   feel like an account ("Sign in with GitHub" → code → done). No new data flows through us.
3. **Phase C:** Option 5 — a self-hosted E2E sync service (email + passphrase, server
   stores ciphertext only) for people who don't want to depend on GitHub at all.
   Locked notes sync *as-is* because they're already encrypted client-side.

## Open questions

- Password/PIN reset for an E2E account is mathematically impossible — do we accept
  "your key is your key" with very clear warnings (as locked notes already do)?
- Do we ever want *sharing* between accounts? (Locked notes can't be shared as links
  today; account-to-account sharing of ciphertext is possible but needs key wrapping.)
- Export/import as the universal escape hatch — keep it first-class forever?

---

*Last revisited in v1.10. This file exists so the decision is made deliberately, not by drift.*
