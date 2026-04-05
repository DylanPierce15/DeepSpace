/**
 * LaTeX Compiler integration — compile LaTeX documents to PDF.
 * Proxies to a self-hosted latex-on-http service.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const REQUEST_TIMEOUT_MS = 60_000

const compile: IntegrationHandler = async (env, body) => {
  if (!env.LATEX_COMPILER_URL) throw new Error('LATEX_COMPILER_URL not configured')

  const { compiler, document: mainDocument, resources } = body as {
    compiler?: string
    document?: string
    resources?: Array<{
      main?: boolean
      path?: string
      content?: string
      file?: string
      url?: string
    }>
  }

  // Build the resources array for the compiler
  const compilerResources: Array<Record<string, unknown>> = []

  if (mainDocument) {
    // Simple mode: single document string
    compilerResources.push({ main: true, content: mainDocument })
  }

  if (resources && resources.length > 0) {
    for (const resource of resources) {
      compilerResources.push(resource)
    }
  }

  if (compilerResources.length === 0) {
    throw new Error('Either document or resources must be provided')
  }

  // If only one resource and main not set, mark it as main
  if (compilerResources.length === 1 && compilerResources[0].main !== true) {
    compilerResources[0].main = true
  }

  const payload = {
    compiler: compiler || 'pdflatex',
    resources: compilerResources,
    options: {
      response: { format: 'json' },
    },
  }

  const url = `${env.LATEX_COMPILER_URL}/builds/sync`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    let responseBody: Record<string, unknown> | null = null
    try {
      responseBody = (await response.json()) as Record<string, unknown>
    } catch {
      const text = await response.clone().text().catch(() => '')
      responseBody = { rawText: text }
    }

    if (response.status === 201 && responseBody) {
      return {
        compiled: true,
        pdfBase64: responseBody.pdf,
        contentType: 'application/pdf',
        compilationLog: responseBody.logs,
        parsedLog: responseBody.parsed_log,
        logFiles: responseBody.log_files,
        duration: responseBody.duration,
      }
    }

    // Compilation failed but the service responded
    const errorMessage =
      typeof responseBody?.error === 'string'
        ? responseBody.error
        : typeof responseBody?.message === 'string'
          ? responseBody.message
          : `LaTeX compilation failed (HTTP ${response.status})`

    return {
      compiled: false,
      error: errorMessage,
      compilationLog: responseBody?.logs,
      parsedLog: responseBody?.parsed_log,
      logFiles: responseBody?.log_files,
      duration: responseBody?.duration,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `LaTeX compilation timed out after ${REQUEST_TIMEOUT_MS / 1000}s`,
      )
    }

    throw error
  }
}

export const endpoints: Record<string, EndpointDefinition> = {
  'latex-compiler/compile': {
    handler: compile,
    billing: { model: 'per_request', baseCost: 0.005, currency: 'USD' },
  },
}
