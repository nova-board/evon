import { SubscribeError } from './errors'
import type { Event, EventHandler, Unsubscribe } from './types'

type HandlerErrorListener = (error: unknown, event: Event, handler: EventHandler) => void

export interface EventBusOptions {
  onHandlerError?: HandlerErrorListener
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return typeof value === 'object'
    && value !== null
    && 'then' in value
    && typeof (value as { then: unknown }).then === 'function'
}

export class EventBus {
  private readonly subscribers = new Map<string, Set<EventHandler>>()

  constructor(private readonly options: EventBusOptions = {}) {}

  subscribe(topic: string, handler: EventHandler): Unsubscribe {
    this.validateSubscription(topic, handler)

    const existing = this.subscribers.get(topic)
    if (existing === undefined) {
      this.subscribers.set(topic, new Set([handler]))
    } else {
      existing.add(handler)
    }

    let isUnsubscribed = false
    return () => {
      if (isUnsubscribed) {
        return
      }
      isUnsubscribed = true

      const handlers = this.subscribers.get(topic)
      if (handlers === undefined) {
        return
      }

      handlers.delete(handler)
      if (handlers.size === 0) {
        this.subscribers.delete(topic)
      }
    }
  }

  emit(event: Event): void {
    const handlers = this.subscribers.get(event.topic)
    if (handlers === undefined || handlers.size === 0) {
      return
    }

    for (const handler of Array.from(handlers)) {
      this.runHandler(handler, event)
    }
  }

  getSubscriberCount(topic: string): number {
    const handlers = this.subscribers.get(topic)
    return handlers?.size ?? 0
  }

  getTotalSubscriberCount(): number {
    let count = 0
    for (const handlers of this.subscribers.values()) {
      count += handlers.size
    }
    return count
  }

  clear(): void {
    this.subscribers.clear()
  }

  private runHandler(handler: EventHandler, event: Event): void {
    try {
      const result = handler(event)

      if (isPromiseLike(result)) {
        void result.catch((error: unknown) => {
          this.options.onHandlerError?.(error, event, handler)
        })
      }
    } catch (error) {
      this.options.onHandlerError?.(error, event, handler)
    }
  }

  private validateSubscription(topic: string, handler: EventHandler): void {
    if (typeof topic !== 'string' || topic.trim().length === 0) {
      throw new SubscribeError('"topic" must be a non-empty string.')
    }

    if (typeof handler !== 'function') {
      throw new SubscribeError('"handler" must be a function.')
    }
  }
}

