# Mini Issue Tracker

Developer-focused issue tracker with a React + Vite frontend, Bun + Elysia backend, Prisma/PostgreSQL database, and private object storage.

## Root folder structure

```text
mini-issue-tracker/
├── fe/             # frontend
├── be/             # backend
├── docs/           # PRD and architecture
├── scripts/        # audit, bootstrap, etc.
├── .prettierrc.json
├── .editorconfig
├── .vscode/
├── AGENTS.md
├── GEMINI_HANDOFF.md
├── package.json
└── docker-compose.yml
```

Folder ownership, FE/BE feature examples, and conventions are in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The layout follows **`contoh_fe(2).zip` and `contoh_be(2).zip`** at the architectural level, not the school domain.

## Setup (requires Bun, Docker, network to install packages)

```bash
cp be/.env.example be/.env
# Fill in the local configuration and secrets in be/.env
bun install
bun run check:structure
bun run format
bun run format:check
bun run db:generate
bun run typecheck
bun run build
```

To run the app locally:

```bash
docker compose up -d
bun run db:migrate
bun run dev:api
# Second terminal
bun run dev:web
```

Open `http://localhost:5173`, API health at `http://localhost:3001/api/v1/health`, Mailpit at `http://localhost:8025`.

## Primary commands

| Script                    | Purpose                                 |
| ------------------------- | --------------------------------------- |
| `bun run dev:web`         | Vite dev frontend (`fe`)                |
| `bun run dev:api`         | Elysia dev backend (`be`)               |
| `bun run build`           | Generate Prisma client, build FE and BE |
| `bun run typecheck`       | Check both TypeScript projects          |
| `bun run test`            | Backend Bun unit tests                  |
| `bun run test:e2e`        | Playwright browser smoke tests          |
| `bun run db:generate`     | Generate Prisma client locally          |
| `bun run db:migrate`      | Apply development migration             |
| `bun run cleanup:dry`     | Inspect retention cleanup               |
| `bun run check:structure` | Guard folder layout and file size       |
| `bun run format`          | Apply canonical Prettier formatting     |
| `bun run format:check`    | Verify Prettier formatting              |

## Code standards

- **FE**: `app`, `routes`, `features`, `shared`, feature-specific `components / hooks / services / schemas / types`.
- **BE**: `commons`, `security`, `infrastructure`, `features`, separate route groups/handler and service/repository when applicable.
- Max **300 handwritten lines per TS/TSX/CSS file**, enforced by `bun run check:structure`.
- Prettier config at root: 2-space indent, 100 print width, multiline JSX, `formatOnSave` supported in Antigravity/VS Code.
- No Prisma enums; constrained data values are backend constants.
- No generic AI-dashboard decoration. See `DESIGN.md`.
- Do not include `.env`, `node_modules`, generated Prisma client, or `dist` in Git.

## Scope note from the supplied source

The uploaded `mini-issue-tracker.zip` contains a **Project** feature and a corresponding Prisma table, for **9 models total**. The earlier frozen Master PRD had 8 models and a single board. Since this request is to fix folder organization/formatter **without deleting code**, that preexisting Project functionality has been preserved. The difference is documented and should be addressed separately only with explicit approval.

## Verification status

The refactor passed offline **source syntax**, **relative import**, **file length**, **Prisma no-enum**, and archive checks. The machine used for refactoring does **not have Bun or registry access**, so **`bun run build`, Prisma migration, and integration tests are not yet verified**. Gemini/Antigravity should execute them and report real results before claiming ready-to-run. See [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md).
