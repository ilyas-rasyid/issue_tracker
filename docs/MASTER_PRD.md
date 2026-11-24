# MASTER PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Mini Issue Tracker — MVP v1.0 (Frozen)

**Tanggal freeze:** 23 November 2026  
**Sumber keputusan:** Rangkaian PRD sampai v5.2  
**Status:** APPROVED / SCOPE FROZEN — Implementation pending technical validation  
**Pendekatan:** Foundation First + Vertical Slices  
**Batasan:** Dokumen perencanaan; tidak berisi implementasi aplikasi, migration yang dijalankan, atau hasil tes yang diklaim lulus.

---

## 1. Executive Summary

Mini Issue Tracker adalah aplikasi issue tracking publik dan portfolio fullstack untuk mencatat **Bug**, **Feature**, dan **Task** melalui satu board. Pengunjung dapat membaca issue dan diskusi. Pengguna terdaftar dapat membuat issue dan berkomentar setelah emailnya terverifikasi. Pengelolaan issue memakai prinsip _creator ownership_ tanpa Role-Based Access Control (RBAC).

**Tujuan produk:** menghadirkan alur issue-tracking yang nyata, mudah digunakan, terukur, aman, dan cukup ringkas untuk menunjukkan kompetensi React, Bun/Elysia, Prisma, PostgreSQL, file storage, autentikasi, transaksi, serta pengujian end-to-end.

**Kriteria sukses MVP:** semua user journey utama berjalan dari UI ke database, API konsisten, ownership terlindungi, concurrent mutation tidak menyebabkan lost update/duplikasi, upload aman, proses deletion/retention dapat diuji, dan desain memenuhi prinsip aksesibilitas.

### 1.1 Prinsip yang tidak boleh dilanggar

1. **Single Issue Board**; tidak ada Projects, Workspaces, maupun RBAC.
2. **Prisma constrained fields selalu `String`, tanpa blok `enum` Prisma**. Nilai valid berasal dari backend constants TypeScript `as const` dan divalidasi via Zod.
3. **Tanpa coding sebelum fase implementasi disetujui**. Master PRD ini adalah spesifikasi dan handoff.
4. **Developer Minimalist**, tanpa dekorasi, card, animasi, atau fitur kompleks yang tidak fungsional.
5. **Backend sebagai sumber kebenaran** untuk sesi, ownership, lifecycle, validasi, version, notification, dan data retention.
6. **MVP scope freeze**: fitur baru hanya masuk melalui persetujuan perubahan scope secara eksplisit.

## 2. Pengguna, Akses & Hak Tindakan

| Persona / state             | Browse issue/profil/diskusi/activity                | Create issue & add comment | Edit/delete own issue                                                                         | Edit/delete own comment                                              |
| --------------------------- | --------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Guest                       | Ya, pada konten publik aktif                        | Tidak                      | Tidak                                                                                         | Tidak                                                                |
| Login, email belum verified | Ya                                                  | Tidak                      | Mengikuti aturan ownership dan kebijakan aksi yang sudah dimiliki, tanpa membuka akses create | Mengikuti ownership dan lifecycle; tidak dapat membuat komentar baru |
| Login, email verified       | Ya                                                  | Ya                         | Ya; patuhi lifecycle                                                                          | Ya; patuhi lifecycle                                                 |
| Deleted account             | Tidak login; resource publik miliknya disembunyikan | Tidak                      | Tidak                                                                                         | Tidak                                                                |

**Authorization** selalu ditegakkan di API; UI guard hanya memberi pengalaman pengguna yang lebih baik. Hanya author issue boleh edit, mengubah status, mengelola attachment, atau delete issue. Penulis komentar hanya boleh edit/delete komentar miliknya sendiri. Komentar pada issue `CLOSED` tetap dapat dibaca; membuat/mengedit komentar dilarang, tetapi penulis tetap boleh soft-delete komentarnya sendiri. Issue `CLOSED` boleh dihapus oleh owner dan hanya bisa diedit lagi setelah Reopen.

## 3. Ruang Lingkup MVP dan Non-goals

**Termasuk:** registrasi/login dan verifikasi email; session management; forgot/reset password; public profile, settings, account deletion; Issue List & Kanban; pencarian/filter/sort; Create/Edit/Soft Delete Issue; guided status lifecycle; GFM Markdown; multi-image attachment; flat comments; Activity Timeline; notifikasi in-app; theme System/Light/Dark; responsive layout; retention/cleanup worker; tes, CI, dan dokumentasi.

**Tidak termasuk:** multiple projects/workspaces, RBAC, OAuth/SSO, nested comments, reaction, mentions, real-time sockets, email/push issue notifications, drag-and-drop status, AI features, file/video generic attachments, native mobile app, Redis/microservices, serta enterprise audit dashboard.

## 4. Domain Rules & Issue Lifecycle

### 4.1 Nilai domain dan defaults

| Field             | Nilai                                                                                  | Default                              |
| ----------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| Issue type        | `BUG`, `FEATURE`, `TASK`                                                               | Dipilih saat membuat issue           |
| Issue status      | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`                                            | `OPEN` oleh backend                  |
| Priority          | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`                                                    | `MEDIUM` oleh backend                |
| Activity event    | `ISSUE_CREATED`, `STATUS_CHANGED`, `TYPE_CHANGED`, `PRIORITY_CHANGED`, `COMMENT_ADDED` | Berdasarkan aksi                     |
| Attachment state  | `PENDING`, `READY`, `FAILED`                                                           | Alur upload                          |
| Notification type | `ISSUE_COMMENTED`                                                                      | Saat komentar orang lain ditambahkan |
| Token purpose     | `EMAIL_VERIFICATION`, `EMAIL_CHANGE`, `PASSWORD_RESET`                                 | Sesuai flow                          |

