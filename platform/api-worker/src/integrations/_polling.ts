/**
 * Async polling utility — extracted from Miyagi3 BaseIntegrationService.pollAsyncTask().
 * Used by integrations that submit a task and poll for completion (Freepik, CloudConvert, Exa research).
 *
 * CF Workers allow this: the 30s limit is CPU time, not wall-clock time.
 * Each poll iteration uses <100ms CPU (one fetch + one setTimeout).
 */

export interface PollOptions {
  /** URL to GET for status checks. */
  statusUrl: string
  /** Headers to include on status requests. */
  headers?: Record<string, string>
  /** Maximum number of poll attempts (default 30). */
  maxAttempts?: number
  /** Milliseconds between polls (default 10000). */
  pollInterval?: number
  /** Milliseconds to wait before first poll (default 5000). */
  initialDelay?: number
  /** Status values that mean "done successfully" (default ['COMPLETED', 'finished']). */
  completedStatuses?: string[]
  /** Status values that mean "failed" (default ['FAILED', 'ERROR', 'error', 'failed']). */
  failedStatuses?: string[]
  /** Extract the status string from the response JSON. Default checks data.status then status. */
  extractStatus?: (data: any) => string | undefined
  /** Extract the final result from a completed response. Default returns the full response. */
  extractResult?: (data: any) => any
}

export interface PollResult {
  success: boolean
  data?: any
  error?: string
  attempts?: number
}

export async function pollForResult(opts: PollOptions): Promise<PollResult> {
  const {
    statusUrl,
    headers = {},
    maxAttempts = 30,
    pollInterval = 10000,
    initialDelay = 5000,
    completedStatuses = ['COMPLETED', 'finished', 'completed'],
    failedStatuses = ['FAILED', 'ERROR', 'error', 'failed', 'canceled'],
    extractStatus = (data: any) => data?.data?.status || data?.status,
    extractResult = (data: any) => data,
  } = opts

  if (initialDelay > 0) {
    await new Promise(resolve => setTimeout(resolve, initialDelay))
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(statusUrl, { method: 'GET', headers })

      if (!response.ok) {
        const errorText = await response.text()
        if (attempt === maxAttempts) {
          return { success: false, error: `Status check failed after ${maxAttempts} attempts: HTTP ${response.status} - ${errorText}`, attempts: attempt }
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        continue
      }

      const data = await response.json()
      const status = extractStatus(data)

      if (status && completedStatuses.includes(status)) {
        return { success: true, data: extractResult(data), attempts: attempt }
      }

      if (status && failedStatuses.includes(status)) {
        const errorMessage = (data as any)?.message || (data as any)?.error || (data as any)?.data?.message || (data as any)?.data?.error
        return {
          success: false,
          error: errorMessage ? `Task failed: ${errorMessage}` : `Task failed with status: ${status}`,
          data,
          attempts: attempt,
        }
      }

      // Still in progress
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        return { success: false, error: `Polling failed after ${maxAttempts} attempts: ${error}`, attempts: attempt }
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  return { success: false, error: 'Polling timed out', attempts: maxAttempts }
}
