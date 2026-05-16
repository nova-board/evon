import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { BaseEventStore } from './base-event-store'
import { EventError } from './errors'
import type { Event } from './types'

function isValidEvent(value: unknown): value is Event {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const obj = value as Record<string, unknown>
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['topic'] === 'string' &&
    typeof obj['type'] === 'string' &&
    typeof obj['timestamp'] === 'number' &&
    Object.prototype.hasOwnProperty.call(obj, 'payload')
  )
}

/**
 * Append-only, file-backed event store persisting events as NDJSON.
 * Events are loaded from disk on construction and appended synchronously
 * on each write so the log is always consistent.
 */
export class FileEventStore extends BaseEventStore {
  private readonly filePath: string

  constructor(filePath: string) {
    super()
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new EventError('"filePath" must be a non-empty string.')
    }
    this.filePath = filePath
    this.loadFromDisk()
  }

  append(event: Event): void {
    const storedEvent = this.freezeEvent(event)
    this.events.push(storedEvent)
    this.indexEvent(storedEvent)
    this.writeToDisk(storedEvent)
  }

  clear(): void {
    this.events.length = 0
    this.topicIndex.clear()
    try {
      writeFileSync(this.filePath, '', 'utf8')
    } catch (error) {
      throw new EventError(
        `Failed to clear event log at "${this.filePath}": ${(error as NodeJS.ErrnoException).message}`
      )
    }
  }

  private loadFromDisk(): void {
    if (!existsSync(this.filePath)) {
      return
    }

    const contents = readFileSync(this.filePath, 'utf8')
    const lines = contents.split('\n')

    // Identify the last non-empty line index so we can distinguish a
    // corrupt tail record (power-loss truncation) from mid-file corruption.
    let lastNonEmptyIndex = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if ((lines[i] ?? '').trim().length > 0) {
        lastNonEmptyIndex = i
        break
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const trimmed = (lines[i] ?? '').trim()
      if (trimmed.length === 0) {
        continue
      }

      const isLastRecord = i === lastNonEmptyIndex

      let parsed: unknown
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        if (isLastRecord) {
          // Partial tail write (e.g. power-loss mid-append) — silently stop.
          break
        }
        // Mid-file corruption — warn the operator and skip this line.
        console.warn(`[evon] skipping corrupt record at line ${i + 1} in "${this.filePath}"`)
        continue
      }

      if (!isValidEvent(parsed)) {
        if (isLastRecord) {
          // Tail record has unexpected shape — treat as truncated, stop.
          break
        }
        console.warn(`[evon] skipping invalid event record at line ${i + 1} in "${this.filePath}"`)
        continue
      }

      const frozen = this.freezeEvent(parsed)
      this.events.push(frozen)
      this.indexEvent(frozen)
    }
  }

  private writeToDisk(event: Event): void {
    try {
      appendFileSync(this.filePath, JSON.stringify(event) + '\n', 'utf8')
    } catch (error) {
      throw new EventError(
        `Failed to persist event to "${this.filePath}": ${(error as NodeJS.ErrnoException).message}`
      )
    }
  }
}
