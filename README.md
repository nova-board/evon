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
EventBus
   ↓
+ Consumer A
+ Consumer B
   ↓
EventStore (append-only)
```

## API (V1)

```ts
evon.publish(event)
evon.subscribe("topic", handler)
evon.replay("topic")
```

## Development Roadmap

1. **Phase 1**: Local runtime (in-memory bus/store + replay)
2. **Phase 2**: Persistence (file/DB-backed event store)
3. **Phase 3**: Async processing (retry, ack, error handling)
4. **Phase 4**: Scaling (Redis Pub/Sub, multi-node)
5. **Phase 5**: Streaming integrations (Kafka/Kinesis)

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Getting Started](docs/GETTING_STARTED.md)
- [FAQ](docs/FAQ.md)

## Relationship with NovaBoard

Evon is a reusable runtime. NovaBoard is the first client application validating Evon through real use cases.
