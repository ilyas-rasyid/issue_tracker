# IssueTrack — Fullstack Mini Issue Tracker

A single-board public issue tracker built with **React, Vite, Bun, Elysia, Prisma 7, PostgreSQL, private S3-compatible storage, and database sessions**. UI follows `DESIGN.md` instead of the generic AI-generated SaaS template.

> **Project status:** complete source starter aligned to the frozen Master PRD, **not yet certified production-ready**. Generated Prisma client, DB migrations, integration tests and a real build must run on a machine with Bun and network access. See `AGENTS.md` for validation gates.

## Source layout (refactored)

The app follows the project organization demonstrated in the user-supplied frontend/backend reference ZIPs. It does **not** copy their business logic or add unnecessary abstractions. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for every folder and its responsibility.

- **Frontend:** `app/` (router/providers), `features/` (issues, auth, comments, notifications, etc.), `shared/` (API types/components), `styles/` (nine readable feature stylesheets).
- **Backend:** `commons/`, `security/`, `infrastructure/`, `features/<domain>/handler|service`, and `jobs/`.
- **Formatting:** `.prettierrc.json`, `.editorconfig`, and VS Code/Antigravity format-on-save configuration.

```bash
bun install
bun run format          # Prettier formatting, including JSX/CSS
bun run format:check    # Fails if source is not formatted
```

**Important:** The bundled files have been structurally formatted offline; run the bundled Prettier after `bun install` for canonical formatting. `bun run build` is **not** proof that the server, DB, or storage is configured or running.

## Quickstart (Ubuntu/Linux/macOS)

Install Bun and Docker first, then:

```bash
cp apps/api/.env.example apps/api/.env
# EDIT apps/api/.env — generate unique SESSION_SECRET and USERNAME_HMAC_KEYS
bun install
docker compose up -d
bun run db:generate
bun run db:migrate
bun run dev:api
# separate terminal:
bun run dev:web
```

- Web: http://localhost:5173
- API: http://localhost:3001/api/v1/health
- Local MinIO console: http://localhost:9001 (bucket initialization runs in Compose)
- Mailpit inbox: http://localhost:8025 (real reset/verification emails are caught here, not delivered externally)

**Build (after dependency installation):**

```bash
bun run build
```

Build **does not start the application, create the database, or migrate PostgreSQL**. Run `docker compose up -d` and `bun run db:migrate` for full functionality. Build generates Prisma Client, compiles Vite and transpiles Bun API. The built web output is `apps/web/dist`; the API development entrypoint is `apps/api/src/server.ts`.

## Commands

| Command                | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `bun run dev:api`      | Start Elysia server (port 3001)                                |
| `bun run dev:web`      | Start Vite with `/api` proxy (port 5173)                       |
| `bun run db:generate`  | Generate Prisma 7 client                                       |
| `bun run db:migrate`   | Run initial development migration                              |
| `bun run db:deploy`    | Apply already committed migrations in production               |
| `bun run db:seed`      | Optional local verified account, requires `SEED_DEMO_PASSWORD` |
| `bun run build`        | Compile frontend and API                                       |
| `bun run typecheck`    | Check TypeScript                                               |
| `bun run test`         | Run Bun unit tests                                             |
| `bun run cleanup:dry`  | Preview 90/365-day cleanup                                     |
| `bun run cleanup`      | Execute retention worker once                                  |
| `bun run check:slop`   | Source-based anti-AI-slop checks                               |
| `bun run format`       | Apply Prettier to handwritten source                           |
| `bun run format:check` | Verify formatting across repository                            |

### Production environment

Set a real HTTPS `APP_ORIGIN`, strong per-environment `SESSION_SECRET`, dedicated username HMAC keyring, managed Postgres, private S3-compatible storage with versioning lifecycle, an SMTP provider, reverse-proxy upload size limits, and a cron scheduler for `bun run cleanup`. Never reuse development credentials or push `.env` to Git.

For the username HMAC keyring, e.g. `USERNAME_HMAC_KEYS=v2=<long-new-secret>,v1=<retained-old-secret>`. **Keep old secrets** while reservations generated from them exist; otherwise previously registered names could accidentally become available. Treat fingerprints as pseudonymous information retained indefinitely by explicit policy.