### 4.2 Matriks transisi

| Saat ini      | Target yang diperbolehkan |
| ------------- | ------------------------- |
| `OPEN`        | `IN_PROGRESS`             |
| `IN_PROGRESS` | `OPEN`, `RESOLVED`        |
| `RESOLVED`    | `IN_PROGRESS`, `CLOSED`   |
| `CLOSED`      | `OPEN` (_Reopen_)         |

Semua perubahan status dilakukan oleh owner melalui endpoint khusus, menggunakan `expectedVersion`. **Close memerlukan dialog konfirmasi; Reopen berlangsung langsung**. `CLOSED` mengunci edit issue, perubahan attachment, add/edit comment; tidak mengunci pembacaan, delete own comment, ataupun delete own issue. No-op status tidak menambah version dan tidak membuat activity.

## 5. Fitur Produk & UX

### 5.1 Public Issue Board

- Default desktop dan mobile: **List View**. Kanban tersedia melalui toggle.
- Filter yang didukung: status, type, priority, author/Created by Me; semua filter dapat digabungkan (_AND_).
- Search: title dan public issue key, debounce sekitar 350 ms, backend query.
- Sort: Newest (default), Oldest, Updated, Priority High→Low, Low→High.
- List: page-based pagination, ukuran 10 (default), 20, 50.
- Board: empat kolom status, masing-masing awalnya 10 issue dan `Load More` independen.
- URL query menyimpan filter/sort/page; preferensi view disimpan di `localStorage`; `view` pada URL mengoverride preferensi. Filter berubah → page/cursor direset.
- Tidak ada drag-and-drop status. Guest melihat data aktif saja.

### 5.2 Create Issue

Field: title (wajib 3–150 karakter), description raw Markdown (wajib 1–10.000 karakter), type (wajib), priority (opsional, default `MEDIUM`), status backend `OPEN`, author dari session. Form menolak unknown fields, `authorId`, `status`, `deletedAt` dari klien. Backend menghasilkan UUID internal dan public key `ISS-NNN`.

**Two-Step API, Single Submit UX:** frontend `POST /issues` dalam JSON dengan `clientRequestId`, terima key, lalu upload gambar terpilih secara berurutan melalui endpoint attachment. Jika upload gagal, issue tetap ada dan retry hanya file yang gagal; jangan membuat issue baru. Request create dengan hasil jaringan tidak pasti memakai `clientRequestId` lama saat rekonsiliasi.

### 5.3 Edit Issue

Owner boleh `PATCH` title, description, type, priority, minimal satu field. Field yang tidak dikirim tidak berubah; `null` tidak valid untuk empat field wajib. Semua update issue memakai `expectedVersion` dan conditional update atomik. Satu perubahan nyata menaikkan version sekali; type/priority changes membuat activity; edit title/description tidak membuat activity. No-op tidak mengubah timestamp atau version. Conflict → `409 VERSION_CONFLICT`, pertahankan perubahan lokal; tidak ada autosave.

### 5.4 Markdown

Deskripsi issue menggunakan GFM: heading, bold, italic, links, ordered/bullet lists, blockquotes, tables, checklists, fenced code blocks dengan syntax highlighting, tab Write/Preview. **Raw HTML tidak diizinkan** dan URL berbahaya tidak boleh dirender. Checklist pada preview bersifat baca saja. Comments menggunakan plain text, bukan Markdown editor.

### 5.5 Attachment

- Maksimum **5 gambar aktif atau pending per issue**; setiap gambar maksimum **5 MiB**; JPEG, PNG, WebP.
- File picker bisa memilih beberapa sekaligus; API upload **satu file per request**, sequential di UI dengan retry independen.
- Backend Upload Proxy Bun/Elysia; private S3-compatible storage; validasi ukuran, ekstensi, MIME, signature, image decoding/re-encoding, pembatasan resource, penghapusan metadata sensitif seperti EXIF.
- Backend tidak mempercayai nama atau MIME kiriman browser; storage key dibuat server.
- Status internal `PENDING` → `READY` / `FAILED`; quota menghitung PENDING dan READY; operasi reservasi slot harus atomic/locked terhadap request bersamaan.
- Preview melalui backend yang memeriksa issue masih aktif; URL objek private tidak diekspos. Attachment deleted langsung tidak dapat diakses; file fisik dipurge mengikuti retention.
- Orphan/uncommitted upload dibersihkan setelah sekitar 24 jam; storage failure ditangani retry tanpa transaksi PostgreSQL panjang.

### 5.6 Comments

- Komentar plain text 1–2.000 karakter; semua orang dapat membaca komentar pada issue aktif termasuk Closed.
- Login dan email verified diperlukan untuk membuat komentar; author dapat edit saat issue tidak Closed; author tetap dapat delete sendiri saat issue Closed.
- Delete komentar = soft delete, bukan hard delete langsung.
- Discussion tab default: **oldest first**, cursor + `Load More`, **20 komentar per batch**.
- Add comment dibuat satu transaksi dengan `COMMENT_ADDED` dan, bila commenter bukan owner, satu notification `ISSUE_COMMENTED`.
- Komentar tidak menaikkan `Issue.version`. Concurrent Close dan Add/Edit Comment harus diserialkan terhadap status issue.

### 5.7 Activity History

