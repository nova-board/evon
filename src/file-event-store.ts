import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { EventError } from './errors'
import type { Event, EventFilter } from './types'

const TIMESTAMP_THRESHOLD = 100_000_000_000

type Boundary = {
  mode: 'index' | 'timestamp'
  value: number
}

function parseBoundary(value: number): Boundary {
  return value >= TIMESTAMP_THRESHOLD
    ? { mode: 'timestamp', value }
    : { mode: 'index', value }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidEvent(value: unknown): value is Event {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const obj = value as Record<string, unknown>
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['topic'] === 'string' &&
    typeof obj['type'] === 'string' &&
    typeof obj['timestamp'] === 'number' &&
    Object.prototype.hasOwnProperty.call(obj, 'payload')
  )
}

/**
 * Append-only, file-backed event store persisting events as NDJSON.
 * Events are loaded from disk on construction and appended synchronously
 * on each write so the log is always consistent.
 */
export class FileEventStore {
  private readonly events: Event[] = []
  private readonly topicIndex = new Map<string, Event[]>()
  private readonly filePath: string

  constructor(filePath: string) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new EventError('"filePath" must be a non-empty string.')
    }
    this.filePath = filePath
    this.loadFromDisk()
  }

  append(event: Event): void {
    const storedEvent: Event = event.metadata === undefined
      ? Object.freeze({ ...event })
      : Object.freeze({ ...event, metadata: { ...event.metadata } })

    this.events.push(storedEvent)
    this.indexEvent(storedEvent)
    this.writeToDisk(storedEvent)
  }

  getEvents(filter: EventFilter = {}): Event[] {
    this.validateFilter(filter)

    let results = filter.topic === undefined
      ? this.events
      : (this.topicIndex.get(filter.topic) ?? [])

    if (filter.type !== undefined) {
      results = results.filter((event) => event.type === filter.type)
    }

    const fromBoundary = filter.from === undefined ? undefined : parseBoundary(filter.from)
    const toBoundary = filter.to === undefined ? undefined : parseBoundary(filter.to)

    if (fromBoundary !== undefined || toBoundary !== undefined) {
      results = results.filter((event, index) => {
        if (fromBoundary !== undefined && !this.matchesBoundary(event, index, fromBoundary, true)) {
          return false
        }
        if (toBoundary !== undefined && !this.matchesBoundary(event, index, toBoundary, false)) {
          return false
        }
        return true
      })
    }

    if (filter.limit !== undefined) {
      return results.slice(0, filter.limit)
    }

    return results.slice()
  }

  getEventCount(): number {
    return this.events.length
  }

  getEventsByTopic(topic: string): Event[] {
    if (typeof topic !== 'string' || topic.trim().length === 0) {
      throw new EventError('"topic" must be a non-empty string.')
    }
    return (this.topicIndex.get(topic) ?? []).slice()
  }

  getTopicCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const [topic, events] of this.topicIndex.entries()) {
      counts[topic] = events.length
    }
    return counts
  }

  clear(): void {
    this.events.length = 0
    this.topicIndex.clear()
    writeFileSync(this.filePath, '', 'utf8')
  }

  private loadFromDisk(): void {
    if (!existsSync(this.filePath)) {
      return
    }

    const contents = readFileSync(this.filePath, 'utf8')
    const lines = contents.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length === 0) {
        continue
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        // Partial or corrupt tail record — stop loading, keep what is valid.
        break
      }

      if (!isValidEvent(parsed)) {
        break
      }

      const frozen: Event = parsed.metadata === undefined
        ? Object.freeze({ ...parsed })
        : Object.freeze({ ...parsed, metadata: { ...parsed.metadata } })

      this.events.push(frozen)
      this.indexEvent(frozen)
    }
  }

  private writeToDisk(event: Event): void {
    appendFileSync(this.filePath, JSON.stringify(event) + '\n', 'utf8')
  }

  private indexEvent(event: Event): void {
    const topicEvents = this.topicIndex.get(event.topic)
    if (topicEvents === undefined) {
      this.topicIndex.set(event.topic, [event])
    } else {
      topicEvents.push(event)
    }
  }

  private matchesBoundary(event: Event, index: number, boundary: Boundary, isFrom: boolean): boolean {
    if (boundary.mode === 'timestamp') {
      return isFrom ? event.timestamp >= boundary.value : event.timestamp <= boundary.value
    }
    return isFrom ? index >= boundary.value : index <= boundary.value
  }

  private validateFilter(filter: EventFilter): void {
    if (filter.topic !== undefined && (typeof filter.topic !== 'string' || filter.topic.trim().length === 0)) {
      throw new EventError('Filter "topic" must be a non-empty string.')
    }

    if (filter.type !== undefined && (typeof filter.type !== 'string' || filter.type.trim().length === 0)) {
      throw new EventError('Filter "type" must be a non-empty string.')
    }

    if (filter.from !== undefined) {
      if (!isFiniteNumber(filter.from) || !Number.isInteger(filter.from) || filter.from < 0) {
        throw new EventError('Filter "from" must be a non-negative integer.')
      }
    }

    if (filter.to !== undefined) {
      if (!isFiniteNumber(filter.to) || !Number.isInteger(filter.to) || filter.to < 0) {
        throw new EventError('Filter "to" must be a non-negative integer.')
      }
    }

    if (filter.limit !== undefined) {
      if (!isFiniteNumber(filter.limit) || !Number.isInteger(filter.limit) || filter.limit < 0) {
        throw new EventError('Filter "limit" must be a non-negative integer.')
      }
    }
  }
}
