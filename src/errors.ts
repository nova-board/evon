export class EvonError extends Error {
  readonly code: string | undefined

  constructor(message: string, code?: string) {
    super(message)
    this.name = new.target.name
    this.code = code
  }
}

export class EventError extends EvonError {
  constructor(message: string) {
    super(message, 'EVENT_INVALID')
  }
}

export class SubscribeError extends EvonError {
  constructor(message: string) {
    super(message, 'SUBSCRIBE_INVALID')
  }
}

export class ReplayError extends EvonError {
  constructor(message: string) {
    super(message, 'REPLAY_INVALID')
  }
}

export class HandlerError extends EvonError {
  readonly originalError: unknown

  constructor(message: string, originalError: unknown) {
    super(message, 'HANDLER_FAILURE')
    this.originalError = originalError
  }
}

