export interface Event {
  id: string
  topic: string
  type: string
  payload: unknown
  timestamp: number
  metadata?: Record<string, unknown>
}

export type EventHandler = (event: Event) => void | Promise<void>

export interface EventFilter {
  topic?: string
  type?: string
  from?: number
  to?: number
  limit?: number
}

export type Unsubscribe = () => void

export interface EventStats {
  totalEvents: number
  topicCount: number
  handlerCount: number
  topics: Record<string, number>
}

/**
 * Contract that all event store implementations must satisfy.
 * Both the in-memory `EventStore` and the file-backed `FileEventStore`
 * implement this interface so consumers (e.g. `ReplayEngine`) can depend
 * on the abstraction rather than concrete types.
 */
export interface IEventStore {
  append(event: Event): void
  getEvents(filter?: EventFilter): Event[]
  getEventsByTopic(topic: string): Event[]
  getEventCount(): number
  getTopicCounts(): Record<string, number>
  clear(): void
}

export interface PersistenceConfig {
  /**
   * Absolute or relative path to the NDJSON event log file.
   * When provided, a FileEventStore is used and events are persisted
   * to disk on every publish.
   */
  filePath: string
}

export interface EvonConfig {
  enableLogging?: boolean
  errorHandler?: (error: Error, event: Event, handler: EventHandler) => void
  /**
   * When set, events are persisted to the specified file and loaded
   * back on startup so state survives process restarts.
   */
  persistence?: PersistenceConfig
}

export interface Evon {
  publish(event: Partial<Event>): Event
  subscribe(topic: string, handler: EventHandler): Unsubscribe
  /**
   * Replay stored events through live handlers.
   *
   * @param topic      Restrict replay to a specific topic. Replays all topics
   *                   when omitted.
   * @param from       Index (or timestamp) of the first event to replay.
   * @param stateOnly  When true, no handlers are invoked. The matched events
   *                   are returned to the caller for use with `applyEvents`
   *                   without triggering any subscribers. Defaults to false.
   */
  replay(topic?: string, from?: number, stateOnly?: boolean): Event[]
  getEvents(filter?: EventFilter): Event[]
  getStats(): EventStats
  clear(): void
}

