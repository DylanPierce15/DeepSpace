/**
 * Cross-App Activity Tracking — LinkedRef Convention
 *
 * The `conversations` schema in every `dir:{appName}` DO already has a
 * `LinkedRef` JSON field. This module defines the canonical shape and
 * provides helpers for parsing, creating, and filtering by LinkedRef.
 *
 * Any app that creates cross-app-referenceable entries should use this
 * shape so that other apps (like command-center) can query:
 * "show me everything linked to contact X" by filtering on LinkedRef.
 *
 * @example
 * import { LinkedRef, stringifyLinkedRef, parseLinkedRef } from '@deepspace/sdk-worker'
 *
 * // Creating a linked entry
 * const ref: LinkedRef = {
 *   source: 'deepspace-crm',
 *   type: 'contact',
 *   id: 'contact-123',
 *   label: 'Acme Corp — John Smith',
 * }
 * await ctx.tools.create('dir:deepspace-crm', 'conversations', {
 *   ...fields,
 *   LinkedRef: stringifyLinkedRef(ref),
 * })
 *
 * // Reading and filtering
 * const ref = parseLinkedRef(record.data.LinkedRef)
 * if (ref?.source === 'deepspace-crm' && ref.type === 'contact') { ... }
 */

// ── LinkedRef type ──────────────────────────────────────────────────────────

export interface LinkedRef {
  /** App that created this entry (e.g. 'deepspace-crm', 'deepspace-tasks') */
  source: string
  /** Entity type in the source app (e.g. 'contact', 'task', 'ticket', 'deal') */
  type: string
  /** Entity ID in the source app's scope */
  id: string
  /** Optional: related contact in workspace:default people */
  contactId?: string
  /** Optional: human-readable label for display */
  label?: string
  /** Optional: additional metadata (priority, status, etc.) */
  [key: string]: unknown
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a LinkedRef JSON string. Returns null for empty/invalid values. */
export function parseLinkedRef(val: string | null | undefined): LinkedRef | null {
  if (!val) return null
  try {
    const parsed = JSON.parse(val)
    if (typeof parsed === 'object' && parsed !== null && parsed.source && parsed.type) {
      return parsed as LinkedRef
    }
    return null
  } catch {
    return null
  }
}

/** Serialize a LinkedRef to a JSON string for storage. */
export function stringifyLinkedRef(ref: LinkedRef): string {
  return JSON.stringify(ref)
}

/**
 * Test whether a LinkedRef matches a filter.
 * All provided filter fields must match (AND logic).
 *
 * @example
 * matchesLinkedRef(ref, { source: 'deepspace-crm', type: 'contact' })
 * matchesLinkedRef(ref, { contactId: 'contact-123' })
 */
export function matchesLinkedRef(
  ref: LinkedRef | null,
  filter: Partial<Pick<LinkedRef, 'source' | 'type' | 'id' | 'contactId'>>,
): boolean {
  if (!ref) return false
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && (ref as Record<string, unknown>)[key] !== value) {
      return false
    }
  }
  return true
}

// ── Action Helpers ──────────────────────────────────────────────────────────

/**
 * Standard conversation fields for creating a linked activity entry
 * in a directory DO via a server action.
 *
 * @example
 * import { buildLinkedConversation } from '@deepspace/sdk-worker'
 *
 * const fields = buildLinkedConversation({
 *   name: 'Call with John Smith',
 *   type: 'note',
 *   userId: ctx.userId,
 *   preview: 'Discussed Q1 targets...',
 *   ref: { source: 'deepspace-crm', type: 'contact', id: contactId, label: 'John Smith' },
 * })
 * await ctx.tools.create('dir:deepspace-crm', 'conversations', fields)
 */
export function buildLinkedConversation(opts: {
  name: string
  description?: string
  type: string
  userId: string
  participantIds?: string[]
  preview?: string
  ref: LinkedRef
}): Record<string, unknown> {
  return {
    Name: opts.name,
    Description: opts.description ?? '',
    Type: opts.type,
    Visibility: 'private',
    CreatedBy: opts.userId,
    ParticipantHash: '',
    ParticipantIds: opts.participantIds ? JSON.stringify(opts.participantIds) : JSON.stringify([opts.userId]),
    Status: 'active',
    AssigneeId: '',
    LinkedRef: stringifyLinkedRef(opts.ref),
    LastMessageAt: new Date().toISOString(),
    LastMessagePreview: (opts.preview ?? opts.name).slice(0, 100),
    LastMessageAuthor: opts.userId,
    MessageCount: 0,
  }
}
