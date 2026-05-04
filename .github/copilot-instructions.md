# Copilot Instructions for Evon

## Project baseline

- This repository is currently documentation-first: behavior and API expectations are defined in `README.md` and `docs/*.md`, not in in-repo implementation code.
- Treat `docs/API.md` as the contract for the `@evon/core` public API and `docs/ARCHITECTURE.md` as the runtime behavior reference.

## Build, test, and lint commands

- No in-repo build, lint, or test commands are currently defined (no `package.json`, test runner config, or build system files are present).
- A single-test command is not available in this repository at this time.
- Package installation commands documented for consumers of `@evon/core`:
  - `npm install @evon/core`
  - `yarn add @evon/core`
  - `pnpm add @evon/core`

## High-level architecture (Phase 1)

1. Application code publishes events through `evon.publish(...)`.
2. `EventBus` routes events by `topic` to all current subscribers in publish order for that topic.
3. `EventStore` appends every published event to an in-memory, append-only log.
4. `evon.replay(topic?, from?)` reads stored events and executes **current** subscribers again.
5. `evon.getEvents(filter?)` queries stored events without executing handlers.

Cross-file behavior to preserve:
- `publish` auto-generates `id` and `timestamp` when omitted.
- Handler errors are non-fatal to the bus flow (logged or passed to configured `errorHandler`).
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