- Activity read-only; hanya backend yang membuat event, dalam transaksi bersama perubahan bisnis.
- Event: ISSUE_CREATED; STATUS_CHANGED; TYPE_CHANGED; PRIORITY_CHANGED; COMMENT_ADDED.
- Tidak menyimpan teks komentar, Markdown, email, alamat IP, password, token, atau user agent.
- Tab terpisah dari Discussion; **newest first**, cursor + `Load More`, **20 per batch**.
- Actor akun terhapus ditampilkan `Deleted User` tanpa link profil; Activity issue yang dihapus tidak dapat dibaca publik.

### 5.8 Notifications

- Bell pada topbar hanya untuk pengguna login. Trigger tunggal `ISSUE_COMMENTED` ketika **orang lain** mengomentari issue pemilik.
- Tidak ada notifikasi atas aksi sendiri, edit/hapus komentar, email issue alert, atau WebSocket.
- Notification Center menampilkan newest first, cursor + Load More, 20 per batch.
- Bell dibuka ≠ read. **Read hanya saat item diklik**; `Mark All as Read` tersedia. Klik membuka issue terkait.
- `commentId` unique untuk deduplikasi per komentar; backend memastikan recipient tidak dapat membaca data akun lain.
- Unread count endpoint terpisah, satu observer polling sekitar 60 detik saat tab aktif; list fetched saat bell dibuka. Hidden/deleted issue/comment tidak dihitung/ditampilkan.

### 5.9 Public Profile & Settings

- `/u/:username`: username, display name, avatar, bio opsional, GitHub URL opsional, join date, issue statistics dari issue aktif, daftar issue milik user.
- Email dan kredensial privat. Username **immutable** setelah register.
- Settings dalam satu halaman: Profile, Security, Danger Zone. Profile edit displayName (2–100), bio (maks 500), GitHub HTTPS URL, avatar.
- Avatar PNG/JPEG/WebP maks 2 MiB, backend proxy dan storage privat, metadata sensitif dibersihkan.
- Ganti email memerlukan password, email baru pending sampai terverifikasi, beri pemberitahuan ke email lama; password change memerlukan password lama dan rekey/revoke sesi sesuai kebijakan.
- Delete Account meminta password saat ini + mengetik `DELETE`, lalu langsung menyembunyikan akun/konten, mencabut sesi, mengikuti retention. Tidak ada restore akun di MVP.

## 6. Auth, Email Verification & Session

