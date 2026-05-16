import { EventError } from './errors'
import type { Event, EventFilter, IEventStore } from './types'

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

/**
 * Shared event-store logic: in-memory index, filtering, and validation.
 * Both `EventStore` and `FileEventStore` extend this base class so the
 * query/filter logic lives in exactly one place.
 */
export abstract class BaseEventStore implements IEventStore {
  protected readonly events: Event[] = []
  protected readonly topicIndex = new Map<string, Event[]>()

  abstract append(event: Event): void
  abstract clear(): void

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

    for (const [topic, topicEvents] of this.topicIndex.entries()) {
      counts[topic] = topicEvents.length
    }

    return counts
  }

  protected indexEvent(event: Event): void {
    const topicEvents = this.topicIndex.get(event.topic)
    if (topicEvents === undefined) {
      this.topicIndex.set(event.topic, [event])
    } else {
      topicEvents.push(event)
    }
  }

  protected freezeEvent(event: Event): Event {
    return event.metadata === undefined
      ? Object.freeze({ ...event })
      : Object.freeze({ ...event, metadata: { ...event.metadata } })
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
