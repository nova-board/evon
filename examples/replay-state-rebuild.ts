import { createEvon } from '../src'

type UserState = {
  id: string
  name?: string
}

const evon = createEvon()

evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '1', name: 'Alice' } })
evon.publish({ topic: 'users', type: 'UserCreated', payload: { id: '2', name: 'Bob' } })
evon.publish({ topic: 'users', type: 'UserDeleted', payload: { id: '1' } })

const state = new Map<string, UserState>()
evon.subscribe('users', (event) => {
  const payload = event.payload as UserState
  if (event.type === 'UserCreated') {
    state.set(payload.id, payload)
  }
  if (event.type === 'UserDeleted') {
    state.delete(payload.id)
  }
})

evon.replay('users')
console.log('Rebuilt users:', Object.fromEntries(state.entries()))

