/**
 * Collection Schema Definitions & Validation
 * 
 * Defines the structure for collection permissions and provides
 * server-side validation for all record operations.
 */

// ============================================================================
// Types
// ============================================================================

export interface FieldSchema {
  /** Data type for validation. 'yjs' fields store collaborative Y.Doc state. */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'yjs'
  /** Field is required on create (not applicable to 'yjs' fields) */
  required?: boolean
  /** Field must equal current user's ID (auto-set if not provided) */
  userBound?: boolean
  /** Field cannot be changed after creation */
  immutable?: boolean
  /** Default value applied on create if field is not provided (also prevents user from overriding) */
  default?: unknown
  /** 
   * System-managed field: can only be set by the system (registerUser), not by client mutations.
   * Used for core user fields like email, name, role that come from auth.
   */
  systemManaged?: boolean
  /** 
   * Trigger-based timestamp: auto-set this field to current ISO timestamp when trigger fires.
   * Only fires once (won't overwrite if timestamp already set).
   * 
   * Examples:
   * - { field: 'claimedByUserId' } - sets timestamp when claimedByUserId becomes truthy
   * - { field: 'submitted', value: true } - sets timestamp when submitted becomes true
   */
  timestampTrigger?: {
    /** Field that triggers this timestamp */
    field: string
    /** Optional: only trigger when field becomes this specific value */
    value?: unknown
  }
}

// ============================================================================
// Column Definitions (Table-Mode Storage)
// ============================================================================

export type ColumnInterpretation =
  | { kind: 'plain' }
  | { kind: 'currency'; symbol: string; decimals: number }
  | { kind: 'date'; format?: string }
  | { kind: 'datetime'; format?: string }
  | { kind: 'boolean'; trueLabel?: string; falseLabel?: string }
  | { kind: 'percent'; decimals?: number }
  | { kind: 'select'; options: string[] }
  | { kind: 'multiselect'; options: string[] }
  | { kind: 'url' }
  | { kind: 'email' }
  | { kind: 'json' }
  | { kind: 'reference'; targetTable: string; displayColumn: string }

export interface ColumnDefinition {
  /** Optional stable ID. If set, used instead of derived columnId(name). Survives renames. */
  id?: string
  name: string
  storage: 'number' | 'text'
  interpretation: ColumnInterpretation | string
  expression?: string
}

/**
 * Resolved column with its SQL-safe ID and metadata.
 * Built from a ColumnDefinition during schema registration.
 */
export interface ResolvedColumn {
  id: string
  name: string
  storage: 'number' | 'text'
  interpretation: ColumnInterpretation
  expression?: string
  readonly: boolean
}

/**
 * SQL table name for a table-mode collection.
 */
export function collectionTableName(collectionName: string): string {
  return `c_${collectionName.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

/**
 * Convert a column name to a SQL-safe column ID (col_xxx).
 */
export function columnId(name: string): string {
  return `col_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
}

/**
 * Resolve a ColumnDefinition into a ResolvedColumn with computed id.
 */
export function resolveColumn(col: ColumnDefinition): ResolvedColumn {
  const interp: ColumnInterpretation = typeof col.interpretation === 'string'
    ? ({ kind: col.interpretation } as ColumnInterpretation)
    : col.interpretation
  return {
    id: col.id ?? columnId(col.name),
    name: col.name,
    storage: col.storage,
    interpretation: interp,
    expression: col.expression,
    readonly: !!col.expression,
  }
}

/**
 * Build a data object from a SQL row, mapping col_xxx columns back to field names.
 */
export function rowToData(row: Record<string, unknown>, columns: ResolvedColumn[]): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const col of columns) {
    if (row[col.id] !== undefined && row[col.id] !== null) {
      let val = row[col.id]
      if (col.interpretation.kind === 'json' && typeof val === 'string') {
        try { val = JSON.parse(val as string) } catch { /* keep as string */ }
      }
      data[col.name] = val
    }
  }
  return data
}

/**
 * Decompose a data object into SQL column values for INSERT/UPDATE.
 */
export function dataToColumnValues(
  data: Record<string, unknown>,
  columns: ResolvedColumn[]
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const col of columns) {
    if (col.expression || col.readonly) continue
    const val = data[col.id] ?? data[col.name]
    if (val !== undefined) {
      values[col.id] = coerceValue(val, col.storage, col.interpretation)
    }
  }
  return values
}