- Register username ASCII lowercase (3–30, huruf/angka/underscore), displayName 2–100, email valid maksimal 320, password 12–128.
- **Auto-login after registration:** backend membuat DB session, mengirim HttpOnly cookie; akun dapat browse namun Create Issue/Add Comment ditolak sampai email verified (`403 EMAIL_NOT_VERIFIED`).
- Email verification token acak, hashed, single-use, TTL 24 jam; resend cooldown minimal 60 detik plus rate limiting. Pengiriman email setelah DB commit; kegagalan provider tidak menghapus akun, tawarkan resend.
- Forgot Password selalu memberi respons generik; reset token hashed, single-use, TTL 30 menit; reset berhasil mencabut semua sesi, pengguna login ulang.
- Opaque session token disimpan sebagai hash di DB; cookie production `__Host-session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, tanpa Domain.
- Idle expiry 7 hari dan absolute expiry 30 hari. Polling/background requests tidak memperpanjang idle timeout. Pencabutan ditegakkan backend.
- Gunakan CSRF protections + Origin validation untuk state-changing cookie-auth requests, TLS, rate limits, logging aman, re-auth untuk sensitive actions.
- Session expired saat form diisi: jangan buang draft; login kembali, revalidate, lalu pengguna sendiri yang submit ulang. Draft teks boleh memakai `sessionStorage` maksimal 24 jam per akun (bukan untuk token/password). File mungkin perlu dipilih ulang setelah reload.
- Broadcast logout/signals antar tab tanpa membocorkan token; setelah logout/delete account, hapus private query caches.

## 7. Username Identity, Delete & Retention Policy

### 7.1 Username reservation

- Username immutable ketika akun aktif dan **tidak pernah digunakan kembali** setelah akun dihapus.
- Backend menormalisasi username, menghasilkan `usernameKey` HMAC-SHA256 menggunakan secret khusus. Kolom unique dan tetap dipertahankan pada User tombstone untuk reservasi permanen; username asli dikosongkan saat deletion.
- Fingerprint adalah **data pseudonim dengan pengecualian retensi permanen**, bukan anonimisasi mutlak. Harus diungkapkan di kebijakan privasi.
- HMAC key version/keyring harus menjaga pengecekan fingerprint versi lama. Karena raw username sudah dibuang, rotasi tidak dapat sekadar menghitung ulang semua fingerprint. Registrasi harus fail-closed jika keyring tidak dapat memastikan reservasi. Rotasi dan concurrency across versions wajib diuji.
- Email akun yang dihapus boleh digunakan untuk registrasi baru. Akun baru mendapat UUID baru, tanpa pemulihan issue/comment lama.

### 7.2 Account deletion transaction

Urutan konseptual: validasi sesi + password + `DELETE`; transaksi PostgreSQL dengan penguncian User; soft delete owned issues; soft delete authored comments pada issue lain; anonimisasi Activity actor; sembunyikan/bersihkan Notification terdampak; hapus identitas/kredensial selain reservation fingerprint; revoke sessions/tokens; isi `User.deletedAt`; commit; hapus cookie/cache dan jadwalkan cleanup storage avatar. Semua operasi pembuatan yang konkuren wajib menghormati state akun yang terhapus.

### 7.3 Content / audit retention

| Resource/kondisi                         | Akses publik                              | Cleanup                                                                                                        |
| ---------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Issue soft deleted                       | Hilang saat deletedAt                     | Purge title/description/attachment dan konten komentar terkait pada/ setelah 90 hari sejak efektif tersembunyi |
| Comment soft deleted sendiri             | Hilang saat deletedAt                     | Purge content setelah 90 hari dari Comment.deletedAt                                                           |
| Comment tersembunyi akibat issue deleted | Hilang saat Issue.deletedAt               | 90 hari dari tanggal pertama kali komentar tersembunyi; jangan reset saat account delete                       |
| IssueActivity pada deleted issue         | Tidak tersedia publik                     | Metadata terbatas sampai 365 hari dari Issue.deletedAt, lalu hard cleanup                                      |
| Activity di issue yang masih aktif       | Tetap publik tanpa aktor terhapus         | Mengikuti lifecycle issue, bukan otomatis 365 hari sejak actor delete                                          |
| Avatar akun terhapus                     | Langsung tak tersedia                     | Hapus fisik secepatnya dengan retry                                                                            |
| Username reservation HMAC                | Tidak publik                              | Permanen sebagai pengecualian yang terdokumentasi                                                              |
| Backups                                  | Tidak boleh membuka kembali data terhapus | Kebijakan backup terpisah; restore wajib rekonsiliasi deletion                                                 |

Gunakan `deletedAt` dan `purgedAt` untuk status lifecycle; `auditExpiresAt` pada aktivitas terkait deleted issue. **Jangan tandai `purgedAt` berhasil bila file fisik masih gagal dihapus.** Cleanup dijadwalkan setiap jam, batch sekitar 100, single active worker, idempotent, dry-run CLI, structured logs, retry dan alert ketika berulang gagal.

**Nuansa anonimisasi:** jika UUID internal, nomor publik, referensi storage, log, atau fingerprint masih dapat dihubungkan ke individu, klasifikasikan sebagai _pseudonymous_, bukan benar-benar anonymous. Technical gate harus memastikan identifier publik dan konten personal dihapus atau dilepas saat content purge sejauh memenuhi foreign key dan audit retention. Implementasi `issueNumber` nullable/sequence serta tombstone wajib divalidasi dengan Prisma/PostgreSQL. Jangan menganggap snippet schema sebelumnya valid tanpa migrasi nyata.

## 8. Backend Data Model & Integrity

**Persis delapan model**: `User`, `Session`, `AuthToken`, `Issue`, `IssueAttachment`, `Comment`, `IssueActivity`, `Notification`.

| Model           | Data inti                                                                                                                                        | Constraint / concern                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| User            | id, username?, usernameKey, email?, passwordHash?, displayName?, emailVerifiedAt?, deletedAt?                                                    | Unique usernameKey, email/username aktif; identity scrub |
| Session         | id, userId, hashed token, expiry, absoluteExpiry, revokedAt                                                                                      | Hashed session; revocation; indexes                      |
| AuthToken       | id, userId, tokenHash, purpose String, pendingEmail?, expiresAt, usedAt                                                                          | Single use, indexed expiry                               |
| Issue           | id, issueNumber, authorId?, title, description, type/status/priority String, version, clientRequestId, requestFingerprint, deletedAt?, purgedAt? | Sequence unique; OCC; idempotency; retention             |
| IssueAttachment | id, issueId, storageKey, file metadata, status String, deletedAt?, purgedAt?                                                                     | Unique storageKey, quota & lifecycle                     |
| Comment         | id, issueId, authorId?, content, clientRequestId, requestFingerprint, deletedAt?, purgedAt?                                                      | Deduplication, 90-day purge                              |
| IssueActivity   | id, issueId, actorId?, eventType String, oldValue?, newValue?, auditExpiresAt?                                                                   | Read only, no comment contents                           |
| Notification    | id, recipientId, actorId?, issueId, commentId? unique, type String, readAt?                                                                      | Recipient isolation, hidden targets                      |

Foreign keys dan inverse relations wajib valid. `SetNull` hanya untuk FK nullable, `Restrict` pada relasi yang tidak boleh hilang sebelum cleanup, cascade hanya jika memang aman. Soft delete **tidak** memicu referential action; application service wajib melakukan de-link dan hiding secara eksplisit.

Keputusan issue number: nomor `ISS-NNN` harus monoton secara alokasi dan tidak didaur ulang. Desain final penomoran yang kompatibel dengan penghilangan public identifier pada content purge adalah **technical validation gate**, bukan alasan mengganti public API contract.

## 9. API-Wide Contract

### 9.1 Format dan keamanan

- Prefix `/api/v1`; JSON sukses `{ "data": ... }`, page pagination `{ "data": [], "meta": {"page","limit","total","totalPages"} }`, cursor pagination `{ "data": [], "meta": {"limit","hasMore","nextCursor"} }`.
- `204 No Content` untuk operasi sukses tanpa body.
- Error RFC 9457 Problem Details (`application/problem+json`) dengan `type`, `title`, `status`, `detail`, `code`, `requestId`, dan `errors` pada validation error.
- Semua waktu ISO 8601 UTC (`Z`); UUID untuk id internal; issue key publik `ISS-NNN`.
- GET hanya untuk baca; POST create/command, PATCH perubahan parsial, DELETE soft delete atau perintah penghapusan sesuai kontrak.
- Input unknown fields ditolak; body ownership dan system fields tidak dipercaya.
- Protected response `Cache-Control: no-store`, CSP/Referrer-Policy/nosniff dan same-origin reverse proxy; strict ownership dan CSRF backend.
- GET retry maksimal **dua kali** hanya untuk network error atau kegagalan sementara (5xx terpilih) dengan exponential backoff; 401/403/404/409/422 tidak retry; 429 hormati Retry-After. Semua **mutations tidak automatic retry**.

### 9.2 Endpoint index

| Method | Path (prefix `/api/v1`)                | Auth                        |
| ------ | -------------------------------------- | --------------------------- |
| GET    | `/issues`                              | Public                      |
| GET    | `/issues/board`                        | Public                      |
| GET    | `/issues/:key`                         | Public, active only         |
| POST   | `/issues`                              | Verified user               |
| PATCH  | `/issues/:key`                         | Issue owner                 |
| PATCH  | `/issues/:key/status`                  | Issue owner                 |
| DELETE | `/issues/:key`                         | Issue owner                 |
| GET    | `/issues/:key/attachments`             | Public, active only         |
| POST   | `/issues/:key/attachments`             | Issue owner                 |
| GET    | `/issues/:key/attachments/:id/content` | Public, active/READY only   |
| DELETE | `/issues/:key/attachments/:id`         | Issue owner                 |
| GET    | `/issues/:key/comments`                | Public                      |
| POST   | `/issues/:key/comments`                | Verified user               |
| PATCH  | `/comments/:id`                        | Comment author, not Closed  |
| DELETE | `/comments/:id`                        | Comment author, even Closed |
| GET    | `/issues/:key/activities`              | Public, active only         |
| GET    | `/notifications`                       | Auth recipient              |
| GET    | `/notifications/unread-count`          | Auth recipient              |
| PATCH  | `/notifications/:id/read`              | Auth recipient              |
| POST   | `/notifications/mark-all-read`         | Auth recipient              |
| POST   | `/auth/register`                       | Guest                       |
| POST   | `/auth/login`                          | Guest                       |
| POST   | `/auth/logout`                         | Auth                        |
| GET    | `/auth/me`                             | Auth                        |
| POST   | `/auth/verify-email`                   | Token-based                 |
| POST   | `/auth/resend-verification`            | Account/token flow          |
| POST   | `/auth/forgot-password`                | Public                      |
| POST   | `/auth/reset-password`                 | Token-based                 |
| GET    | `/users/:username`                     | Public active profile       |
| GET    | `/users/:username/avatar`              | Public active profile       |
| PATCH  | `/account/profile`                     | Auth                        |
| PUT    | `/account/avatar`                      | Auth                        |
| DELETE | `/account/avatar`                      | Auth                        |
| POST   | `/account/change-email`                | Auth + re-auth              |
| POST   | `/account/verify-email`                | Token-based                 |
| POST   | `/account/change-password`             | Auth + old password         |
| DELETE | `/account`                             | Auth + password + `DELETE`  |

`/issues/board` adalah endpoint khusus yang harus didaftarkan agar tidak tertukar dengan route dinamis `:key`. Spesifikasi detail request-response per endpoint dari PRD v3.x–v4.x tetap berlaku ketika tidak bertentangan dengan dokumen final ini.

### 9.3 Core error codes

`VALIDATION_ERROR`, `UNAUTHORIZED`, `SESSION_EXPIRED`, `EMAIL_NOT_VERIFIED`, `NOT_ISSUE_OWNER`, `NOT_COMMENT_OWNER`, `ISSUE_NOT_FOUND`, `COMMENT_NOT_FOUND`, `ISSUE_CLOSED`, `INVALID_STATUS_TRANSITION`, `VERSION_CONFLICT`, `ATTACHMENT_LIMIT_REACHED`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `INVALID_IMAGE`, `STORAGE_UNAVAILABLE`, `USERNAME_UNAVAILABLE`, `INVALID_CURSOR`, `NOTIFICATION_NOT_FOUND`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`, `INTERNAL_ERROR`.

