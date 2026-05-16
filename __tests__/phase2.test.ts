import { createEvon, applyEvents } from '../src'
import { FileEventStore } from '../src/file-event-store'
import { EventError } from '../src/errors'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, appendFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

type UserState = {
  users: Map<string, { id: string; name: string }>
}

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'evon-test-'))
}

describe('FileEventStore', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = makeTempDir()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates a new log file on first use', () => {
    const filePath = join(tempDir, 'events.ndjson')
    const store = new FileEventStore(filePath)

    store.append({
      id: 'a1',
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '1', name: 'Alice' },
      timestamp: 1_000
    })

    expect(existsSync(filePath)).toBe(true)
    expect(store.getEventCount()).toBe(1)
  })

  it('persists events and reloads them after reconstruction', () => {
    const filePath = join(tempDir, 'events.ndjson')

    const store1 = new FileEventStore(filePath)
    store1.append({
      id: 'a1',
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '1', name: 'Alice' },
      timestamp: 1_000
    })
    store1.append({
      id: 'a2',
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '2', name: 'Bob' },
      timestamp: 2_000
    })

    // Simulate process restart by creating a new store from the same file.
    const store2 = new FileEventStore(filePath)
    expect(store2.getEventCount()).toBe(2)
    const events = store2.getEvents()
    expect(events[0]?.id).toBe('a1')
    expect(events[1]?.id).toBe('a2')
  })

  it('maintains topic index after reload', () => {
    const filePath = join(tempDir, 'events.ndjson')

    const store1 = new FileEventStore(filePath)
    store1.append({ id: 'e1', topic: 'users', type: 'UserCreated', payload: {}, timestamp: 1_000 })
    store1.append({ id: 'e2', topic: 'orders', type: 'OrderCreated', payload: {}, timestamp: 2_000 })

    const store2 = new FileEventStore(filePath)
    expect(store2.getEventsByTopic('users')).toHaveLength(1)
    expect(store2.getEventsByTopic('orders')).toHaveLength(1)
  })

  it('preserves events with metadata across reload', () => {
    const filePath = join(tempDir, 'events.ndjson')

    const store1 = new FileEventStore(filePath)
    store1.append({
      id: 'e1',
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '1' },
      timestamp: 1_000,
      metadata: { source: 'api' }
    })

    const store2 = new FileEventStore(filePath)
    const [event] = store2.getEvents()
    expect(event?.metadata).toEqual({ source: 'api' })
  })

  it('handles a corrupt tail record and still loads valid preceding events', () => {
    const filePath = join(tempDir, 'events.ndjson')

    const store1 = new FileEventStore(filePath)
    store1.append({ id: 'e1', topic: 'users', type: 'UserCreated', payload: {}, timestamp: 1_000 })

    // Manually append a corrupt record to the file.
    appendFileSync(filePath, '{corrupt json\n', 'utf8')

    const store2 = new FileEventStore(filePath)
    // Valid event before the corrupt line must still be loaded.
    expect(store2.getEventCount()).toBe(1)
    expect(store2.getEvents()[0]?.id).toBe('e1')
  })

  it('clear() empties both memory and the log file', () => {
    const filePath = join(tempDir, 'events.ndjson')

    const store = new FileEventStore(filePath)
    store.append({ id: 'e1', topic: 'users', type: 'UserCreated', payload: {}, timestamp: 1_000 })
    store.clear()

    expect(store.getEventCount()).toBe(0)

    // Reloading the cleared file should give an empty store.
    const store2 = new FileEventStore(filePath)
    expect(store2.getEventCount()).toBe(0)
  })

  it('supports all EventFilter options after reload', () => {
    const filePath = join(tempDir, 'events.ndjson')

    const store1 = new FileEventStore(filePath)
    store1.append({ id: 'e1', topic: 'users', type: 'UserCreated', payload: {}, timestamp: 1_700_000_000_001 })
    store1.append({ id: 'e2', topic: 'users', type: 'UserDeleted', payload: {}, timestamp: 1_700_000_000_002 })
    store1.append({ id: 'e3', topic: 'orders', type: 'OrderCreated', payload: {}, timestamp: 1_700_000_000_003 })

    const store2 = new FileEventStore(filePath)
    expect(store2.getEvents({ topic: 'users' })).toHaveLength(2)
    expect(store2.getEvents({ topic: 'users', type: 'UserCreated' })).toHaveLength(1)
    expect(store2.getEvents({ limit: 2 })).toHaveLength(2)
    expect(store2.getEvents({ from: 1_700_000_000_002 })).toHaveLength(2)
  })

  it('throws EventError for empty filePath', () => {
    expect(() => new FileEventStore('')).toThrow(EventError)
  })

  it('throws EventError for invalid filter options', () => {
    const filePath = join(tempDir, 'events.ndjson')
    const store = new FileEventStore(filePath)

    expect(() => store.getEvents({ topic: '' })).toThrow(EventError)
    expect(() => store.getEvents({ from: -1 })).toThrow(EventError)
    expect(() => store.getEvents({ limit: -1 })).toThrow(EventError)
  })
})

