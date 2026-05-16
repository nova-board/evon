import { ReplayError } from './errors'
import { EventBus } from './event-bus'
import type { Event, IEventStore } from './types'

function validateTopic(topic: string | undefined): void {
  if (topic !== undefined && (typeof topic !== 'string' || topic.trim().length === 0)) {
    throw new ReplayError('"topic" must be a non-empty string when provided.')
  }
}

function validateFrom(from: number): void {
  if (!Number.isInteger(from) || from < 0) {
    throw new ReplayError('"from" must be a non-negative integer.')
  }
}

function validateTimestamp(timestamp: number): void {
  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw new ReplayError('"timestamp" must be a non-negative integer.')
  }
}

export class ReplayEngine {
  constructor(
    private readonly store: IEventStore,
    private readonly bus: EventBus
  ) {}

  /**
   * Replay stored events through all live subscribers (including side-effect
   * handlers such as WebSocket broadcasters).  Use this for full re-processing.
   */
  replay(topic?: string, from = 0): Event[] {
    validateTopic(topic)
    validateFrom(from)

    const events = this.getEvents(topic).slice(from)
    for (const event of events) {
      this.bus.publish(event)
    }
    return events
  }

  /**
   * State-only replay: return the slice of stored events without publishing
   * them to any subscriber on the bus.  Side-effect handlers (e.g. WebSocket
   * broadcasters) are never invoked.  Pair with `applyEvents` to fold the
   * returned events into a read-model projection.
   */
  replayStateOnly(topic?: string, from = 0): Event[] {
    validateTopic(topic)
    validateFrom(from)

    return this.getEvents(topic).slice(from)
  }

  replayTo(topic?: string, timestamp?: number): Event[] {
    validateTopic(topic)
    if (timestamp !== undefined) {
      validateTimestamp(timestamp)
    }

    const events = this.getEvents(topic)
    const replayed = timestamp === undefined
      ? events
      : events.filter((event) => event.timestamp <= timestamp)

    for (const event of replayed) {
      this.bus.publish(event)
    }

    return replayed
  }

  private getEvents(topic?: string): Event[] {
    if (topic === undefined) {
      return this.store.getEvents()
    }
    return this.store.getEventsByTopic(topic)
  }
}
