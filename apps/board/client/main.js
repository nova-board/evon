const board = document.getElementById('board')
const createBoxButton = document.getElementById('create-box-btn')
const boxes = new Map()

const socket = new WebSocket(`ws://${window.location.host}`)

let dragging = null

function makeEvent(type, payload) {
  return {
    topic: 'board.events',
    type,
    payload
  }
}

function sendEvent(type, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return
  }
  socket.send(JSON.stringify(makeEvent(type, payload)))
}

function setBoxPosition(element, x, y) {
  element.style.left = `${x}px`
  element.style.top = `${y}px`
}

function getOrCreateBox(id) {
  const existing = boxes.get(id)
  if (existing) {
    return existing
  }

  const element = document.createElement('div')
  element.className = 'box'
  element.dataset.id = id
  element.textContent = id.slice(0, 6)
  board.appendChild(element)
  boxes.set(id, element)
  return element
}

function applyBoardEvent(event) {
  if (!event || event.topic !== 'board.events' || !event.payload) {
    return
  }

  if (event.type === 'ObjectCreated' || event.type === 'ObjectMoved') {
    const { id, x, y } = event.payload
    if (typeof id !== 'string' || typeof x !== 'number' || typeof y !== 'number') {
      return
    }

    const box = getOrCreateBox(id)
    setBoxPosition(box, x, y)
  }
}

createBoxButton.addEventListener('click', () => {
  const id = crypto.randomUUID()
  const x = 40 + (boxes.size % 6) * 130
  const y = 40 + Math.floor(boxes.size / 6) * 90
  sendEvent('ObjectCreated', { id, x, y })
})

board.addEventListener('mousedown', (event) => {
  const target = event.target.closest('.box')
  if (!target) {
    return
  }

  const rect = target.getBoundingClientRect()
  dragging = {
    id: target.dataset.id,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  }
  target.style.cursor = 'grabbing'
})

window.addEventListener('mouseup', () => {
  if (!dragging) {
    return
  }

  const element = boxes.get(dragging.id)
  if (element) {
    element.style.cursor = 'grab'
  }
  dragging = null
})

window.addEventListener('mousemove', (event) => {
  if (!dragging) {
    return
  }

  const boardRect = board.getBoundingClientRect()
  const x = event.clientX - boardRect.left - dragging.offsetX
  const y = event.clientY - boardRect.top - dragging.offsetY
  sendEvent('ObjectMoved', { id: dragging.id, x, y })
})

socket.addEventListener('message', (message) => {
  try {
    const event = JSON.parse(message.data)
    applyBoardEvent(event)
  } catch (error) {
    console.error('Invalid event from server:', error)
  }
})