/**
 * Coerce a value for SQL storage based on column type.
 * Ported from TableDO — handles currency symbols, percentages, dates, booleans.
 */
export function coerceValue(
  value: unknown,
  storage: 'number' | 'text',
  interpretation: ColumnInterpretation
): unknown {
  if (value === null || value === undefined || value === '') return null

  if (storage === 'text') {
    if (interpretation.kind === 'json') {
      if (typeof value === 'string') return value
      try { return JSON.stringify(value) } catch { return null }
    }
    return typeof value === 'string' ? value : String(value)
  }

  if (typeof value === 'number') return isFinite(value) ? value : null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value !== 'string') return String(value)

  const s = value.trim()

  if (interpretation.kind === 'boolean') {
    const lower = s.toLowerCase()
    if (lower === 'true' || lower === '1' || lower === 'yes') return 1
    if (lower === 'false' || lower === '0' || lower === 'no') return 0
    return s
  }

  if (interpretation.kind === 'percent') {
    const m = s.match(/^(-?\d+(?:\.\d+)?)\s*%$/)
    if (m) return parseFloat(m[1]) / 100
  }

  if (interpretation.kind === 'currency') {
    const cleaned = s.replace(/[^0-9.\-]/g, '')
    const n = parseFloat(cleaned)
    if (!isNaN(n)) return n
    return s
  }

  if (interpretation.kind === 'date' || interpretation.kind === 'datetime') {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000)
    return s
  }

  const cleaned = s.replace(/[$€£¥,\s]/g, '')
  const n = parseFloat(cleaned)
  if (!isNaN(n) && isFinite(n)) return n

  return s
}

// ============================================================================
// Auto-derive columns from fields (document-mode → table-mode)
// ============================================================================

/**
 * Convert a `fields` record into a `ColumnDefinition[]`.
 * Used to auto-derive columns for schemas that only defined `fields`.
 *
 * Mapping:
 * - string → text/plain
 * - number → number/plain
 * - boolean → number/boolean
 * - object → text/json
 * - array → text/json
 * - yjs → skipped (data lives in yjs_docs, not the record)
 */
export function fieldsToColumns(fields: Record<string, FieldSchema>): ColumnDefinition[] {
  const columns: ColumnDefinition[] = []
  for (const [name, field] of Object.entries(fields)) {
    switch (field.type) {
      case 'string':
        columns.push({ name, storage: 'text', interpretation: 'plain' })
        break
      case 'number':
        columns.push({ name, storage: 'number', interpretation: 'plain' })
        break
      case 'boolean':
        columns.push({ name, storage: 'number', interpretation: { kind: 'boolean' } })
        break
      case 'object':
      case 'array':
        columns.push({ name, storage: 'text', interpretation: { kind: 'json' } })
        break
      case 'yjs':
        // Yjs fields are stored in yjs_docs table, not in the record
        break
    }
  }
  return columns
}

/**
 * Ensure a schema has `columns` by auto-deriving from `fields` if needed.
 * Schemas that already have hand-crafted `columns` are returned untouched.
 * Returns a new schema object (never mutates the input).
 */
export function ensureColumns(schema: CollectionSchema): CollectionSchema {
  // Already has columns — don't override hand-crafted definitions
  if (schema.columns && schema.columns.length > 0) return schema
  // No fields to derive from — return with empty columns (system-columns-only table)
  if (!schema.fields || Object.keys(schema.fields).length === 0) {
    return { ...schema, columns: schema.columns ?? [] }
  }
  return { ...schema, columns: fieldsToColumns(schema.fields) }
}

/**
 * Build a SELECT clause that includes computed columns for a table-mode collection.
 */
export function buildTableSelect(collectionName: string, columns: ResolvedColumn[]): string {
  const tbl = collectionTableName(collectionName)
  const parts: string[] = ['_row_id', '_created_by', '_created_at', '_updated_at']
  for (const col of columns) {
    if (col.expression) {
      parts.push(`(${col.expression}) AS "${col.id}"`)
    } else {
      parts.push(`"${col.id}"`)
    }
  }
  return `SELECT ${parts.join(', ')} FROM "${tbl}"`
}

/**
 * Permission levels:
 * - true: everyone with this role
 * - false: no one
 * - 'own': only the record owner
 * - 'unclaimed-or-own': owner field is empty OR matches user (for claimable records)
 * - 'collaborator': owner OR in collaborators array
 * - 'team': owner OR collaborator OR team member
 * - 'access': alias for 'team' (most permissive)
 * - 'published': owner OR passes visibility check (public/shared)
 * - 'shared': owner OR collaborator OR published — for per-record sharing with public fallback
 */
