# Architecture & File Responsibilities

This structure follows the **organizational pattern** of the two user-provided references (`fe(8).zip` and `be_sekolah.zip`). Their business logic, dependencies, database model, and UI were **not copied**. Mini Issue Tracker remains a compact single-board product.

## Frontend — `apps/web/src`

```text
app/
  router/AppRoutes.tsx           Routes and authentication guards
  query/query-client.ts         One TanStack Query client and retry policy
  layouts/AppHeader.tsx         Shared top navigation
  components/ThemeSwitcher.tsx  System/light/dark selection
  providers/SessionProvider.tsx Browser session state
features/
  auth/pages/                   Login, register, verify, reset screens
  issues/pages/                 Board, detail, create/edit form
  issues/components/            Issue-focused components
  comments/components/          Issue discussion
  activities/components/        Read-only activity timeline
  attachments/components/       Image management
  notifications/components/     Bell and notification center
  users/pages/                  Public developer profile
  account/pages/                Profile/security/deletion settings
shared/
  api/client.ts                 HTTP, CSRF and error adaptation
  api/types.ts                  Public client data types
  api/query-keys.ts             Consistent query key naming
  api/format.ts                 Display formatting/labels
  components/ui/                Reusable controls, one component per file
  components/markdown/          GFM rendering/editor
styles/
  tokens.css                    Theme tokens
  base.css                      Typography & reset
  layout.css                    Header, page layout, buttons
  board.css                     List & Kanban
  issue-detail.css              Detail, discussion & activity
  forms.css                     Forms and Markdown editor
  feedback.css                  Dialogs, notices, skeletons
  account.css                   Login, profile, settings
  responsive.css                Breakpoints and reduced motion
main.tsx                        App bootstrap only
```

Page modules should compose other components rather than contain all their implementation. Keep the UI compact: no promotional hero, fake dashboard, glassmorphism, or purple gradients.

## Backend — `apps/api/src`

```text
commons/
  constants/domain.constants.ts  String + TypeScript constants; NO Prisma enums
  validation/schemas.ts         Zod request schemas
  errors/                       AppError + Problem Details
  pagination/                   Opaque cursors and page parameters
  mappers/                      Public identity DTOs
  security/crypto.ts            Hashes, opaque tokens, username fingerprint
  utils/                        Time and public issue identifiers
security/
  csrf.ts                       Cookie settings, CSRF validation
  session.ts                    Login session checking
  rate-limit.ts                 Lightweight limiter
infrastructure/
  database/prisma.ts            Prisma Client singleton
  database/locks.ts             Transactional row locks
  email/mailer.ts               Email provider adapter
  storage/object-storage.ts     S3 operations
  storage/image-processing.ts   Image validation and conversion
features/
  auth/handler/                 HTTP auth routes
  auth/service/                 Verification/reset token workflows
  issues/handler/               Separate read and write route groups
  issues/service/               Issue queries + response mapping
  comments/handler/             Comment routes, permission checks
  activities/handler/           Read-only history
  attachments/handler/          Upload proxy and file serving
  notifications/handler/        Bell, unread, read actions
  account/handler/              Settings/deletion routes
  users/handler/                Public profile + avatar endpoints
jobs/retention.ts               Scheduled cleanup CLI
lib/                           Small compatibility re-export barrels only
server.ts                       Elysia initialization and global middleware
```

### Rules for every new file

1. Prefer a single named responsibility; no multi-feature mega-pages or files with hundreds of compressed operations.
2. **Target <=300 handwritten source lines per file**. If it grows, split by domain behavior, never artificially split a function just to hit a number. Generated Prisma files are excluded.
3. No mass one-line JSX, route chains, or CSS selectors; run `bun run format` after edits and `bun run format:check` before handoff.
4. Backend owns permissions, input constraints, and domain constants. Do not move ownership logic into frontend alone.
5. No Prisma enum. No new role/workspace/projects. Keep the frozen Master PRD scope.
6. Every external I/O or mutation must have explicit success, error, and authorization behavior.
7. Preserve the existing API paths and shapes when refactoring; add tests for behavioral changes.

### Build / runtime validation

These files were reorganized and statically parsed in an environment without Bun or npm registry network access. Do not interpret static validation as a successful Prisma migration or production build. Run the commands in `GEMINI_HANDOFF.md` on the developer workstation before declaring the build ready.
