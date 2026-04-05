/**
 * DO Manifest — Dynamic Durable Object binding declarations.
 *
 * Apps export a `__DO_MANIFEST__` array in their worker.ts.
 * The CLI extracts it and sends it to the deploy worker,
 * which uses it to generate dynamic CF API bindings and migrations.
 */

/// <reference types="@cloudflare/workers-types" />

export interface DOManifestEntry {
  /** CF binding name, e.g. 'RECORD_ROOMS' */
  binding: string
  /** Exported class name, e.g. 'AppRecordRoom' */
  className: string
  /** Whether this DO uses SQLite storage */
  sqlite: boolean
}

export type DOManifest = DOManifestEntry[]

/**
 * Utility type: auto-generates Env bindings from a manifest.
 *
 * @example
 * const manifest = [
 *   { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
 *   { binding: 'GAME_ROOMS', className: 'AppGameRoom', sqlite: true },
 * ] as const satisfies DOManifest
 *
 * type Env = BaseEnv & DOBindings<typeof manifest>
 * // => { RECORD_ROOMS: DurableObjectNamespace; GAME_ROOMS: DurableObjectNamespace }
 */
export type DOBindings<T extends readonly DOManifestEntry[]> = {
  [K in T[number]['binding']]: DurableObjectNamespace
}

/** Default manifest for apps that don't declare one */
export const DEFAULT_DO_MANIFEST: DOManifest = [
  { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
  { binding: 'YJS_ROOMS', className: 'AppYjsRoom', sqlite: true },
]
