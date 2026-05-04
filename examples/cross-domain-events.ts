import { createEvon } from '../src'

const evon = createEvon()

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
  const payload = event.payload as { orderId: string; amount: number }
  console.log(`Payment workflow started for ${payload.orderId} (${payload.amount})`)
})

evon.publish({
  topic: 'orders',
  type: 'OrderCreated',
  payload: {
    orderId: 'ord-42',
    amount: 75
  }
})