Mapping contoh: invalid payload 422; missing access 401/403 atau 404 untuk resource privat sesuai konteks; invalid status/version/idempotency key reuse 409; oversized upload 413; unsupported type 415; rate limit 429. Auth error jangan membocorkan keberadaan akun.

## 10. Concurrency, Idempotency & Transaction Rules

**Issue OCC:** `Issue.version` dimulai dari 1. Edit/Status change harus mengirim `expectedVersion`; conditional update atomik dan increment satu kali jika berubah; mismatch `409 VERSION_CONFLICT`. Edit title, type, priority, description dan status termasuk perubahan issue; komentar tidak menaikkan version. No-op tidak mencatat activity.

**Create idempotency:** `clientRequestId` UUID wajib pada Create Issue dan Create Comment. Unique constraint pada tabel masing-masing + `requestFingerprint` payload ternormalisasi dan target issue untuk komentar. Replay dengan same user/key/payload mengembalikan resource yang tersedia (`200`); key reused dengan payload berbeda → `409 IDEMPOTENCY_KEY_REUSED`. Setelah data asal dipurge, jaminan replay tidak berlaku. Jangan mengekspos resource akun lain atau deleted resource saat replay. Unique insert dan penanganan konflik harus safe terhadap concurrent requests.

**Atomic DB transactions:** issue creation+activity; comment creation+activity+notification; status update+activity; edit issue+relevant activity; delete account+anonymize/revoke. **DB transactions tidak boleh terbuka selama network I/O S3/email**. Attachment menggunakan DB reservation → storage → DB finalize dan cleanup compensation. Polling notification tidak memperbarui idle session.

## 11. UI/UX System Specification

