import { randomUUID } from 'crypto'
import { EventBus } from './event-bus'
import { EventStore } from './event-store'
import { EventError, HandlerError } from './errors'
import { ReplayEngine } from './replay-engine'
import type { Event, EventFilter, EventHandler, EventStats, Evon, EvonConfig } from './types'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EventError(`Event "${fieldName}" must be a non-empty string.`)
  }
  return value
}

function readTimestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new EventError('Event "timestamp" must be a non-negative integer.')
  }
  return value
}

function readMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!isObject(value)) {
    throw new EventError('Event "metadata" must be an object when provided.')
  }
  return { ...value }
}

function normalizeEvent(input: Partial<Event>): Event {
  if (!isObject(input)) {
    throw new EventError('Event input must be an object.')
  }

  const topic = readNonEmptyString(input.topic, 'topic')
  const type = readNonEmptyString(input.type, 'type')

  if (!Object.prototype.hasOwnProperty.call(input, 'payload')) {
    throw new EventError('Event "payload" is required.')
  }

  const payload = input.payload as unknown
  const id = input.id === undefined ? randomUUID() : readNonEmptyString(input.id, 'id')
  const timestamp = input.timestamp === undefined ? Date.now() : readTimestamp(input.timestamp)
  const metadata = readMetadata(input.metadata)

  const baseEvent: Event = {
    id,
    topic,
    type,
    payload,
    timestamp
  }

  if (metadata === undefined) {
    return baseEvent
  }

  return {
    ...baseEvent,
    metadata
  }
}

export function createEvon(config: EvonConfig = {}): Evon {
  const enableLogging = config.enableLogging ?? false
  const store = new EventStore()

  const onHandlerError = (error: unknown, event: Event, handler: EventHandler): void => {
    const wrapped = error instanceof HandlerError
      ? error
      : new HandlerError(
          `Handler failed for event "${event.type}" on topic "${event.topic}".`,
          error
        )

    if (config.errorHandler !== undefined) {
      config.errorHandler(wrapped, event, handler)
      return
    }

    console.error(wrapped)
  }

  const bus = new EventBus({ onHandlerError })
  const replayEngine = new ReplayEngine(store, bus)

  const publish = (event: Partial<Event>): Event => {
    const normalized = normalizeEvent(event)
    store.append(normalized)
    bus.emit(normalized)

    if (enableLogging) {
      console.info(`[evon] published ${normalized.topic}:${normalized.type}`)
    }

    return normalized
  }

  const replay = (topic?: string, from = 0): Event[] => {
    const replayed = replayEngine.replay(topic, from)

    if (enableLogging) {
      const replayTarget = topic === undefined ? 'all-topics' : topic
      console.info(`[evon] replayed ${replayed.length} event(s) for ${replayTarget}`)
    }

    return replayed
  }

  const getEvents = (filter?: EventFilter): Event[] => {
    return store.getEvents(filter)
  }

  const getStats = (): EventStats => {
    const topics = store.getTopicCounts()
    return {
      totalEvents: store.getEventCount(),
      topicCount: Object.keys(topics).length,
      handlerCount: bus.getTotalSubscriberCount(),
      topics
    }
  }

  const clear = (): void => {
    store.clear()
    bus.clear()

    if (enableLogging) {
      console.info('[evon] runtime cleared')
    }
  }

  return {
    publish,
    subscribe: (topic: string, handler: EventHandler) => bus.subscribe(topic, handler),
    replay,
    getEvents,
    getStats,
    clear
  }
}

