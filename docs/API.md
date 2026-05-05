# Evon API Reference

## Phase Status

- **Implemented now (Phase 1):** in-memory publish/subscribe, in-memory append-only store, replay through current subscribers, event querying via `getEvents`.
- **Planned next (Phases 2-5):** file persistence and startup recovery, safer replay modes, async processing with retries/isolation, Redis multi-node transport, and developer tooling.

## Core Types

```typescript
interface Event {
  id: string                      // Unique event identifier
  topic: string                   // Routing topic
  type: string                    // Event type name
  payload: any                    // Event data
  timestamp: number               // Created at (Unix ms)
  metadata?: Record<string, any> // Optional metadata
}

type EventHandler = (event: Event) => void | Promise<void>

type EventFilter = {
  topic?: string
  type?: string
  from?: number     // < 100_000_000_000 => index, otherwise timestamp
  to?: number       // < 100_000_000_000 => index, otherwise timestamp
  limit?: number
}

type Unsubscribe = () => void
```

## Evon Instance API

### publish(event: Partial<Event>): Event

Publish an event to subscribers.

**Parameters:**
- `event` - Event object (id, timestamp auto-generated if omitted)

**Returns:** Published event with generated id and timestamp

**Throws:** `EventError` if event invalid

**Example:**
```typescript
const published = evon.publish({
  topic: 'users',
  type: 'UserCreated',
  payload: { userId: '123', name: 'John' }
})
console.log(published.id) // Auto-generated UUID
```

---

### subscribe(topic: string, handler: EventHandler): Unsubscribe

Subscribe to events on a topic.

**Parameters:**
- `topic` - Topic name (e.g., 'users', 'orders')
- `handler` - Callback function receiving events

**Returns:** Unsubscribe function to remove handler

**Throws:** `SubscribeError` if topic or handler invalid

**Example:**
```typescript
const unsubscribe = evon.subscribe('users', (event) => {
  console.log(`User event: ${event.type}`, event.payload)
})

// Later, remove subscription
unsubscribe()
```

---

### replay(topic?: string, from?: number): Event[]

Replay events from the event store and execute handlers.

Note: replay is not read-only. It re-invokes currently registered handlers and may trigger their side effects.

**Parameters:**
- `topic` (optional) - Replay only events from this topic
- `from` (optional) - Start from event index (default: 0)

**Returns:** Array of replayed events

**Throws:** `ReplayError` if invalid parameters

**Example:**
```typescript
// Replay all events
const all = evon.replay()

// Replay specific topic
const users = evon.replay('users')

// Replay from index 10 onwards
const partial = evon.replay('users', 10)
```

Phase 2 roadmap includes a state-only replay path for rebuilding projections without re-broadcasting side effects.

---

### getEvents(filter?: EventFilter): Event[]

Query events from the event store (no handler execution).

**Parameters:**
- `filter` (optional) - Filter criteria

**Returns:** Array of matching events

**Example:**
```typescript
// Get all events
const all = evon.getEvents()

// Filter by topic and type
const userCreations = evon.getEvents({
  topic: 'users',
  type: 'UserCreated'
})

// Get last 100 events
const recent = evon.getEvents({ limit: 100 })
```

---

### getStats(): EventStats

Get runtime statistics.

**Returns:**
```typescript
interface EventStats {
  totalEvents: number
  topicCount: number
  handlerCount: number
  topics: Record<string, number> // Events per topic
}
```

**Example:**
```typescript
const stats = evon.getStats()
console.log(`Total events: ${stats.totalEvents}`)
console.log(`Topics: ${stats.topicCount}`)
```

---

### clear(): void

Clear all events and subscribers (useful for testing).

**Example:**
```typescript
evon.clear()
```

---

## Error Handling

All errors inherit from `EvonError`:

```typescript
class EvonError extends Error {
  name: string
  message: string
  code?: string
}
```

**Error Types:**
- `EventError` - Invalid event structure
- `SubscribeError` - Invalid subscription
- `ReplayError` - Replay operation failed
- `HandlerError` - Handler execution failed (logged, non-fatal)

**Example:**
```typescript
try {
  evon.publish({ topic: '' }) // Invalid empty topic
} catch (error) {
  if (error instanceof EventError) {
    console.error(`Invalid event: ${error.message}`)
  }
}
```

---

## Creating an Evon Instance

```typescript
import { createEvon } from '@evon/core'

const evon = createEvon({
  // Optional configuration
  enableLogging: true,
  errorHandler: (error) => console.error(error)
})
```

---

## Usage Examples

### Example 1: Basic Publish/Subscribe

```typescript
const evon = createEvon()

evon.subscribe('orders', (event) => {
  if (event.type === 'OrderPlaced') {
    console.log(`Order placed: ${event.payload.orderId}`)
  }
})

evon.publish({
  topic: 'orders',
  type: 'OrderPlaced',
  payload: { orderId: 'ORD-123', amount: 99.99 }
})
```

### Example 2: Event Replay

```typescript
const evon = createEvon()

// Subscribe handlers
evon.subscribe('payments', (event) => {
  console.log(`Processing: ${event.type}`)
})

// Publish events
evon.publish({ topic: 'payments', type: 'PaymentInitiated', payload: {} })
evon.publish({ topic: 'payments', type: 'PaymentCompleted', payload: {} })

// Replay all payments events
const replayed = evon.replay('payments')
console.log(`Replayed ${replayed.length} events`)
```

### Example 3: Multiple Subscribers

```typescript
const evon = createEvon()

evon.subscribe('users', (event) => {
  console.log(`[Analytics] ${event.type}`)
})

evon.subscribe('users', (event) => {
  console.log(`[Logging] User event: ${event.type}`)
})

evon.publish({
  topic: 'users',
  type: 'UserSignedUp',
  payload: { email: 'user@example.com' }
})
// Logs both subscribers
```
