/**
 * Backup API for Yjs document snapshots
 * 
 * Stores point-in-time snapshots of the Yjs document to R2.
 * Supports create, list, restore, and delete operations.
 */

/// <reference types="@cloudflare/workers-types" />

export interface BackupMetadata {
  id: string
  roomId: string
  timestamp: string
  size: number
  description?: string
  version: number
}

export interface BackupEnv {
  YJS_ROOMS: DurableObjectNamespace
  BACKUPS: R2Bucket
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

/**
 * Route backup API requests
 * 
 * Endpoints:
 * - POST   /api/backup/:roomId/create { description? }
 * - GET    /api/backup/:roomId/list?limit=50
 * - GET    /api/backup/:roomId/info/:backupId
 * - POST   /api/backup/:roomId/restore/:backupId
 * - DELETE /api/backup/:roomId/:backupId
 */
export async function handleBackupApi(
  request: Request,
  url: URL,
  env: BackupEnv
): Promise<Response> {
  const pathParts = url.pathname.replace('/api/backup/', '').split('/').filter(Boolean)
  if (pathParts.length < 2) {
    return Response.json(
      { error: 'Invalid path. Expected /api/backup/:roomId/:action' },
      { status: 400, headers: corsHeaders }
    )
  }

  const [roomId, action, param] = pathParts
  const roomIdObj = env.YJS_ROOMS.idFromName(roomId)
  const room = env.YJS_ROOMS.get(roomIdObj)

  // Handle DELETE method: DELETE /api/backup/:roomId/:backupId
  if (request.method === 'DELETE') {
    return handleBackupDelete(action, roomId, env)
  }

  switch (action) {
    case 'create':
      return handleBackupCreate(request, roomId, env)
    case 'list':
      return handleBackupList(url, roomId, env)
    case 'info':
      return handleBackupInfo(param!, roomId, env)
    case 'restore':
      return handleBackupRestore(param!, roomId, room, env)
    default:
      return Response.json(
        { error: `Unknown backup action: ${action}` },
        { status: 400, headers: corsHeaders }
      )
  }
}

/**
 * Create a backup of the current Yjs document state
 */
async function handleBackupCreate(
  request: Request,
  roomId: string,
  env: BackupEnv
): Promise<Response> {
  try {
    const roomIdObj = env.YJS_ROOMS.idFromName(roomId)
    const room = env.YJS_ROOMS.get(roomIdObj)
    
    const stateResponse = await room.fetch(new Request('http://internal/snapshot', {
      method: 'GET',
    }))
    
    if (!stateResponse.ok) {
      return Response.json(
        { error: 'Failed to get document state' },
        { status: 500, headers: corsHeaders }
      )
    }
    
    const state = await stateResponse.arrayBuffer()
    const stateBytes = new Uint8Array(state)

    let description: string | undefined
    if (request.method === 'POST') {
      try {
        const body = await request.json() as { description?: string }
        description = body.description
      } catch {
        // No body or invalid JSON
      }
    }

    const timestamp = new Date().toISOString()
    const version = await getNextBackupVersion(roomId, env)
    const backupId = `${timestamp.replace(/[:.]/g, '-')}-v${version}`
    
    const metadata: BackupMetadata = {
      id: backupId,
      roomId,
      timestamp,
      size: stateBytes.length,
      description,
      version,
    }

    const key = `${roomId}/${backupId}.bin`
    await env.BACKUPS.put(key, stateBytes, {
      customMetadata: {
        roomId,
        timestamp,
        description: description || '',
        version: String(version),
      },
    })

    return Response.json(
      { success: true, backup: metadata },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Backup create error:', error)
    return Response.json(
      { error: 'Failed to create backup', details: String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Get the next backup version number for a room
 */
async function getNextBackupVersion(roomId: string, env: BackupEnv): Promise<number> {
  const prefix = `${roomId}/`
  const objects = await env.BACKUPS.list({ prefix, limit: 1000 })
  
  let maxVersion = 0
  for (const obj of objects.objects) {
    const versionMatch = obj.key.match(/-v(\d+)\.bin$/)
    if (versionMatch) {
      const version = parseInt(versionMatch[1], 10)
      if (version > maxVersion) {
        maxVersion = version
      }
    }
  }
  
  return maxVersion + 1
}

/**
 * List all backups for a room
 */
async function handleBackupList(
  url: URL,
  roomId: string,
  env: BackupEnv
): Promise<Response> {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const prefix = `${roomId}/`
    
    const objects = await env.BACKUPS.list({ prefix, limit })
    
    const backups: BackupMetadata[] = objects.objects.map(obj => {
      const backupId = obj.key.replace(prefix, '').replace('.bin', '')
      
      return {
        id: backupId,
        roomId,
        timestamp: obj.customMetadata?.timestamp || obj.uploaded.toISOString(),
        size: obj.size,
        description: obj.customMetadata?.description || undefined,
        version: parseInt(obj.customMetadata?.version || '0', 10),
      }
    })

    // Sort by timestamp descending (newest first)
    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return Response.json(
      { backups, count: backups.length, truncated: objects.truncated },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Backup list error:', error)
    return Response.json(
      { error: 'Failed to list backups', details: String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Get info about a specific backup
 */
async function handleBackupInfo(
  backupId: string,
  roomId: string,
  env: BackupEnv
): Promise<Response> {
  try {
    const key = `${roomId}/${backupId}.bin`
    const object = await env.BACKUPS.head(key)
    
    if (!object) {
      return Response.json(
        { error: 'Backup not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    const metadata: BackupMetadata = {
      id: backupId,
      roomId,
      timestamp: object.customMetadata?.timestamp || object.uploaded.toISOString(),
      size: object.size,
      description: object.customMetadata?.description || undefined,
      version: parseInt(object.customMetadata?.version || '0', 10),
    }

    return Response.json(
      { backup: metadata },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Backup info error:', error)
    return Response.json(
      { error: 'Failed to get backup info', details: String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Restore the Yjs document from a backup
 */
async function handleBackupRestore(
  backupId: string,
  roomId: string,
  room: DurableObjectStub,
  env: BackupEnv
): Promise<Response> {
  try {
    const key = `${roomId}/${backupId}.bin`
    const object = await env.BACKUPS.get(key)
    
    if (!object) {
      return Response.json(
        { error: 'Backup not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    const backupData = await object.arrayBuffer()

    const restoreResponse = await room.fetch(new Request('http://internal/restore', {
      method: 'POST',
      body: backupData,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    }))

    if (!restoreResponse.ok) {
      const error = await restoreResponse.text()
      return Response.json(
        { error: 'Failed to restore backup', details: error },
        { status: 500, headers: corsHeaders }
      )
    }

    return Response.json(
      { 
        success: true, 
        message: `Restored from backup ${backupId}`,
        backupId,
        restoredSize: backupData.byteLength,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Backup restore error:', error)
    return Response.json(
      { error: 'Failed to restore backup', details: String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Delete a specific backup
 */
async function handleBackupDelete(
  backupId: string,
  roomId: string,
  env: BackupEnv
): Promise<Response> {
  try {
    const key = `${roomId}/${backupId}.bin`
    
    const exists = await env.BACKUPS.head(key)
    if (!exists) {
      return Response.json(
        { error: 'Backup not found' },
        { status: 404, headers: corsHeaders }
      )
    }

    await env.BACKUPS.delete(key)

    return Response.json(
      { success: true, message: `Deleted backup ${backupId}`, backupId },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('Backup delete error:', error)
    return Response.json(
      { error: 'Failed to delete backup', details: String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Handle backup tool execution from tools API
 */
export async function handleBackupToolExecution(
  tool: string,
  params: Record<string, unknown>,
  roomId: string,
  env: BackupEnv
): Promise<Response> {
  const roomIdObj = env.YJS_ROOMS.idFromName(roomId)
  const room = env.YJS_ROOMS.get(roomIdObj)

  switch (tool) {
    case 'backup.create': {
      const mockRequest = new Request('http://internal/backup', {
        method: 'POST',
        body: JSON.stringify({ description: params.description }),
        headers: { 'Content-Type': 'application/json' },
      })
      return handleBackupCreate(mockRequest, roomId, env)
    }

    case 'backup.list': {
      const url = new URL('http://internal/backup/list')
      if (params.limit) {
        url.searchParams.set('limit', String(params.limit))
      }
      return handleBackupList(url, roomId, env)
    }

    case 'backup.restore': {
      const backupId = String(params.backupId)
      if (!backupId) {
        return Response.json(
          { success: false, error: 'Missing required param: backupId' },
          { status: 400, headers: corsHeaders }
        )
      }
      return handleBackupRestore(backupId, roomId, room, env)
    }

    case 'backup.delete': {
      const backupId = String(params.backupId)
      if (!backupId) {
        return Response.json(
          { success: false, error: 'Missing required param: backupId' },
          { status: 400, headers: corsHeaders }
        )
      }
      return handleBackupDelete(backupId, roomId, env)
    }

    default:
      return Response.json(
        { success: false, error: `Unknown backup tool: ${tool}` },
        { status: 400, headers: corsHeaders }
      )
  }
}

