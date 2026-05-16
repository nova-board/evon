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
   * @param stateOnly  When true, handlers tagged as side-effect sinks are
   *                   skipped so only pure state-builder subscribers receive
   *                   the events. Defaults to false.
   */
  replay(topic?: string, from?: number, stateOnly?: boolean): Event[]
  getEvents(filter?: EventFilter): Event[]
  getStats(): EventStats
  clear(): void
}

