# Mini Issue Tracker — Architecture and Ownership

This layout follows the **organization principles in `contoh_fe(2).zip` and `contoh_be(2).zip`** rather than copying their school-domain implementation. The workspace roots are deliberately named **`fe/` and `be/`**.

## Repository

```text
mini-issue-tracker/
├── fe/                       # React + Vite (standalone frontend)
│   ├── src/
│   │   ├── app/              # Global providers, layout, TanStack Query
│   │   ├── routes/           # React Router route table and access guards
│   │   ├── features/         # UI and business interactions grouped by feature
│   │   │   ├── issues/
│   │   │   │   ├── pages/     # Route-level page composition
│   │   │   │   ├── components/# Pure visual sections; no unrelated operations
│   │   │   │   ├── hooks/     # Query, form, draft, upload orchestration
│   │   │   │   ├── schemas/   # Validation for forms
│   │   │   │   ├── types/     # Feature-specific types
│   │   │   │   └── constants/# Sorting and UI choices
│   │   │   ├── comments/     # Comment UI + useComments hook
│   │   │   ├── account/      # Profile, Security, Delete Account separated
│   │   │   ├── auth/
│   │   │   ├── activities/
│   │   │   ├── attachments/
│   │   │   ├── notifications/
│   │   │   ├── users/
│   │   │   └── projects/     # Present in uploaded latest source; see scope note
│   │   ├── shared/           # Reusable HTTP client, types, utilities and basic UI
│   │   ├── styles/           # Scoped CSS split into sub-300-line files
│   │   └── main.tsx
│   └── tests/
├── be/                       # Bun + Elysia (standalone backend)
│   ├── prisma/               # Schema, migrations, seed (source of truth)
│   ├── src/
│   │   ├── commons/          # Typed constants, Zod schemas, errors, utilities
│   │   ├── security/         # Authentication session, CSRF, rate limit
│   │   ├── infrastructure/   # Prisma client, PostgreSQL locks, mail, storage
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── handler/   # Session, registration and password routes
│   │   │   │   └── service/   # One-time auth token and delivery logic
│   │   │   ├── issues/
│   │   │   │   ├── handler/   # Create, read, update, status and delete routes
│   │   │   │   └── service/   # Issue read/query and response mapping
│   │   │   ├── comments/
│   │   │   ├── account/
│   │   │   ├── activities/
│   │   │   ├── attachments/
│   │   │   ├── notifications/
│   │   │   ├── users/
│   │   │   └── projects/
│   │   ├── jobs/             # Retention cleanup CLI, not a web route
│   │   └── server.ts
│   └── tests/unit/
├── scripts/                  # Maintenance and structural audits
├── docs/                     # Product PRD and developer notes
├── .prettierrc.json
├── .editorconfig
├── .vscode/settings.json
├── AGENTS.md
├── GEMINI_HANDOFF.md
└── package.json              # Bun workspaces: fe + be
```

## File responsibility rules

| Layer | Allowed responsibility | Must not contain |
|---|---|---|
| FE page | Compose feature sections and loading/error state | Huge data mutation + complex uploader + giant JSX |
| FE component | Render one interactive surface | Unrelated pages and domain workflows |
| FE hook | Own feature state, React Query, or form workflow | Large decorative JSX trees |
| FE service | Call a typed API endpoint | React markup, global layout |
| FE schema/type | Form validation, TypeScript contracts | Network requests |
| BE handler | Elysia route + request/response boundary | Several unrelated domains in one file |
| BE service | Business rules, orchestration, transactions | Frontend UI or CSS |
| BE repository | Complicated/reusable persistence queries **when needed** | Business UI, unnecessary wrappers |
| BE payload | Validation and request/response shapes | Persisted state mutation |
| Infrastructure | External integrations or database setup | HTTP feature routing |

The reference backend has `handler / service / repository / payload`. **Do not create a repository just to forward one query**. Split substantial logic out of route handlers into services as the code evolves, keeping behavior and tests intact. `commons` owns business constants and cross-cutting validation; there is no generic `lib/core.ts` mega-export.

## Formatting contract

- **All handwritten `.ts`, `.tsx`, `.css` files must be under 300 lines.** Generated Prisma output is exempt and gitignored.
- Format with **Prettier**, 2 spaces, 100-column target, LF endings; nested JSX attributes and conditional bodies should be multiline.
- Use braces for all `if`, `for`, `while`, and `else` branches; do not squeeze bodies after control statements.
- Root `.prettierrc.json`, `.editorconfig` and `.vscode/settings.json` are committed. `bun run format` and `bun run format:check` are mandatory once dependencies are installed.
- `bun run check:structure` checks folder names, file size, local imports, collapsed JSX returns, and forbidden Prisma enums.
- `bun run build` is **not yet verified** in this environment; run it on a machine with Bun and dependencies.

## Scope consistency note

The **uploaded `mini-issue-tracker.zip` contains a `Project` Prisma model, projects endpoints, and projects UI**. It therefore has **9 Prisma models**, unlike the earlier 8-model single-board Master PRD. This refactor preserves the latest uploaded source to avoid silently deleting functionality or changing migrations. Resolving this PRD-vs-source difference is a **separate product decision**, not a folder/formatting change. Do not make the difference worse or add new modules without approval.
