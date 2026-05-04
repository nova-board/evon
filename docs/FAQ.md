# Frequently Asked Questions

## General

### What is Evon?
Evon is a lightweight, event-driven runtime designed for building real-time systems. It provides publish/subscribe messaging with replay capability using in-memory storage.

### How is Evon different from Kafka?
Kafka is a distributed streaming platform designed for high-throughput, fault-tolerant systems. Evon is simpler and designed for:
- Local development and testing
- In-process event handling
- Learning event-driven architecture
- Small to medium projects

Evon prioritizes simplicity and developer experience over scalability.

### Can I use Evon in production?
Phase 1 of Evon is designed for development and prototyping. For production use, consider:
- Upgrading to Phase 2+ when persistence is added
- Evaluating your scalability needs
- Using Kafka/RabbitMQ for distributed systems

### What are the memory requirements?
Phase 1 stores all events in memory. Memory usage is proportional to:
- Number of events published
- Size of event payloads
- Metadata attached to events

For example, 1 million events with 1KB payloads each would use ~1GB RAM.

---

## API & Usage

### How do I create an Evon instance?
```typescript
import { createEvon } from '@evon/core'
const evon = createEvon()
```

### What happens if a subscriber throws an error?
Errors are caught and logged. They don't stop other subscribers or affect the event bus. Use the `errorHandler` option to customize error handling:

```typescript
const evon = createEvon({
  errorHandler: (error, event, handler) => {
    console.error(`Handler failed for ${event.type}:`, error)
  }
})
```

### Are handler executions synchronous or async?
Phase 1 handlers execute **synchronously** in order. Handlers declared as `async` will return a Promise, but the event bus won't wait for them. Phase 3 will add proper async support.

### Can I unsubscribe from events?
Yes, `subscribe()` returns an unsubscribe function:

```typescript
const unsubscribe = evon.subscribe('topic', handler)
unsubscribe() // Remove subscription
```

### How do I handle events that need to process in a specific order?
Evon guarantees ordering per topic. Events on the same topic execute in publish order. For cross-topic ordering, handle it in your application logic.

### What happens during replay?
Replay:
1. Queries events from the event store
2. Executes all current subscribers for those events
3. Returns the replayed events

Original subscribers get called again.

---

## Event Management

### How do I query events?
Use `getEvents()` with optional filters:

```typescript
const events = evon.getEvents({ topic: 'users', type: 'UserCreated' })
```

### Can I delete events?
No. Phase 1 uses append-only semantics. Events cannot be modified or deleted. Use `clear()` to reset everything (primarily for testing).

### How do I handle event versioning?
Include version info in the event:

```typescript
evon.publish({
  topic: 'orders',
  type: 'OrderCreated',
  payload: { orderId: '123' },
  metadata: { version: 'v2', schema: 'order-v2' }
})
```

### What's the difference between `replay()` and `getEvents()`?
- `replay()` - Executes handlers for events (side effects)
- `getEvents()` - Returns events without executing handlers (read-only)

### How large can event payloads be?
There's no hard limit, but keep payloads reasonable. Large payloads increase memory usage and latency. Recommended: < 1MB per event.

---

## Performance & Optimization

### Why is my app slow with many events?
Possible causes:
1. **Memory pressure** - Too many events in memory
2. **Slow handlers** - Subscribers doing heavy work
3. **Many subscribers** - Each subscriber runs per event

Solutions:
- Implement cleanup/archival in Phase 2
- Optimize handler logic
- Use fewer subscribers where possible

### How many events can Evon handle?
Depends on hardware and event size. Typical laptop:
- Publish: ~100k events/sec
- Subscribe: Limited by handler logic
- Replay: ~500k events/sec (approximate)

### Should I subscribe to all topics or specific ones?
Subscribe to specific topics. It's more efficient and makes code easier to understand.

---

## Replay & State Management

### How do I rebuild state after a crash?
Store all state changes as events. On startup, replay events to rebuild state:

```typescript
const state = {}

evon.subscribe('items', (event) => {
  if (event.type === 'ItemCreated') {
    state[event.payload.id] = event.payload
  }
})

// Rebuild state from stored events
evon.replay('items')
```

### Can I partially replay?
Yes, specify a starting index:

```typescript
const events = evon.replay('users', 100) // Start from event 100
```

### What if I replay with no subscribers?
Nothing happens. `replay()` only executes handlers currently registered.

---

## Integration

### Can I use Evon with Express.js?
Yes:

```typescript
const express = require('express')
const { createEvon } = require('@evon/core')

const app = express()
const evon = createEvon()

app.post('/events', (req, res) => {
  const published = evon.publish(req.body)
  res.json(published)
})

app.get('/events', (req, res) => {
  const events = evon.getEvents({ topic: req.query.topic })
  res.json(events)
})

app.post('/replay', (req, res) => {
  const replayed = evon.replay(req.query.topic)
  res.json({ count: replayed.length })
})

app.listen(3000)
```

### Can I use Evon with TypeScript?
Yes, Evon is built with TypeScript and includes full type definitions:

```typescript
import { createEvon, Event, EventHandler } from '@evon/core'

const evon = createEvon()

const handler: EventHandler = (event: Event) => {
  console.log(event.type)
}

evon.subscribe('topic', handler)
```

### Can I use Evon with React?
Yes, for state management or event-driven updates:

```typescript
import { useState, useEffect } from 'react'
import { createEvon } from '@evon/core'

const evon = createEvon()

function MyComponent() {
  const [events, setEvents] = useState([])

  useEffect(() => {
    const unsubscribe = evon.subscribe('ui', (event) => {
      setEvents(e => [...e, event])
    })

    return unsubscribe
  }, [])

  return <div>{events.length} events</div>
}
```

---

## Troubleshooting

### Events aren't being processed
Check:
1. Topic name matches exactly (case-sensitive)
2. Subscriber registered before publish (or use replay)
3. No errors logged in error handler
4. Handler not throwing exceptions

### Memory keeps growing
This is normal in Phase 1. Solutions:
- Restart the process periodically
- Limit event lifetime with application logic
- Wait for Phase 2 persistence + cleanup

### Why are subscribers not called during replay?
Replay only calls *currently registered* subscribers. Register handlers before replaying:

```typescript
// Wrong: subscribe after replay
evon.replay('topic')
evon.subscribe('topic', handler)

// Right: subscribe before replay
evon.subscribe('topic', handler)
evon.replay('topic')
```

### How do I debug event flow?
Enable logging:

```typescript
const evon = createEvon({
  enableLogging: true
})
```

Query the event store:

```typescript
const events = evon.getEvents()
console.log(events)
```

---

## Future (Post-Phase 1)

### Will Evon support persistence?
Yes, in Phase 2. Coming soon.

### Will Evon support async handlers?
Yes, in Phase 3. Currently all handlers are synchronous.

### Will Evon support multiple processes?
Yes, in Phase 4 with Redis integration.

### Will there be a distributed version?
Yes, planned for Phase 5 with Kafka/Kinesis integration.