describe('createEvon with persistence', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = makeTempDir()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('persists events and restores them after simulated restart', () => {
    const filePath = join(tempDir, 'evon.ndjson')

    const evon1 = createEvon({ persistence: { filePath } })
    evon1.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1', name: 'Alice' } })
    evon1.publish({ topic: 'users', type: 'UserCreated', payload: { id: '2', name: 'Bob' } })

    // Simulate restart.
    const evon2 = createEvon({ persistence: { filePath } })
    expect(evon2.getEvents()).toHaveLength(2)
  })

  it('getStats() reflects persisted event count on startup', () => {
    const filePath = join(tempDir, 'evon.ndjson')

    const evon1 = createEvon({ persistence: { filePath } })
    evon1.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1' } })
    evon1.publish({ topic: 'orders', type: 'OrderCreated', payload: { id: 'o1' } })

    const evon2 = createEvon({ persistence: { filePath } })
    const stats = evon2.getStats()
    expect(stats.totalEvents).toBe(2)
    expect(stats.topicCount).toBe(2)
  })

  it('continues appending new events after restart', () => {
    const filePath = join(tempDir, 'evon.ndjson')

    const evon1 = createEvon({ persistence: { filePath } })
    evon1.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1' } })

    const evon2 = createEvon({ persistence: { filePath } })
    evon2.publish({ topic: 'users', type: 'UserCreated', payload: { id: '2' } })

    expect(evon2.getEvents()).toHaveLength(2)

    // A third restart should see all three.
    const evon3 = createEvon({ persistence: { filePath } })
    expect(evon3.getEvents()).toHaveLength(2)
  })
})

describe('state-only replay', () => {
  it('does not invoke subscribers during stateOnly replay', () => {
    const evon = createEvon()
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1' } })
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '2' } })

    const received: string[] = []
    evon.subscribe('users', (event) => {
      received.push((event.payload as { id: string }).id)
    })

    const replayed = evon.replay('users', 0, true)

    // Events are returned but subscribers are NOT called.
    expect(replayed).toHaveLength(2)
    expect(received).toHaveLength(0)
  })

  it('full replay (default) still invokes subscribers', () => {
    const evon = createEvon()
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1' } })

    const received: string[] = []
    evon.subscribe('users', (event) => {
      received.push((event.payload as { id: string }).id)
    })

    evon.replay('users')

    expect(received).toHaveLength(1)
  })

  it('stateOnly replay returns all events for all topics when topic is omitted', () => {
    const evon = createEvon()
    evon.publish({ topic: 'users', type: 'UserCreated', payload: {} })
    evon.publish({ topic: 'orders', type: 'OrderCreated', payload: {} })

    const replayed = evon.replay(undefined, 0, true)
    expect(replayed).toHaveLength(2)
  })

  it('stateOnly replay respects the from offset', () => {
    const evon = createEvon()
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1' } })
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '2' } })
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '3' } })

    const replayed = evon.replay('users', 1, true)
    expect(replayed).toHaveLength(2)
    expect((replayed[0]?.payload as { id: string }).id).toBe('2')
  })
})

describe('applyEvents projection', () => {
  it('builds state from a sequence of events without side effects', () => {
    const evon = createEvon()

    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1', name: 'Alice' } })
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '2', name: 'Bob' } })
    evon.publish({ topic: 'users', type: 'UserDeleted', payload: { id: '1' } })

    const events = evon.getEvents({ topic: 'users' })

    const state = applyEvents<UserState>(
      events,
      { users: new Map() },
      (s, event) => {
        const payload = event.payload as { id: string; name?: string }
        if (event.type === 'UserCreated') {
          const next = new Map(s.users)
          next.set(payload.id, { id: payload.id, name: payload.name ?? '' })
          return { users: next }
        }
        if (event.type === 'UserDeleted') {
          const next = new Map(s.users)
          next.delete(payload.id)
          return { users: next }
        }
        return s
      }
    )

    expect(state.users.size).toBe(1)
    expect(state.users.get('2')).toEqual({ id: '2', name: 'Bob' })
  })

  it('returns initial state when event list is empty', () => {
    const initial = { count: 0 }
    const result = applyEvents([], initial, (s) => s)
    expect(result).toBe(initial)
  })

  it('produces the same result on every run (determinism)', () => {
    const evon = createEvon()
    evon.publish({ topic: 't', type: 'Inc', payload: {} })
    evon.publish({ topic: 't', type: 'Inc', payload: {} })
    evon.publish({ topic: 't', type: 'Dec', payload: {} })

    const events = evon.getEvents({ topic: 't' })
    const reducer = (s: number, e: { type: string }): number =>
      e.type === 'Inc' ? s + 1 : e.type === 'Dec' ? s - 1 : s

    const run1 = applyEvents(events, 0, reducer)
    const run2 = applyEvents(events, 0, reducer)

    expect(run1).toBe(1)
    expect(run2).toBe(run1)
  })

  it('works with stateOnly replay to rebuild state without triggering handlers', () => {
    const evon = createEvon()

    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1', name: 'Alice' } })
    evon.publish({ topic: 'users', type: 'UserDeleted', payload: { id: '1' } })

    const sideEffectCalled: boolean[] = []
    evon.subscribe('users', () => {
      sideEffectCalled.push(true)
    })

    // Use stateOnly replay to get events, then fold them into state.
    const events = evon.replay('users', 0, true)
    const state = applyEvents<Map<string, unknown>>(
      events,
      new Map(),
      (s, event) => {
        const m = new Map(s)
        const payload = event.payload as { id: string }
        if (event.type === 'UserCreated') {
          m.set(payload.id, payload)
        } else if (event.type === 'UserDeleted') {
          m.delete(payload.id)
        }
        return m
      }
    )

    expect(sideEffectCalled).toHaveLength(0)
    expect(state.size).toBe(0)
  })
})
