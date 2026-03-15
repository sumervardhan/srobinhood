# sRobinhood — Claude Instructions

## General behaviour

- Keep responses concise. Always summarise what you did. Help me understand the code and why we are doing things the way we are.
- Never push directly to `main`. Always create a feature branch and raise a PR.
- When asked to note a bug for later, save it to memory and confirm it's recorded.

## Bug fixes

Every bug fix must be accompanied by tests that would have caught the bug:

- A **unit test** (Vitest, in `src/**/__tests__/`) covering the specific logic that was broken.
- An **E2E test** (Playwright, in `e2e/`) covering the user-facing flow affected, where applicable.
  The goal is that re-introducing the bug causes at least one test to fail.

## Working with the codebase

- Use `npm run db:migrate` to run migrations (not `prisma migrate` directly — it requires `.env.local` via `dotenv-cli`).
- Use `npm run test:run` for unit tests and `npm run test:e2e` for E2E tests.
- `ALLOW_DEV_LOGIN=true` enables the dev login bypass (email: `dev@local`, password: `dev`) — use this in any CI or test context that needs an authenticated session.

## CI/CD

- The CI pipeline has three jobs: `validate` (lint + type-check + build), `unit-test`, and `e2e`.
- All three must pass before a PR can be merged.
- The E2E job spins up a real Postgres service container and runs `prisma migrate deploy` before starting the app.