export type PermissionLevel = boolean | 'own' | 'unclaimed-or-own' | 'collaborator' | 'team' | 'access' | 'published' | 'shared'

export interface RolePermissions {
  /** Can read records */
  read: PermissionLevel
  /** Can create new records */
  create: boolean
  /** Can update records */
  update: PermissionLevel
  /** Can delete records */
  delete: PermissionLevel
  /** 
   * Field-level write permissions. If set, this role can ONLY update these specific fields.
   * Fields not in this list cannot be modified by this role (even if update permission allows).
   * If not set, all fields can be updated (subject to immutable/userBound constraints).
   */
  writableFields?: string[]
}

export interface CollectionSchema {
  /** Collection name (used as table key) */
  name: string
  /** Field definitions for validation (only needed for document-mode collections) */
  fields?: Record<string, FieldSchema>
  /**
   * Column definitions for table-mode storage.
   * When set, the collection stores data in a typed SQL table instead of JSON blobs.
   * Schema field validation is bypassed in favor of column-level type coercion.
   */
  columns?: ColumnDefinition[]
  /** Composite uniqueness constraint (e.g., ['userId', 'taskId']) */
  uniqueOn?: string[]
  /** Field that determines ownership (default: uses created_by) */
  ownerField?: string
  /** Field containing array of collaborator user IDs */
  collaboratorsField?: string
  /** Field containing team ID for team-based access */
  teamField?: string
  /**
   * Field that controls per-record read visibility for non-owners.
   * Used with the 'published' permission level.
   * - string form: record is visible when `data[field] === 'public'`
   * - object form: record is visible when `data[field] === value`
   * Records without the field set (or set to a non-matching value) are private.
   */
  visibilityField?: string | { field: string; value: unknown }
  /** Permissions per role */
  permissions: Record<string, RolePermissions>
  /**
   * Default role for new users (only meaningful on the 'users' collection).
   * Overrides the RecordRoom default ('member') when set.
   */
  defaultRole?: string
}

export interface User {
  id: string
  email: string
  name: string
  imageUrl?: string
  role: string
  createdAt: string
  lastSeenAt: string
}

