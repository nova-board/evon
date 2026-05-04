# Copilot Instructions for Evon

## Project baseline

- Phase 1 runtime implementation lives in `src/` and is exercised by tests in `__tests__/`.
- Keep `docs/API.md` and `docs/ARCHITECTURE.md` aligned with implementation when changing public behavior.

## Build, test, and lint commands

- Install dependencies: `npm install`
- Lint (type-check): `npm run lint`
- Build: `npm run build`
- Full test suite: `npm test`
- Single test file: `npm run test:single -- __tests__/evon.unit.test.ts`

## High-level architecture (Phase 1)

1. Application code publishes events through `evon.publish(...)`.
2. `EventBus` routes events by `topic` to all current subscribers in publish order for that topic.
3. `EventStore` appends every published event to an in-memory, append-only log.
4. `evon.replay(topic?, from?)` reads stored events and executes **current** subscribers again.
5. `evon.getEvents(filter?)` queries stored events without executing handlers.

Cross-file behavior to preserve:
- `publish` auto-generates `id` and `timestamp` when omitted.
- Handler errors are non-fatal to the bus flow (logged or passed to configured `errorHandler`).
- Handler execution is synchronous for sync handlers; async handlers are invoked but not awaited.
- Phase 1 is single-process, in-memory, and unbounded (no persistence/cleanup yet).

## Key conventions

- Event shape should follow: `id`, `topic`, `type`, `payload`, `timestamp`, optional `metadata`.
- Topic names are case-sensitive; exact matching is required.
- `subscribe(topic, handler)` returns an unsubscribe function and should be used for lifecycle cleanup.
- Use `replay()` only when re-triggering handler side effects is intended; use `getEvents()` for read-only inspection.
- In tests/examples, reset runtime state with `evon.clear()` between cases.

## Existing Copilot workflow conventions

- If asked to commit/push, follow `.github/copilot/skills/dev-commit-and-push/SKILL.md`:
  - Run relevant existing checks before commit when available.
  - Use conventional commit-style subjects (`feat:`, `fix:`, `docs:`, `chore:`).
  - Avoid force push unless explicitly requested.
