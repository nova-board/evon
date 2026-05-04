import { createEvon } from '../src'

const evon = createEvon({ enableLogging: true })

const unsubscribe = evon.subscribe('orders', (event) => {
  const payload = event.payload as { orderId: string; amount: number }
  console.log(`[orders] ${event.type} for order ${payload.orderId} (${payload.amount})`)
})

evon.publish({
  topic: 'orders',
  type: 'OrderCreated',
  payload: {
    orderId: 'ord-1',
    amount: 120
  }
})

unsubscribe()