export interface StoredRecord {
  collection: string
  recordId: string
  data: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Permission Checking
// ============================================================================

/**
 * Context for permission checks that require database access.
 * Used for team membership lookups.
 */
export interface PermissionContext {
  /** Check if user is a member of a team */
  isTeamMember: (teamId: string, userId: string) => boolean
}

/** No-op context for when teams aren't needed */
export const noopPermissionContext: PermissionContext = {
  isTeamMember: () => false,
}

/**
 * Get permissions for a role in a collection.
 * Checks for exact role match first, then '*' wildcard.
 * Falls back to a deny-all default if neither defined.
 */
export function getRolePermissions(
  schema: CollectionSchema,
  role: string
): RolePermissions {
  // Check exact role first
  if (schema.permissions[role]) {
    return schema.permissions[role]
  }
  // Check wildcard '*' (applies to any role)
  if (schema.permissions['*']) {
    return schema.permissions['*']
  }
  // Default: deny all
  return {
    read: false,
    create: false,
    update: false,
    delete: false,
  }
}

/**
 * Check if a user is the owner of a record.
 */
export function isOwner(
  schema: CollectionSchema,
  record: { data: Record<string, unknown>; createdBy: string },
  userId: string
): boolean {
  if (schema.ownerField) {
    return record.data[schema.ownerField] === userId
  }
  return record.createdBy === userId
}

/**
 * Check if user is a collaborator on a record.
 *
 * Handles multiple storage formats:
 * - null/undefined/'' → treated as "public" (everyone can access) for backward compat
 * - JSON string (from SQLite text column) → parsed and checked for userId
 * - JS array (from document-mode storage) → checked directly for userId
 */
export function isCollaborator(
  schema: CollectionSchema,
  record: { data: Record<string, unknown> },
  userId: string
): boolean {
  if (!schema.collaboratorsField) return false
  const collaborators = record.data[schema.collaboratorsField]
  // null/undefined/empty → no collaborators set, deny access
  if (collaborators === null || collaborators === undefined || collaborators === '') return false
  // JS array (document-mode)
  if (Array.isArray(collaborators)) {
    return collaborators.includes(userId)
  }
  // JSON string (SQLite text column)
  if (typeof collaborators === 'string') {
    try {
      const parsed = JSON.parse(collaborators)
      if (Array.isArray(parsed)) return parsed.includes(userId)
    } catch {}
    return false
  }
  return false
}

/**
 * Check if user has team access to a record.
 */
export function hasTeamAccess(
  schema: CollectionSchema,
  record: { data: Record<string, unknown>; recordId?: string },
  userId: string,
  ctx: PermissionContext
): boolean {
  if (!schema.teamField) return false
  // '_rowId' sentinel: the record's own ID is the team ID (e.g. teams table)
  const teamId = schema.teamField === '_rowId'
    ? record.recordId
    : record.data[schema.teamField]
  if (typeof teamId !== 'string') return false
  return ctx.isTeamMember(teamId, userId)
}

/**
 * Check if a record is "published" (visible to non-owners) based on the
 * schema's visibilityField. Safe by default: returns false if no visibilityField
 * is configured or if the field doesn't match the expected value.
 */
export function isPublished(
  schema: CollectionSchema,
  record: { data: Record<string, unknown> },
): boolean {
  if (!schema.visibilityField) return false
  if (typeof schema.visibilityField === 'string') {
    return record.data[schema.visibilityField] === 'public'
  }
  return record.data[schema.visibilityField.field] === schema.visibilityField.value
}

/**
 * Check if user has access based on permission level.
 */
function checkPermissionLevel(
  level: PermissionLevel,
  schema: CollectionSchema,
  record: { data: Record<string, unknown>; createdBy: string; recordId?: string },
  userId: string,
  ctx: PermissionContext
): boolean {
  if (level === true) return true
  if (level === false) return false
  if (level === 'own') return isOwner(schema, record, userId)
  if (level === 'unclaimed-or-own') {
    // Allow if owner field is empty (unclaimed) OR matches user
    if (schema.ownerField) {
      const ownerValue = record.data[schema.ownerField]
      return ownerValue === undefined || ownerValue === null || ownerValue === '' || ownerValue === userId
    }
    return isOwner(schema, record, userId)
  }
  if (level === 'collaborator') {
    return isOwner(schema, record, userId) || isCollaborator(schema, record, userId)
  }
  if (level === 'team' || level === 'access') {
    return isOwner(schema, record, userId) ||
           isCollaborator(schema, record, userId) ||
           hasTeamAccess(schema, record, userId, ctx)
  }
  if (level === 'published') {
    return isOwner(schema, record, userId) || isPublished(schema, record)
  }
  if (level === 'shared') {
    return isOwner(schema, record, userId) ||
           isCollaborator(schema, record, userId) ||
           isPublished(schema, record)
  }
  return false
}

/**
 * Check if user can read a specific record.
 */
export function canRead(
  schema: CollectionSchema,
  role: string,
  record: { data: Record<string, unknown>; createdBy: string; recordId?: string },
  userId: string,
  ctx: PermissionContext = noopPermissionContext
): boolean {
  const perms = getRolePermissions(schema, role)
  return checkPermissionLevel(perms.read, schema, record, userId, ctx)
}

/**
 * Check if user can create records in this collection.
 */
export function canCreate(
  schema: CollectionSchema,
  role: string
): boolean {
  const perms = getRolePermissions(schema, role)
  return perms.create === true
}

/**
 * Check if user can update a specific record.
 */
export function canUpdate(
  schema: CollectionSchema,
  role: string,
  record: { data: Record<string, unknown>; createdBy: string; recordId?: string },
  userId: string,
  ctx: PermissionContext = noopPermissionContext
): boolean {
  const perms = getRolePermissions(schema, role)
  return checkPermissionLevel(perms.update, schema, record, userId, ctx)
}

/**
 * Check if user can delete a specific record.
 */
export function canDelete(
  schema: CollectionSchema,
  role: string,
  record: { data: Record<string, unknown>; createdBy: string; recordId?: string },
  userId: string,
  ctx: PermissionContext = noopPermissionContext
): boolean {
  const perms = getRolePermissions(schema, role)
  return checkPermissionLevel(perms.delete, schema, record, userId, ctx)
}

/**
 * Check field-level write permissions during update.
 * Returns error message if any field is not writable, null if all fields are allowed.
 */
export function checkFieldPermissions(
  schema: CollectionSchema,
  role: string,
  newData: Record<string, unknown>,
  existingData: Record<string, unknown>
): string | null {
  const perms = getRolePermissions(schema, role)
  
  // If no writableFields defined, all fields can be updated
  if (!perms.writableFields) {
    return null
  }
  
  const allowedFields = new Set(perms.writableFields)
  
  // Check each field being updated
  for (const fieldName of Object.keys(newData)) {
    const newValue = newData[fieldName]
    const oldValue = existingData[fieldName]
    
    // Skip if value hasn't changed
    if (newValue === oldValue) {
      continue
    }
    
    // Also skip if both are effectively "empty"
    if ((newValue === undefined || newValue === null || newValue === '') &&
        (oldValue === undefined || oldValue === null || oldValue === '')) {
      continue
    }
    
    // Check if this field is writable
    if (!allowedFields.has(fieldName)) {
      return `Cannot update field '${fieldName}': not in writable fields for role '${role}'`
    }
  }
  
  return null
}

/**
 * Strip system-managed fields from incoming data, preserving them from existing data.
 * 
 * This allows apps to safely pass user records without manually removing
 * system fields - the SDK will automatically ignore changes to them while
 * preserving the existing values.
 * 
 * @param schema - The collection schema
 * @param newData - Incoming data (may contain system fields to ignore)
 * @param existingData - Existing record data (system fields will be preserved from here)
 * @returns A new object with app fields from newData and system fields from existingData
 */
export function stripSystemManagedFields(
  schema: CollectionSchema,
  newData: Record<string, unknown>,
  existingData?: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  
  // First, copy all non-system fields from newData
  for (const [key, value] of Object.entries(newData)) {
    const fieldSchema = schema.fields?.[key]
    // Keep the field if it's not system-managed (or not in schema at all - app fields)
    if (!fieldSchema?.systemManaged) {
      result[key] = value
    }
  }

  // Then, preserve system-managed fields from existing data
  if (existingData && schema.fields) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      if (fieldSchema.systemManaged && existingData[fieldName] !== undefined) {
        result[fieldName] = existingData[fieldName]
      }
    }
  }
  
  return result
}

