# Evon Architecture

## System Overview

```
Publisher (App Code)
    ↓
Event normalization (id/timestamp defaults + validation)
    ↓
EventStore (append-only in-memory log)
    ↓
EventBus (in-memory pub/sub router)
    ├→ Consumer Handler A
    ├→ Consumer Handler B
    └→ Consumer Handler C
    ↓
Replay Engine (rebuild state from events)
```

## Components

### 1. EventBus
**Responsibility:** Route events from publishers to subscribers

- Maintains topic → handlers mapping
- Executes handlers synchronously
- Preserves event order per topic
- Supports multiple subscribers per topic

**Key Methods:**
- `publish(event: Event): void` - Emit event to all subscribers
- `subscribe(topic: string, handler: EventHandler): Unsubscribe` - Register handler
- `getSubscriberCount(topic: string): number` - Introspection

### 2. Event Store
**Responsibility:** Maintain append-only event log

- Stores all published events
- Indexed by topic for efficient querying
- Provides event retrieval and filtering
- Supports replay queries

**Key Methods:**
- `append(event: Event): void` - Add event to log
- `getEvents(filter?: EventFilter): Event[]` - Query events
- `getEventsByTopic(topic: string): Event[]` - Topic-specific query
- `getEventCount(): number` - Total event count

### 3. Replay Engine
**Responsibility:** Rebuild application state from events

- Recreates EventBus state from stored events
- Re-executes handlers in order
- Maintains temporal consistency
- Supports partial replay (from specific point)

**Key Methods:**
- `replay(topic?: string, from?: number): Event[]` - Execute replay
- `replayTo(topic?: string, timestamp?: number): Event[]` - Replay to point in time

## Data Flow - Publishing

```
App calls evon.publish(event)
    ↓
Event normalization (id/timestamp defaults + validation)
    ↓
EventStore.append(event)
    ↓
EventBus.publish(event)
    ↓
For each subscriber in topic:
    └ handler.execute(event)
```

## Data Flow - Subscribing

```
App calls evon.subscribe(topic, handler)
    ↓
EventBus.subscribe(topic, handler)
    ↓
Return unsubscribe function
```

## Data Flow - Replay

```
App calls evon.replay(topic)
    ↓
Replay Engine queries EventStore
    ↓
For each event in order:
    └ Execute subscriber handlers
    ↓
Return replayed events
```

Current behavior: replay executes current subscribers again. If a subscriber broadcasts to WebSocket clients, replay can trigger those side effects again. Phase 2 will add a state-only replay mode to avoid re-broadcast when rebuilding state.

## Event Structure

```typescript
interface Event {
  id: string                      // Unique identifier (UUID)
  topic: string                   // Topic for routing
  type: string                    // Event type (e.g., "UserCreated")
  payload: any                    // Event data
  timestamp: number               // Unix milliseconds
  metadata?: Record<string, any> // Optional metadata
}
```

## Handler Execution Model

- **Synchronous ordering:** Handlers are invoked in publish order for each topic
- **Async behavior:** Async handlers are started but not awaited
- **Order:** Guaranteed per topic, no cross-topic ordering
- **Error:** Handler errors don't stop other handlers (logged)

## Memory Model

- **EventStore:** Unbounded append-only log (in-memory array)
- **Subscriptions:** Map<topic, Set<handlers>>
- **Cleanup:** No automatic cleanup (Phase 2 concern)

## Current Limitations

- No persistence between process restarts
- No managed async pipeline (retry/isolation/dead-letter)
- No event ordering across topics
- Events stored indefinitely (memory leak risk in long-running processes)
- No distributed coordination
- Single process only

## Future Extensions

- **Phase 2 (Persistence + Replay):** File-based append-only EventStore, startup load, state-only replay mode, `applyEvent` projection, and basic write/read model separation.
- **Phase 3 (Async Processing):** Async handler execution, basic retries, and per-handler error isolation with dead-letter file support.
- **Phase 4 (Multi-node):** Redis Pub/Sub transport, multiple WebSocket nodes, per-key ordering (e.g. `objectId`), and duplicate suppression.
- **Phase 5 (DX):** Event stream inspection tools, replay/time-travel commands, developer API polish, and optional event schema validation.
