# Evon — Event Runtime for Builders

Evon is a lightweight, developer-first event runtime for building realtime, replayable systems.

## Why Evon

Evon focuses on local-first development and a simple API surface:

- **Simple first**: single-node runtime, no distributed complexity in v1
- **Replayable**: events are stored and can be replayed to rebuild state
- **Developer-first**: easy to debug and fast to integrate
- **Domain-agnostic**: generic event model, no business coupling

## Core Concepts

- **Event**: immutable record with `id`, `topic`, `type`, `payload`, `timestamp`
- **EventBus**: publish/subscribe routing and fan-out
- **EventStore**: append-only event log
- **Consumer**: handler that reacts to events
- **Replay**: rerun events to rebuild state

## Architecture (Phase 1)

```text
Publisher
   ↓
Event normalization
   ↓
EventStore (append-only)
   ↓
EventBus
   ↓
+ Consumer A
+ Consumer B
```

## API (V1)

```ts
evon.publish(event)
evon.subscribe("topic", handler)
evon.replay("topic")
```

## Current Status

Phase 1 is complete:

- In-memory EventBus (publish/subscribe)
- In-memory append-only EventStore
- WebSocket board demo in `apps/board` (create + move objects)
- Multi-client synchronization on a single node

Current limitations:

- No persistence across restarts
- Replay re-invokes current handlers (side effects can run again)
- No managed async pipeline (retry/isolation/dead-letter)

## Development Roadmap

1. **Phase 1 (Done)**: Local runtime (in-memory bus/store + replay)
2. **Phase 2**: Persistence + replay hardening (file-based append-only store, load on startup, state-only replay path, `applyEvent` state builder, basic write/read model split)
3. **Phase 3**: Async processing (async handlers, basic retry, per-handler error isolation + dead-letter)
4. **Phase 4**: Multi-node/distributed basics (Redis Pub/Sub transport, multi-node WebSocket fan-out, per-key ordering, duplicate suppression)
5. **Phase 5**: Developer experience (event stream inspection, replay/time-travel tooling, API polish, optional schema validation)

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Getting Started](docs/GETTING_STARTED.md)
- [FAQ](docs/FAQ.md)

## Development

```bash
npm install
npm run lint
npm run build
npm test
```

Run a single test file:

```bash
npm run test:single -- __tests__/evon.unit.test.ts
```

## Relationship with NovaBoard

Evon is a reusable runtime. NovaBoard is the first client application validating Evon through real use cases.
