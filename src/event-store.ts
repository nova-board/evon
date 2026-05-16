import { BaseEventStore } from './base-event-store'
import type { Event } from './types'

export class EventStore extends BaseEventStore {
  append(event: Event): void {
    const storedEvent = this.freezeEvent(event)
    this.events.push(storedEvent)
    this.indexEvent(storedEvent)
  }

  clear(): void {
    this.events.length = 0
    this.topicIndex.clear()
  }
}