/**
 * Check for system-managed field violations.
 * Returns error message if trying to modify a system-managed field, null if OK.
 * 
 * System-managed fields can only be set by registerUser(), not by client mutations.
 * 
 * @deprecated Use stripSystemManagedFields instead - it's safer as it silently removes
 * system fields rather than erroring. This function is kept for backwards compatibility.
 */
export function checkSystemManagedFields(
  schema: CollectionSchema,
  newData: Record<string, unknown>,
  existingData: Record<string, unknown> | undefined
): string | null {
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields || {})) {
    if (!fieldSchema.systemManaged) continue

    const newValue = newData[fieldName]
    const oldValue = existingData?.[fieldName]
    
    // Skip if not being set
    if (newValue === undefined) continue
    
    // Skip if value hasn't changed
    if (newValue === oldValue) continue
    
    // Can't set system-managed fields via normal mutations
    return `Cannot modify system-managed field: ${fieldName}`
  }
  
  return null
}

// ============================================================================
// Base Users Collection Schema
// ============================================================================

/**
 * Core user fields that are system-managed.
 * Apps extend this with their own fields.
 */
export const USERS_COLLECTION_FIELDS: Record<string, FieldSchema> = {
  email: { type: 'string', systemManaged: true },
  name: { type: 'string', systemManaged: true },
  imageUrl: { type: 'string', systemManaged: true },
  role: { type: 'string', systemManaged: true },
  createdAt: { type: 'string', systemManaged: true, immutable: true },
  lastSeenAt: { type: 'string', systemManaged: true },
}

/**
 * Base users collection schema.
 * Apps should extend this with their own fields and permissions.
 */
export const BASE_USERS_SCHEMA: CollectionSchema = {
  name: 'users',
  fields: USERS_COLLECTION_FIELDS,
  permissions: {
    '*': { read: 'own', create: false, update: false, delete: false },
    admin: { read: true, create: false, update: true, delete: true },
  },
}

// ============================================================================
// Data Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean
  error?: string
  /** Data with auto-set fields (userBound) applied */
  data?: Record<string, unknown>
}

