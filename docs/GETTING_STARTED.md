# Getting Started with Evon

## Installation

```bash
npm install @evon/core
# or
yarn add @evon/core
# or
pnpm add @evon/core
```

## Quick Start

### 1. Create an Evon Instance

```typescript
import { createEvon } from '@evon/core'

const evon = createEvon()
```

### 2. Subscribe to Events

```typescript
evon.subscribe('orders', (event) => {
  console.log('Order event received:', event.type)
  console.log('Payload:', event.payload)
})
```

### 3. Publish Events

```typescript
evon.publish({
  topic: 'orders',
  type: 'OrderCreated',
  payload: {
    orderId: '123',
    customerId: '456',
    amount: 100
  }
})
```

### 4. Replay Events

```typescript
// Replay all events
const allEvents = evon.replay()

// Replay specific topic
const orderEvents = evon.replay('orders')

// Handlers execute again for each replayed event (side effects can run again)
```

### 5. Try the Realtime Board Demo

Evon includes a simple multi-client WebSocket board demo in `apps/board`:

```bash
npm --prefix apps/board install
npm --prefix apps/board run check
npm --prefix apps/board start
```

Then open `http://localhost:8080` in two browser tabs and create/move boxes to see synchronized updates.

## Complete Example

```typescript
import { createEvon } from '@evon/core'

// Initialize
const evon = createEvon()

// Set up subscribers
evon.subscribe('users', (event) => {
  if (event.type === 'UserCreated') {
    console.log(`Welcome ${event.payload.name}!`)
  }
})

evon.subscribe('users', (event) => {
  console.log(`[Analytics] User event: ${event.type}`)
})

// Publish events
evon.publish({
  topic: 'users',
  type: 'UserCreated',
  payload: { id: '1', name: 'Alice' }
})

evon.publish({
  topic: 'users',
  type: 'UserCreated',
  payload: { id: '2', name: 'Bob' }
})

// Query events
const events = evon.getEvents({ topic: 'users' })
console.log(`Total user events: ${events.length}`)

// Get statistics
const stats = evon.getStats()
console.log(`Runtime stats:`, stats)
```

## Common Patterns

### Pattern 1: Event Sourcing

Use Evon as your event source of truth:

```typescript
const evon = createEvon()
const userState = {}

// Rebuild state from events
evon.subscribe('users', (event) => {
  if (event.type === 'UserCreated') {
    userState[event.payload.id] = event.payload
  } else if (event.type === 'UserDeleted') {
    delete userState[event.payload.id]
  }
})

// On startup, replay to rebuild state
evon.replay('users')
console.log('User state restored:', userState)
```

### Pattern 2: Cross-Domain Events

Publish events across different domains:

```typescript
const evon = createEvon()

// Domain 1: Orders
evon.subscribe('orders', (event) => {
  if (event.type === 'OrderCreated') {
    console.log('Order created, notifying fulfillment...')
  }
})

// Domain 2: Payments
evon.subscribe('payments', (event) => {
  if (event.type === 'PaymentProcessed') {
    console.log('Payment done, updating order status...')
  }
})

// Publish cross-domain
evon.publish({
  topic: 'orders',
  type: 'OrderCreated',
  payload: { orderId: '123' }
})

evon.publish({
  topic: 'payments',
  type: 'PaymentProcessed',
  payload: { orderId: '123', amount: 100 }
})
```

### Pattern 3: Request-Response via Events

Implement simple request-response patterns:

```typescript
const evon = createEvon()

evon.subscribe('queries', (event) => {
  if (event.type === 'GetUserById') {
    // Process query
    const user = { id: event.payload.userId, name: 'Alice' }
    
    // Publish response event
    evon.publish({
      topic: 'responses',
      type: 'UserFound',
      payload: user,
      metadata: { queryId: event.id }
    })
  }
})

// Request
evon.publish({
  topic: 'queries',
  type: 'GetUserById',
  payload: { userId: '1' }
})

// Later, check responses
const responses = evon.getEvents({ topic: 'responses', type: 'UserFound' })
```

## Testing with Evon

```typescript
import { createEvon } from '@evon/core'

describe('User Service', () => {
  let evon

  beforeEach(() => {
    evon = createEvon()
  })

  afterEach(() => {
    evon.clear() // Clean up after each test
  })

  it('should create user event', () => {
    let userCreatedCount = 0

    evon.subscribe('users', (event) => {
      if (event.type === 'UserCreated') {
        userCreatedCount++
      }
    })

    evon.publish({
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '1', name: 'Alice' }
    })

    expect(userCreatedCount).toBe(1)
  })

  it('should replay events correctly', () => {
    evon.publish({
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '1' }
    })

    evon.publish({
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '2' }
    })

    evon.clear() // Clear subscribers

    let replayCount = 0
    evon.subscribe('users', () => {
      replayCount++
    })

    evon.replay('users')

    expect(replayCount).toBe(2)
  })
})
```

## Next Steps

- Explore [API Reference](./API.md)
- Read [Architecture Guide](./ARCHITECTURE.md)
- Check [Examples](../examples)
- Review [Core Concepts](../README.md#core-concepts)

## Need Help?

- Check the [FAQ](./FAQ.md)
- Open an issue on GitHub
- Review test files in `__tests__/`
