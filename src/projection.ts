import type { Event } from './types'

/**
 * A reducer function that folds a single event into the current state.
 * Return the next state without mutating the previous one.
 *
 * @param state  Current accumulated state.
 * @param event  The event being applied.
 * @returns      Next state after applying the event.
 */
export type Reducer<TState> = (state: TState, event: Event) => TState

/**
 * Apply a sequence of events to an initial state using a reducer and
 * return the resulting state.  This is the canonical read-model builder:
 * it does not publish to any handler, bus, or external transport — only
 * pure state accumulation.
 *
 * @param events   Ordered list of events to fold.
 * @param initial  Starting state value.
 * @param reducer  Function that transitions state for each event.
 * @returns        Final accumulated state.
 */
export function applyEvents<TState>(
  events: readonly Event[],
  initial: TState,
  reducer: Reducer<TState>
): TState {
  let state = initial
  for (const event of events) {
    state = reducer(state, event)
  }
  return state
}