/**
 * Validate record data against schema.
 * 
 * @param schema - Collection schema
 * @param data - Record data to validate
 * @param userId - Current user's ID
 * @param userRole - Current user's role (admins can bypass userBound)
 * @param existingData - Existing record data (for update validation)
 */
export function validateRecordData(
  schema: CollectionSchema,
  data: Record<string, unknown>,
  userId: string,
  userRole: string,
  existingData?: Record<string, unknown>
): ValidationResult {
  const isUpdate = existingData !== undefined
  const validatedData = { ...data }
  const isAdmin = userRole === 'admin'

  // First pass: standard field validation
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields || {})) {
    const value = data[fieldName]
    const existingValue = existingData?.[fieldName]

    // Skip 'yjs' fields - they're stored separately and synced via WebSocket
    if (fieldSchema.type === 'yjs') {
      continue
    }

    // Default values: on CREATE, apply default only when user didn't provide a value
    if (!isUpdate && value === undefined && fieldSchema.default !== undefined) {
      validatedData[fieldName] = fieldSchema.default
      continue // Skip other checks for this field - default applied
    }

    // UserBound: auto-set to current user's ID if not provided.
    // Non-admins are restricted to their own ID; admins can set any userId.
    if (fieldSchema.userBound) {
      if (!isAdmin && value !== undefined && value !== userId && value !== existingValue) {
        return { 
          valid: false, 
          error: `Field '${fieldName}' must be your user ID` 
        }
      }
      // Auto-set if not provided (for all roles, including admins)
      if (value === undefined && !isUpdate) {
        validatedData[fieldName] = userId
      }
    }

    // Required check (only on create, skip if userBound since it's auto-set)
    const effectiveValue = validatedData[fieldName] ?? value
    if (fieldSchema.required && !isUpdate && effectiveValue === undefined) {
      return { valid: false, error: `Missing required field: ${fieldName}` }
    }

    // Coerce number→boolean for boolean fields (SQLite stores booleans as 0/1)
    if (fieldSchema.type === 'boolean' && typeof effectiveValue === 'number') {
      validatedData[fieldName] = effectiveValue !== 0
    }

    // Type check (if value is provided)
    const coercedValue = validatedData[fieldName] ?? effectiveValue
    if (coercedValue !== undefined && coercedValue !== null) {
      const actualType = Array.isArray(coercedValue) ? 'array' : typeof coercedValue
      if (actualType !== fieldSchema.type) {
        return {
          valid: false,
          error: `Field '${fieldName}' must be ${fieldSchema.type}, got ${actualType}`
        }
      }
    }

    // Immutable check: cannot change after creation
    if (isUpdate && fieldSchema.immutable) {
      if (value !== undefined && value !== existingValue) {
        return { 
          valid: false, 
          error: `Cannot change immutable field: ${fieldName}` 
        }
      }
      // Preserve existing value
      validatedData[fieldName] = existingValue
    }
  }

  // Second pass: trigger-based timestamps
  // Must be done after first pass so we can check the final values of trigger fields
  for (const [fieldName, fieldSchema] of Object.entries(schema.fields || {})) {
    if (!fieldSchema.timestampTrigger) continue

    const { field: triggerField, value: triggerValue } = fieldSchema.timestampTrigger
    
    // Get values from validated data (includes any transforms from first pass)
    const newTriggerFieldValue = validatedData[triggerField] ?? data[triggerField]
    const oldTriggerFieldValue = existingData?.[triggerField]
    const existingTimestamp = existingData?.[fieldName]

    // Helper to check if value matches trigger condition
    const matchesTrigger = (val: unknown): boolean => {
      if (triggerValue !== undefined) {
        return val === triggerValue
      }
      // Truthy check
      return val !== undefined && val !== null && val !== '' && val !== false
    }

    const wasTriggerActive = matchesTrigger(oldTriggerFieldValue)
    const isTriggerActive = matchesTrigger(newTriggerFieldValue)

    if (!wasTriggerActive && isTriggerActive) {
      // Transition TO trigger state - set timestamp (only if not already set)
      if (existingTimestamp === undefined || existingTimestamp === null || existingTimestamp === '') {
        validatedData[fieldName] = new Date().toISOString()
      } else {
        // Preserve existing timestamp
        validatedData[fieldName] = existingTimestamp
      }
    } else if (wasTriggerActive && !isTriggerActive) {
      // Transition AWAY from trigger state - clear timestamp
      validatedData[fieldName] = undefined
    } else {
      // No transition - preserve existing timestamp (if any), strip client value
      if (existingTimestamp !== undefined && existingTimestamp !== null && existingTimestamp !== '') {
        validatedData[fieldName] = existingTimestamp
      } else {
        delete validatedData[fieldName]
      }
    }
  }

  return { valid: true, data: validatedData }
}

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Schema registry for looking up collection schemas.
 *
 * All schemas are trusted — baked into the worker at deploy time
 * or pushed by the platform worker via the push-schemas endpoint.
 */
