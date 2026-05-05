import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { readFile } from 'fs/promises'
import path from 'path'
import { createEvon, type Event } from '../../../src'
import { WebSocket, WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT ?? '8080')
const TOPIC = 'board.events'
const clientDir = path.resolve(__dirname, '..', 'client')

if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error('PORT must be a positive integer.')
}

const evon = createEvon()

function sendFile(response: ServerResponse, filePath: string, contentType: string): void {
  readFile(filePath)
    .then((content) => {
      response.writeHead(200, { 'Content-Type': contentType })
      response.end(content)
    })
    .catch(() => {
      response.writeHead(404, { 'Content-Type': 'text/plain' })
      response.end('Not found')
    })
}

const httpServer = createServer((request: IncomingMessage, response: ServerResponse) => {
  const requestPath = (request.url ?? '/').split('?')[0]
  const safePath = requestPath === '/' ? '/index.html' : requestPath

  if (safePath === '/index.html') {
    sendFile(response, path.join(clientDir, 'index.html'), 'text/html; charset=utf-8')
    return
  }

  if (safePath === '/main.js') {
    sendFile(response, path.join(clientDir, 'main.js'), 'application/javascript; charset=utf-8')
    return
  }

  response.writeHead(404, { 'Content-Type': 'text/plain' })
  response.end('Not found')
})

const wsServer = new WebSocketServer({ server: httpServer })

evon.subscribe(TOPIC, (event) => {
  const message = JSON.stringify(event)
  for (const client of wsServer.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  }
})

wsServer.on('connection', (socket) => {
  const history = evon.getEvents({ topic: TOPIC })
  for (const event of history) {
    socket.send(JSON.stringify(event))
  }

  socket.on('message', (rawData) => {
    try {
      const parsed = JSON.parse(rawData.toString()) as Partial<Event>
      evon.publish(parsed)
    } catch (error) {
      console.error('Invalid client event:', error)
    }
  })
})

httpServer.on('error', (error) => {
  console.error(`Failed to start server on port ${PORT}:`, error)
  process.exit(1)
})

httpServer.listen(PORT, () => {
  console.log(`Board server is running on http://localhost:${PORT}`)
})
