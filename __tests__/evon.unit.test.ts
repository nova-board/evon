import { createEvon, EventError, HandlerError, ReplayError, SubscribeError } from '../src'
import { describe, expect, it } from 'vitest'

type UserPayload = {
  id: string
}

describe('Evon unit', () => {
  it('publishes events and auto-generates id/timestamp', () => {
    const evon = createEvon()

    const published = evon.publish({
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '1' }
    })

    expect(published.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(typeof published.timestamp).toBe('number')
    expect(evon.getEvents()).toHaveLength(1)
  })

  it('supports fan-out subscribe and unsubscribe', () => {
    const evon = createEvon()
    const analytics: string[] = []
    const audit: string[] = []

    const unsubscribeAnalytics = evon.subscribe('users', (event) => {
      analytics.push(event.type)
    })
    evon.subscribe('users', (event) => {
      audit.push(event.type)
    })

    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1' } })
    unsubscribeAnalytics()
    evon.publish({ topic: 'users', type: 'UserDeleted', payload: { id: '1' } })

    expect(analytics).toEqual(['UserCreated'])
    expect(audit).toEqual(['UserCreated', 'UserDeleted'])
  })

  it('replays events by topic from index', () => {
    const evon = createEvon()

    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1' } })
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '2' } })
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '3' } })

    const replayedIds: string[] = []
    evon.subscribe('users', (event) => {
      replayedIds.push((event.payload as UserPayload).id)
    })

    const replayed = evon.replay('users', 1)

    expect(replayed).toHaveLength(2)
    expect(replayedIds).toEqual(['2', '3'])
    expect(evon.getEvents({ topic: 'users' })).toHaveLength(3)
  })

  it('filters events by topic, type, from/to and limit', () => {
    const evon = createEvon()

    evon.publish({
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '1' },
      timestamp: 1_700_000_000_001
    })
    evon.publish({
      topic: 'users',
      type: 'UserDeleted',
      payload: { id: '1' },
      timestamp: 1_700_000_000_002
    })
    evon.publish({
      topic: 'orders',
      type: 'OrderCreated',
      payload: { id: 'o-1' },
      timestamp: 1_700_000_000_003
    })

    expect(evon.getEvents({ topic: 'users' })).toHaveLength(2)
    expect(evon.getEvents({ topic: 'users', type: 'UserCreated' })).toHaveLength(1)
    expect(evon.getEvents({ topic: 'users', from: 1 })).toHaveLength(1)
    expect(evon.getEvents({ from: 1_700_000_000_002 })).toHaveLength(2)
    expect(evon.getEvents({ limit: 2 })).toHaveLength(2)
  })

  it('throws EventError for invalid publish payload', () => {
    const evon = createEvon()

    expect(() => {
      evon.publish({ topic: '', type: 'UserCreated', payload: {} })
    }).toThrow(EventError)

    expect(() => {
      evon.publish({ topic: 'users', type: '', payload: {} })
    }).toThrow(EventError)

    expect(() => {
      evon.publish({ topic: 'users', type: 'UserCreated' })
    }).toThrow(EventError)
  })

  it('throws SubscribeError for invalid subscription', () => {
    const evon = createEvon()

    expect(() => {
      evon.subscribe('', () => {})
    }).toThrow(SubscribeError)

    expect(() => {
      evon.subscribe('users', null as unknown as () => void)
    }).toThrow(SubscribeError)
  })

  it('throws ReplayError for invalid replay index', () => {
    const evon = createEvon()

    expect(() => {
      evon.replay('users', -1)
    }).toThrow(ReplayError)
  })

  it('keeps processing other handlers when one fails', () => {
    const errors: Error[] = []
    const evon = createEvon({
      errorHandler: (error) => {
        errors.push(error)
      }
    })

    let processed = false

    evon.subscribe('users', () => {
      throw new Error('boom')
    })
    evon.subscribe('users', () => {
      processed = true
    })

    evon.publish({
      topic: 'users',
      type: 'UserCreated',
      payload: { id: '1' }
    })

    expect(processed).toBe(true)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(HandlerError)
  })
})

