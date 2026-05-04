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

export interface EvonConfig {
  enableLogging?: boolean
  errorHandler?: (error: Error, event: Event, handler: EventHandler) => void
}

export interface Evon {
  publish(event: Partial<Event>): Event
  subscribe(topic: string, handler: EventHandler): Unsubscribe
  replay(topic?: string, from?: number): Event[]
  getEvents(filter?: EventFilter): Event[]
  getStats(): EventStats
  clear(): void
}

