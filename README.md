# ZChat

**Private & encrypted messenger** — end-to-end encryption (E2EE), real-time chat, voice/video calls, and multi-device sync via Supabase.

ZChat is a web-based messenger focused on privacy: messages can be encrypted client-side (P-256-ECC + AES-GCM), avatars and keys sync by user ID (not username), and optional passcode lock protects the session.

---

## Features

- **End-to-end encryption** — client-side E2EE with Safety Number + QR verify / scan
- **Real-time messaging** — Supabase Realtime (insert / update / delete)
- **1:1 conversations** — stable `conversations` UUID (username changes do not break history)
- **Self-notes** — chat with yourself (`saved_<user_id>`)
- **Images** — PNG/JPEG upload to Supabase Storage (`chat-images`), auto-compress over 50MB
- **Reply / edit / delete** — reply quotes, edit text, delete for everyone
- **Disappearing messages** — 10s / 1m / 10m / 24h
- **Screenshot block** (per chat, best-effort)
- **Voice & video calls** — WebRTC + signaling server
- **Verified badge** — blue tick from `users.is_verified`
- **Passcode lock** — 4-digit app lock (server-backed), re-prompt after 50 hours
- **i18n** — English, Vietnamese, Chinese, Russian
- **Themes** — dark / light
- **Pin conversations** — local pin order in the chat list
- **Search** — conversation list + in-chat message search
- **Bug reports** — `report.html` embeds a Tally form

---

## Stack

| Layer | Tech |
|--------|------|
| Frontend | HTML, Tailwind CSS, Lucide icons |
| Logic | Vanilla JavaScript (modular files) |
| Backend / DB | [Supabase](https://supabase.com) (Auth-related flows, Postgres, Storage, Realtime) |
| E2EE | Web Crypto API (`js/e2ee.js`) |
| Calls | WebRTC + Socket.IO signaling |
| Forms | [Tally](https://tally.so) embed on the report page |

---

### Chat app modules (`js/`) — load order

Scripts for the main chat UI are split into small files. **Load in this order** (after `auth.js` / `e2ee.js` if used):

| # | File | Description |
|---|------|-------------|
| 01 | `i18n.js` | EN / VI / ZH / RU strings + verified badge SVG |
| 02 | `utils.js` | Pure helpers: `uid`, `escapeHtml`, timestamps, avatar colors |
| 03 | `identity-conversations.js` | User UUID cache, `conversations` CRUD, `state`, self-notes chat |
| 04 | `dom-refs.js` | Shared `getElementById` refs + edit/reply mode ids |
| 05 | `ui-helpers.js` | Confirm modal, Lucide icons, image lightbox, local avatar sync |
| 06 | `auth-flow.js` | Register / login UI, `enterApp()`, recovery password modal |
| 07 | `avatar-pin-clear.js` | `avatarHtml()`, pin chats, clear conversation (DB + UI) |
| 08 | `chat-list-render.js` | Sidebar list, select chat, mark as read |
| 09 | `edit-reply.js` | Edit mode, reply prefix parse/build, scroll-to + shake |
| 10 | `toast-info.js` | Toasts, copy message, message info panel |
| 11 | `message-menu-delete.js` | ⋮ menu (reply/edit/copy/info/delete) + delete on server |
| 12 | `render-messages.js` | Message bubbles, Seen on last own message only, reply UI |
| 13 | `disappearing-screenshot.js` | Auto-delete timers + screenshot protection |
| 14 | `info-search.js` | Contact info drawer + search inside active chat |
| 15 | `safety-number.js` | Safety Number modal: My Code / Scan Code, mark verified |
| 16 | `disappearing-menu-ui.js` | Disappearing-timer dropdown + clear button wiring |
| 17 | `composer.js` | Composer send, auto-resize, emoji picker |
| 18 | `new-chat.js` | New conversation modal + resolve user / conversation id |
| 19 | `messages-io.js` | Load history, encrypt on send, insert into `messages` |
| 20 | `chat-image-upload.js` | Image accept/compress/upload to `chat-images` bucket |
| 21 | `realtime.js` | Realtime INSERT/UPDATE/DELETE handlers |
| 22 | `bootstrap.js` | **Last**: `enterApp` if logged in, subscribe realtime, icons |

```html
<!-- Example at bottom of index.html -->
<script src="js/auth.js"></script>
<script src="js/e2ee.js"></script>
<script src="js/i18n.js"></script>
<script src="js/utils.js"></script>
<!-- … 03 → 21 … -->
<script src="js/bootstrap.js"></script>
<script src="js/webrtc.js"></script>
```

---

## Supabase (high level)

Typical tables / storage used by the app:

| Resource | Role |
|----------|------|
| `public.users` | Username, recovery password, avatar fields, `public_key` / `private_key`, `is_verified` |
| `public.conversations` | 1:1 room id; `user_1` / `user_2` (UUID); self-notes `saved_<user_id>` |
| `public.messages` | `chat_id`, `sender_id` (UUID), `content` (plain or E2EE payload), `read_at` |
| `public.passcode` | App lock passcode per `user_id` |
| Storage `chat-images` | Paths under **sender user id** (stable when username changes) |

RLS policies and RPCs (e.g. `register_user`, `get_or_create_conversation`, `clear_conversation`) should match your deployment. Do not overwrite E2EE keys on login if keys already exist on the server — that would break old ciphertext.

---

## Local development

1. Clone the repo and serve static files (any static server or GitHub Pages).
2. Configure Supabase URL + anon key in `auth.js` (or your env injection).
3. Ensure Storage bucket `chat-images` is public (or adjust signed URLs).
4. Optional: set signaling URL for calls (`localStorage.zchat_signal_url` or `window.ZCHAT_SIGNAL_URL`).

Open `index.html` in a modern browser (Web Crypto + Realtime required).

---

## Security notes

- **Private keys** are stored on the server in `users.private_key` for multi-device decrypt. Treat RLS and access control carefully; this is a hybrid model, not pure device-only Signal-style storage.
- Always prefer **read-existing-keys** on login; only **generate + insert** keys when the account has none.
- Message identity uses **`sender_id` (UUID)**, not username, so renames do not orphan history.
- Passcode is separate from recovery password; recovery password is shown once at registration.

---

## License

Copyright © 2026 ZChat. All rights reserved.
Unauthorized copying, modification, or distribution of this software is strictly prohibited.

---

## Contributing / bugs

Use in-app **Report a bug** (`report.html`) or open a GitHub Issue.