export class SchemaRegistry {
  /** Trusted schemas — set via constructor or registerTrusted() */
  private trusted: Map<string, CollectionSchema> = new Map()

  constructor(schemas: CollectionSchema[] = []) {
    for (const schema of schemas) {
      this.trusted.set(schema.name, ensureColumns(schema))
    }
  }

  /**
   * Register a schema as trusted (from persisted storage or push-schemas endpoint).
   */
  registerTrusted(schema: CollectionSchema): void {
    this.trusted.set(schema.name, ensureColumns(schema))
  }

  /**
   * Get schema for a collection.
   * Returns undefined if no schema is registered.
   */
  get(name: string): CollectionSchema | undefined {
    return this.trusted.get(name)
  }

  has(name: string): boolean {
    return this.trusted.has(name)
  }

  /** Check if a collection has a trusted (build-time) schema */
  hasTrusted(name: string): boolean {
    return this.trusted.has(name)
  }

  all(): CollectionSchema[] {
    return Array.from(this.trusted.values())
  }

  names(): string[] {
    return Array.from(this.trusted.keys())
  }
}

// ============================================================================
// Permission Analysis (for developer tools / admin panels)
// ============================================================================

/** How a permission was resolved for a given role × collection. */
export type PermissionSource = 'explicit' | 'wildcard' | 'default-deny'

/** A single resolved CRUD permission with its source. */
export interface ResolvedPermission {
  level: PermissionLevel | boolean
  source: PermissionSource
}

/** Full permission breakdown for one collection. */
export interface CollectionPermissionSummary {
  collection: string
  ownerField?: string
  collaboratorsField?: string
  teamField?: string
  fields: Record<string, FieldSchema>
  permissions: Record<string, {
    read: ResolvedPermission
    create: ResolvedPermission
    update: ResolvedPermission
    delete: ResolvedPermission
    writableFields?: string[]
  }>
}

/** Result of analyzing an array of schemas. */
export interface PermissionAnalysis {
  /** All unique roles discovered across all schemas (excludes '*' wildcard). */
  roles: string[]
  /** Per-collection permission breakdown. */
  collections: CollectionPermissionSummary[]
}

/**
 * Analyze schemas to produce a structured permission summary.
 * Used by admin panels to render a permission matrix.
 *
 * Resolves wildcard ('*') fallback and tracks whether each
 * permission was explicitly defined, resolved via wildcard,
 * or fell back to the default deny-all.
 */
export function analyzePermissions(schemas: CollectionSchema[]): PermissionAnalysis {
  // Collect all unique role names across all schemas
  const roleSet = new Set<string>()
  for (const schema of schemas) {
    for (const role of Object.keys(schema.permissions)) {
      roleSet.add(role)
    }
  }
  // '*' is a fallback mechanism, not a real role
  roleSet.delete('*')
  const roles = Array.from(roleSet)

  // Build per-collection summaries
  const collections: CollectionPermissionSummary[] = schemas.map(schema => {
    const permissions: CollectionPermissionSummary['permissions'] = {}

    for (const role of roles) {
      let source: PermissionSource
      let perms: RolePermissions

      if (schema.permissions[role]) {
        source = 'explicit'
        perms = schema.permissions[role]
      } else if (schema.permissions['*']) {
        source = 'wildcard'
        perms = schema.permissions['*']
      } else {
        source = 'default-deny'
        perms = { read: false, create: false, update: false, delete: false }
      }

      permissions[role] = {
        read: { level: perms.read, source },
        create: { level: perms.create, source },
        update: { level: perms.update, source },
        delete: { level: perms.delete, source },
        writableFields: perms.writableFields,
      }
    }

    return {
      collection: schema.name,
      ownerField: schema.ownerField,
      collaboratorsField: schema.collaboratorsField,
      teamField: schema.teamField,
      fields: schema.fields || {},
      permissions,
    }
  })

  return { roles, collections }
}