- **Developer Minimalist:** indigo primary `#4F46E5`; Geist Sans; JetBrains Mono untuk issue key/code; customized shadcn/ui; Lucide; no navigation sidebar.
- **Light/Dark/System**, System default, override localStorage; semantic tokens, WCAG 2.2 AA, contrast 4.5:1 teks normal dan 3:1 komponen relevan.
- `max-width: 1200px`; breakpoint mobile `<640px`, tablet `640–1023px`, desktop `≥1024px`.
- **Balanced Compact:** issue list row sekitar 52px; input desktop 40px; primary touch buttons minimal 44px di mobile; internal gap/padding umum 12–16px.
- Desktop Issue Detail **dua kolom**: main content fleksibel di kiri, metadata/owner actions kanan sekitar 288px, gap 24px. Mobile menjadi satu kolom.
- Public board default **List View**; Kanban toggle, mobile Kanban horizontal scroll-snap. No drag/drop status.
- Discussion default tab, Activity tab terpisah. Markdown read-only rendering aman. Notification center popover desktop/panel mobile.
- Confirmation only on Close, Delete Issue, Delete Comment (ringan), dan Delete Account (password+DELETE), tidak tiap perubahan status.
- Button/input/modal/tab/attachment/notification states: default, hover/focus, disabled, loading/error, success serta empty/skeleton; feedback dekat konteks.
- Form tidak autosave; dirty-state warning dan draft recovery terbatas. Konflik tidak menghilangkan perubahan lokal.
- Reduced-motion respected; focus visible, keyboard support, dialog focus management, screen reader labels, tidak ada horizontal overflow tidak disengaja.
- Lighthouse target evaluasi halaman publik: Performance ≥90, Accessibility ≥95 dalam kondisi test terdokumentasi; ini target _proposed_, bukan hasil pengujian.

### 11.1 Route frontend

`/`, `/issues/:key`, `/issues/new`, `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/u/:username`, `/settings`, `*`.

Auth guard: guest ke login dengan return URL internal yang aman; unverified ke arahan verification; verified dapat menjalankan create actions. Semua guard akhir tetap di backend.

## 12. Nonfunctional Requirements

**Security:** password Argon2id; hashed opaque session/token, CSRF, XSS-safe Markdown, attachment defense in depth, origin checks, same-origin reverse proxy, no sensitive data in logs, protected private response, no hardcoded secrets, rate limiting pada auth/attachments/comments/sensitive endpoints.

**Reliability:** retry rules, rollback/compensation, idempotency, optimistic concurrency, event creation transactional, row locking pada issue/comment close, single active cleanup worker, recovery setelah backup restore.

**Performance:** avoid duplicate fetching, query keys memuat filter, server-side pagination, stale time baseline issue ~30s, profile 2m, auth 1m, notification count 60s, background polling off; route lazy-loading dan thumbnail loading seperlunya.

**Developer experience:** monorepo satu repository, `.env.example` tanpa secrets, reproducible local Docker Compose, strict TS, lint/format/typecheck, automated CI, seed data realistis, README dan API contract.

## 13. Technical Architecture & Repository

**Frontend:** React + TypeScript + Vite + Tailwind + customized shadcn/ui + Lucide + React Router + TanStack Query + React Hook Form + Zod.  
**Backend:** Bun + Elysia + Prisma + PostgreSQL; modular monolith; runtime requires compatible Prisma PostgreSQL driver adapter if Prisma 7 selected.  
**Supporting services:** private S3-compatible storage, email adapter, cron-scheduled Bun cleanup worker.  
**Local:** Docker Compose PostgreSQL + MinIO/S3-compatible test storage + Mailpit; run Bun API and Vite frontend locally.

Repository conceptual:

```text
mini-issue-tracker/
  fe/src/{app,pages,features,components,lib,styles}/
  be/prisma/{schema.prisma,migrations}/
  be/src/{config,commons,modules,jobs,generated}/
  packages/api-contract/          # Generated contract types if selected in setup
  .github/workflows/
  docker-compose.yml
  .env.example
  README.md
```

Within a module: routes, schema, service, constants, mapper, test. Repository abstraction optional only where queries genuinely benefit. Backend creates validation and business constants; generated API types do not become duplicate domain source of truth.

## 14. Acceptance Criteria — Functional (Given / When / Then)