## Product highlights

- Public, single-board List (default) + optional Kanban with URL filters and persisted view.
- Ownership-only mutations, verified email for Create Issue/Create Comment; guided issue state transitions.
- GFM Markdown issue descriptions and plaintext comments.
- PostgreSQL transaction-backed issue/comment creation with Activity History and notifications.
- Optimistic version concurrency on Issue; `clientRequestId` deduplication for Create Issue and Comment.
- S3-compatible private images via Elysia proxy: PNG/JPEG/WebP, 5 × 5 MiB, server-side decode/normalize.
- HttpOnly DB sessions (7-day idle / 30-day absolute), CSRF + origin validation, Argon2id passwords.
- Soft deletion, 90-day content purge, 365-day deleted-issue audit cleanup, anonymized account deletion.
- Light/Dark/System UI with compact 52px issue rows, no marketing hero, no imaginary metrics.

## Manual E2E walkthrough

1. `bun run db:migrate` and open Mailpit.
2. Register an account; you should be logged in immediately but unable to create issue before verification.
3. Open the email from Mailpit and verify.
4. Create an issue, upload up to five images, change status, add a comment from another verified account.
5. Observe notification on original owner; click to mark read.
6. Close issue (confirmation), attempt comment (should be blocked), reopen.
7. Open two tabs of the same issue: editing with an old version must return `409`.
8. Delete a comment or account and confirm public content disappears immediately.
9. Use `bun run cleanup:dry` to preview storage/DB retention work without modifying data.

## Architecture notes & limitations

- Exactly **eight Prisma models**, with **no Prisma enum blocks**; constrained string values are constants in `apps/api/src/lib/core.ts` and validated with Zod.
- Process-local rate limiting is suitable for a single API process. Distributed deployment needs centrally coordinated enforcement.
- External storage and SQL cannot share a transaction: uploads use DB reservation, object write, DB finalization and retry/cleanup.
- Failed email delivery leaves an account with a resend path; SMTP is not a transactional resource.
- Privacy retention and backup lifecycle need validation against actual regulatory/operational requirements.
- Issue numbers come from an explicit PostgreSQL sequence and become `NULL` on 90-day content purge; numbers are never reused. The custom sequence and nullable `dbgenerated` default must be checked against Prisma migrations before deployment.
- The initial generated-schema strategy requires the local Prisma 7 toolchain; do not assume a source draft proves successful migration.
- Do not claim all tests pass until dependencies are installed and all verification commands are actually run.

## Design sources / anti-slop references

The **original project design** in `DESIGN.md` draws review heuristics from public GitHub lists; their skills/scripts are _not_ copied or executed:

- https://github.com/nyrthoughts/anti-slop-design
- https://github.com/muris11/anti-ai-slop
- https://github.com/wpgaurav/design-slop

See `AGENTS.md` and `.gemini/GEMINI.md` for AI agent handoff instructions.

### One-script local bootstrap

If Bun and Docker are already installed, run `bash scripts/bootstrap.sh` to install dependencies, start local infrastructure, generate Prisma Client, apply migrations, and build. This is a convenience command; it does not replace setting secure production secrets or the full release test suite.

### Browser smoke tests

With the API and Docker services running, install Playwright's browser (`bunx playwright install chromium`) and run `bun run test:e2e`. The bundled tests cover basic navigation, login entry, query state, and theme persistence; critical concurrent mutation and retention tests remain separate manual/integration release gates.

### Agent QA handoff

For Antigravity/Gemini, open `GEMINI_HANDOFF.md`. It explicitly requires dependency installation, Prisma validation and real builds before claiming success. The repository also contains a project-specific `.gemini/skills/issuetrack-anti-slop/SKILL.md` for targeted UI review.

### Retention scheduler example

Execute `bun run cleanup` every hour from a cron or managed scheduler; never run the cleanup command concurrently outside its PostgreSQL advisory-lock boundary. Use `bun run cleanup:dry` first. Backup retention and any object versions must be reconciled separately.
