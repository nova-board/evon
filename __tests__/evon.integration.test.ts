import { createEvon } from '../src'
import { describe, expect, it } from 'vitest'

type UserPayload = {
  id: string
  name?: string
}

describe('Evon integration', () => {
  it('rebuilds user state via replay', () => {
    const evon = createEvon()

    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1', name: 'Alice' } })
    evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '2', name: 'Bob' } })
    evon.publish({ topic: 'users', type: 'UserDeleted', payload: { id: '1' } })

    const state = new Map<string, UserPayload>()
    evon.subscribe('users', (event) => {
      const payload = event.payload as UserPayload
      if (event.type === 'UserCreated') {
        state.set(payload.id, payload)
      }
      if (event.type === 'UserDeleted') {
        state.delete(payload.id)
      }
    })

    const replayed = evon.replay('users')

    expect(replayed).toHaveLength(3)
    expect(Array.from(state.keys())).toEqual(['2'])
  })

  it('supports cross-domain flow through event chaining', () => {
    const evon = createEvon()
    const processedPayments: string[] = []

    evon.subscribe('orders', (event) => {
      if (event.type !== 'OrderCreated') {
        return
      }
      const payload = event.payload as { orderId: string; amount: number }
      evon.publish({
        topic: 'payments',
        type: 'PaymentRequested',
        payload: {
          orderId: payload.orderId,
          amount: payload.amount
        }
      })
    })

    evon.subscribe('payments', (event) => {
      if (event.type === 'PaymentRequested') {
        processedPayments.push((event.payload as { orderId: string }).orderId)
      }
    })

    evon.publish({
      topic: 'orders',
      type: 'OrderCreated',
      payload: {
        orderId: 'ord-100',
        amount: 150
      }
    })

    expect(processedPayments).toEqual(['ord-100'])
    expect(evon.getEvents({ topic: 'payments', type: 'PaymentRequested' })).toHaveLength(1)
  })

  it('replays in publish order for a topic', () => {
    const evon = createEvon()

    evon.publish({ topic: 'audit', type: 'Step1', payload: { n: 1 } })
    evon.publish({ topic: 'audit', type: 'Step2', payload: { n: 2 } })
    evon.publish({ topic: 'audit', type: 'Step3', payload: { n: 3 } })

    const replayOrder: string[] = []
    evon.subscribe('audit', (event) => {
      replayOrder.push(event.type)
    })

    evon.replay('audit')

    expect(replayOrder).toEqual(['Step1', 'Step2', 'Step3'])
  })
})