| ID    | Given / When                                         | Then (wajib lulus)                                                                   |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| AC-01 | Guest opens board                                    | Active issues visible; deleted issues absent                                         |
| AC-02 | Guest opens issue detail                             | Description, public attachments, Discussion, Activity visible if issue active        |
| AC-03 | Search + filters + sort used                         | Backend applies combined filters correctly and URL represents state                  |
| AC-04 | Switch List ↔ Kanban                                 | Filter/sort preserved, preference stored, URL override honored                       |
| AC-05 | List pagination changed                              | 10/20/50 page sizes and stable result counts                                         |
| AC-06 | Kanban Load More in one column                       | Other columns' cursors remain untouched                                              |
| AC-07 | Register valid new account                           | Account, session cookie, verification state returned; auto-login                     |
| AC-08 | Login unverified                                     | Browse allowed; Create Issue/Add Comment return 403 EMAIL_NOT_VERIFIED               |
| AC-09 | Email verified                                       | Interactive rights activated without registering again                               |
| AC-10 | Forgot password for existing/nonexisting email       | Indistinguishable public response                                                    |
| AC-11 | Valid password reset                                 | Token single-use; all prior sessions invalid                                         |
| AC-12 | Session idle/absolute expiration reached             | 401; user must log in again; no background renewal                                   |
| AC-13 | Logout in tab A                                      | Tab B updates auth state; backend refuses revoked session                            |
| AC-14 | Create valid issue                                   | Generates unique `ISS-NNN`, OPEN status, author from session, ISSUE_CREATED activity |
| AC-15 | Create issue with invalid or unknown fields          | 422; no partial resource                                                             |
| AC-16 | Concurrent Create Issue with same request UUID       | Exactly one issue/activity; replay returns same active resource                      |
| AC-17 | Create key reused with different payload             | 409 IDEMPOTENCY_KEY_REUSED                                                           |
| AC-18 | Issue edited by non-owner                            | Denied by backend                                                                    |
| AC-19 | Two edits use same expectedVersion                   | Exactly one succeeds; loser gets 409 VERSION_CONFLICT                                |
| AC-20 | Edit changes type and priority                       | Both activities created in same transaction; version increment once                  |
| AC-21 | PATCH values unchanged                               | No new activity or version increment                                                 |
| AC-22 | Status transition invalid                            | 409 INVALID_STATUS_TRANSITION                                                        |
| AC-23 | Close issue                                          | Confirmation shown and backend locks new content/edit                                |
| AC-24 | Reopen closed issue                                  | Moves to OPEN without confirmation; editing reenabled                                |
| AC-25 | Owner deletes Closed issue                           | Allowed with confirmation; public resource disappears                                |
| AC-26 | Up to five images uploaded                           | Format/size/quota validated; private storage; previews available while active        |
| AC-27 | Concurrent upload near quota                         | Cannot exceed 5 active+pending attachments                                           |
| AC-28 | Upload fails after issue creation                    | Issue remains; retry per file does not recreate issue                                |
| AC-29 | Deleted attachment content URL requested             | Content inaccessible immediately                                                     |
| AC-30 | Verified user adds comment                           | Comment + activity + owner notification (if another user) transactionally            |
| AC-31 | Concurrent comment creation same UUID                | One comment/activity/notification only                                               |
| AC-32 | Comment submitted while Close races                  | No comment committed after Closed transition is effective                            |
| AC-33 | Author edits own comment on active issue             | Allowed; updatedAt, Edited indicator                                                 |
| AC-34 | Author deletes own comment on Closed issue           | Soft delete succeeds despite Closed                                                  |
| AC-35 | Commenter is issue owner                             | No self-notification                                                                 |
| AC-36 | Discussion Load More                                 | Oldest first, 20 per batch, stable cursor                                            |
| AC-37 | Activity Load More                                   | Newest first, 20 per batch, no sensitive content                                     |
| AC-38 | Bell opened                                          | Unread not automatically marked read                                                 |
| AC-39 | Notification clicked                                 | Mark read and open issue; counts update                                              |
| AC-40 | Mark all read executed                               | Only eligible existing notifications read; new arrivals remain unread                |
| AC-41 | Profile opened                                       | Only public fields and stats from active issues                                      |
| AC-42 | Profile PATCH tries username/email/password hash     | Disallowed; username immutable                                                       |
| AC-43 | Delete Account wrong password or wrong DELETE phrase | Rejected; database unchanged                                                         |
| AC-44 | Delete Account succeeds                              | Sessions revoked, public profile/own issues/own comments hidden, identity scrubbed   |
| AC-45 | New registration with deleted username               | Always denied with USERNAME_UNAVAILABLE                                              |
| AC-46 | New registration with previously deleted email       | Allowed as distinct new account, no restoration                                      |
| AC-47 | Repeated cleanup execution                           | Idempotent; no broken FK or public exposure                                          |
| AC-48 | Content first becomes hidden                         | Purge eligible at 90 days, not extended by later deletion                            |
| AC-49 | Deleted issue audit reaches 365 days                 | Expired audit and tombstone removed according to retention                           |
| AC-50 | Old backup restored                                  | Deletion reconciliation prevents resurfacing of purged content                       |

## 15. Acceptance Criteria — Security, UX & Quality

| ID    | Gate / bukti                                                                                |
| ----- | ------------------------------------------------------------------------------------------- |
| QA-01 | Prisma schema validates, generates client, migrates cleanly in PostgreSQL, no `enum` blocks |
| QA-02 | All constrained string values use backend constants + Zod; invalid values rejected          |
| QA-03 | Ownership/recipient isolation tested by cross-user API requests                             |
| QA-04 | CSRF and origin protections verified for cookie-auth state-changing endpoints               |
| QA-05 | Session, reset, verification tokens never exposed in responses/logs/storage plaintext       |
| QA-06 | Upload validation rejects disguised, malformed, oversized or unsupported images             |
| QA-07 | Public attachment access denied after resource deletion; no storage keys leaked             |
| QA-08 | Transaction rollback covers activity/notification failure and concurrent requests           |
| QA-09 | Sanitized Markdown rejects malicious URLs/raw HTML and handles long code blocks             |
| QA-10 | Mobile tested for no unintended overflow, 44px controls, keyboard and focus                 |
| QA-11 | Light/Dark/System tokens and statuses remain understandable without color alone             |
| QA-12 | Initial/empty/error/permission/Closed/conflict states exist per page                        |
| QA-13 | Form drafts survive recoverable session expiry; are cleared on intentional logout           |
| QA-14 | TanStack Query does not duplicate requests unnecessarily; polling limited to active tab     |
| QA-15 | CI runs typecheck, lint, unit, integration, build, E2E smoke; results documented            |
| QA-16 | Cleanup dry-run, retry, lock, storage failures and HMAC keyring loss tested                 |
| QA-17 | Deployment secrets separated from repo; backup and restore procedures documented            |
| QA-18 | README explains setup, architecture, decisions, limitations and demos with real seed data   |

## 16. Milestone Handoff — Foundation First + Vertical Slices

