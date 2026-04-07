/**
 * CloudConvert integration — file format conversion with async polling.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'
import { pollForResult } from '../_polling'

const convertFile: IntegrationHandler = async (env, body) => {
  if (!env.CLOUDCONVERT_API_KEY) throw new Error('CLOUDCONVERT_API_KEY not configured')

  const { input_format, output_format, file, url } = body as {
    input_format: string
    output_format: string
    file?: string
    url?: string
  }

  if (!input_format || !output_format) {
    throw new Error('input_format and output_format are required')
  }

  if (!file && !url) {
    throw new Error('Either file (base64) or url must be provided')
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.CLOUDCONVERT_API_KEY}`,
    'Content-Type': 'application/json',
  }

  // Build the job with import → convert → export tasks
  const tasks: Record<string, Record<string, unknown>> = {}

  if (url) {
    tasks['import-file'] = {
      operation: 'import/url',
      url,
    }
  } else {
    tasks['import-file'] = {
      operation: 'import/base64',
      file,
      filename: `input.${input_format}`,
    }
  }

  tasks['convert-file'] = {
    operation: 'convert',
    input: 'import-file',
    input_format,
    output_format,
    ...(body.optimize_print !== undefined ? { optimize_print: body.optimize_print } : {}),
    ...(body.pages ? { pages: body.pages } : {}),
  }

  tasks['export-file'] = {
    operation: 'export/url',
    input: 'convert-file',
  }

  // Create the job
  const createResponse = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers,
    body: JSON.stringify({ tasks }),
  })

  if (!createResponse.ok) {
    const errorBody = await createResponse.text()
    throw new Error(`CloudConvert job creation failed ${createResponse.status}: ${errorBody}`)
  }

  const jobData = (await createResponse.json()) as Record<string, unknown>
  const jobId = (jobData.data as Record<string, unknown>)?.id as string

  if (!jobId) {
    throw new Error('No job ID returned from CloudConvert API')
  }

  // Poll for completion
  const result = await pollForResult({
    statusUrl: `https://api.cloudconvert.com/v2/jobs/${jobId}`,
    headers: { Authorization: `Bearer ${env.CLOUDCONVERT_API_KEY}` },
    maxAttempts: 60,
    pollInterval: 5000,
    initialDelay: 3000,
    completedStatuses: ['finished'],
    failedStatuses: ['error', 'failed'],
    extractStatus: (data: any) => data?.data?.status,
    extractResult: (data: any) => {
      const tasks = data?.data?.tasks as Array<Record<string, unknown>> | undefined
      const exportTask = tasks?.find(
        (t) => t.name === 'export-file' && t.status === 'finished',
      )
      const files = (exportTask?.result as Record<string, unknown>)?.files as
        | Array<Record<string, unknown>>
        | undefined
      const downloadUrl = files?.[0]?.url as string | undefined
      return { jobId, downloadUrl, tasks }
    },
  })

  if (!result.success) {
    throw new Error(result.error || 'CloudConvert conversion failed')
  }

  return result.data
}

const convertFileSchema = z.object({
  input_format: z.string(),
  output_format: z.string(),
  file: z.string().optional(),
  url: z.string().optional(),
  optimize_print: z.boolean().optional(),
  pages: z.string().optional(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'cloudconvert/convert-file': {
    handler: convertFile,
    billing: { model: 'per_request', baseCost: 0.018, currency: 'USD' },
    schema: convertFileSchema,
  },
}
