import type { Event } from './types'

/**
 * A reducer function that folds a single event into the current state.
 * Return the next state without mutating the previous one.  For event types
 * the reducer does not handle, return `state` unchanged.
 *
 * @param state  Current accumulated state.
 * @param event  The event being applied.
 * @returns      Next state after applying the event.
 */
export type Reducer<TState> = (state: TState, event: Event) => TState

/**
 * Options for `applyEvents`.
 */
export interface ApplyEventsOptions {
  /**
   * Called whenever the reducer returns the same state reference it received,
   * which indicates the event type was not handled.  Use this to log warnings
   * or collect metrics about unhandled event types in a projection.
   *
   * @param event  The unhandled event.
   */
  onUnhandledType?: (event: Event) => void
}

/**
 * Apply a sequence of events to an initial state using a reducer and
 * return the resulting state.  This is the canonical read-model builder:
 * it does not publish to any handler, bus, or external transport — only
 * pure state accumulation.
 *
 * @param events   Ordered list of events to fold.
 * @param initial  Starting state value.
 * @param reducer  Function that transitions state for each event.
 * @param options  Optional callbacks for observability.
 * @returns        Final accumulated state.
 */
export function applyEvents<TState>(
  events: readonly Event[],
  initial: TState,
  reducer: Reducer<TState>,
  options?: ApplyEventsOptions
): TState {
  let state = initial
  for (const event of events) {
    const next = reducer(state, event)
    if (next === state && options?.onUnhandledType !== undefined) {
      options.onUnhandledType(event)
    }
    state = next
  }
  return state
}