| Milestone                | Delivery (end-to-end)                                                                                                                       | Exit gate / artefak                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| M0 Foundation            | Bun workspaces; Vite app shell; Elysia server; env validation; Docker PostgreSQL/MinIO/Mailpit; Prisma client; global errors; design tokens | Project boots locally; health/readiness; migration smoke; base CI |
| M1 Auth                  | Register/auto-login, verification/resend, login/logout, session, password reset, guarded UX                                                 | Auth/session/security integration and unverified tests pass       |
| M2 Public Board          | Issue read APIs, List/Kanban, filter/search/sort, URL state, page/cursor pagination                                                         | Guest journey, query behavior, desktop/mobile UI pass             |
| M3 Issue Core            | Create/Edit/Delete, GFM, Issue Detail, lifecycle, OCC, create idempotency                                                                   | AC-14–25, conflict and race tests pass                            |
| M4 Discussion & Activity | Comment CRUD/soft delete, activity timeline, transactional records, comment idempotency                                                     | AC-30–37 and Closed race tests pass                               |
| M5 Attachments           | Backend proxy, reservation, private storage, previews, retry, delete                                                                        | AC-26–29, quota race, orphan/storage fail tests pass              |
| M6 Notifications         | Bell/popover, unread count, read/mark-all, cursor, polling                                                                                  | AC-35, 38–40, dedup/privacy tests pass                            |
| M7 Profile & Account     | Public profile, Settings, avatar, email/password changes, delete account                                                                    | AC-41–46, anonymization and revocation tests pass                 |
| M8 Retention & Hardening | 90/365-day worker, dry-run, storage lifecycle, audit expiry, HMAC rotation/fail-closed, backup reconciliation                               | AC-47–50, QA-16–17 pass                                           |
| M9 Release               | Playwright E2E, a11y/performance review, CI, README, deployment/monitoring docs                                                             | QA-01–18 completed; release checklist signed off                  |

**Definition of Done per milestone:** route + DB/query + validation/auth + UI + loading/error states + relevant tests + documentation/contract updates. Tidak boleh menutup milestone hanya karena happy path UI berhasil.

## 17. Technical Validation Gates (Tidak Mengubah Scope)

**TV-01 Prisma schema, sequence & identifiers:** pilih implementasi yang benar-benar tervalidasi untuk sequence `ISS-NNN`, soft-deleted issue tombstone, serta pemutusan identifier publik setelah content purge. Uji nullable fields, constraints, FK/inverse relations, dan SQL migration. `prisma validate`, `prisma generate`, migrate on actual PostgreSQL.

**TV-02 HMAC key rotation:** tata cara versioning/keyring, multi-version lookup, concurrency saat rotasi, fail-closed bila secret hilang, dan pengecualian retensi permanen.

**TV-03 Cleanup 90/365:** uji tanggal pertama konten tersembunyi, audit expiry, file delete success/failure, partial cleanup, orphan files, storage versioning, backup restore reconciliation, clock-controlled testing.

**TV-04 Idempotency & concurrent mutations:** race 100 request dengan key sama, key payload mismatch, request outcomes unknown, deleted account replay, concurrent Close + Create Comment, simultaneous upload quota, Account deletion vs create/upload.

**TV-05 API/schema conformance:** semua response/error code mengacu satu contract; generated client types tidak menduplikasi backend constants; auth restrictions dan user-facing draft recovery sesuai PRD.

**TV-06 Scope confirmation only if needed:** jika detail teknis terbukti mustahil dengan batas delapan tabel, ajukan _change request_ yang spesifik dengan tradeoff dan tes dampak. Jangan mengubah scope secara diam-diam.

## 18. Delivery Artifacts & Change Control

Dokumen handoff implementasi yang harus dihasilkan bertahap (bukan hasil yang sudah ada sekarang):

1. `MASTER_PRD_Mini_Issue_Tracker_v1.0.md` (dokumen ini, frozen).
2. API contract/OpenAPI atau bentuk typed specification yang selaras dengan endpoint index.
3. `schema.prisma` lengkap + migration history tervalidasi, tanpa enum Prisma.
4. Decision log/ADR untuk HMAC keyring, idempotency, retention, dan penomoran issue.
5. Test plans dan CI reports per milestone.
6. `.env.example`, Docker Compose, README, setup/deployment, backup/restore and cleanup runbook.
7. Release checklist yang menunjuk AC/QA yang benar-benar lulus.

**Change control:** perubahan aturan produk sesudah freeze harus menyebut keputusan yang berubah, alasan, dampak API/database/UI, migrasi jika ada, compatibility, tes yang perlu diperbarui, dan versi PRD berikutnya. Bug fix/penyesuaian implementasi yang tidak mengubah observable product contract tidak memerlukan perubahan scope.

## 19. Final Sign-off

**Produk dan desain:** DISETUJUI / FROZEN.  
**Arsitektur dan kontrak API:** BASELINE DISETUJUI.  
**Metode delivery:** Foundation First + Vertical Slices.  
**Prisma schema dan migration:** BELUM DIUJI; technical gate wajib.  
**Kinerja, keamanan, E2E, cleanup:** TARGET PENGUJIAN, bukan klaim hasil.  
**Tahap berikutnya:** implementation handoff dan M0 Foundation **hanya bila pengguna mengizinkan mulai coding**.

---

### Referensi teknis (di luar keputusan produk)

- Prisma ORM v7 client setup: https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/introduction
- Prisma v7 PostgreSQL drivers: https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- RFC 9457 Problem Details: https://www.rfc-editor.org/rfc/rfc9457
