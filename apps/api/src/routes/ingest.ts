import type { FastifyPluginAsync } from 'fastify'

import { validateApiKey } from '../lib/apikeys.js'
import { calculateCost } from '../lib/costs.js'
import { normaliseModel } from '../lib/normalise.js'
import { detectProvider } from '../lib/provider.js'
import { addIngestJob } from '../lib/queue.js'
import { supabaseService } from '../lib/supabase.js'

const MAX_BATCH_SIZE = 100
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000
const ALLOWED_PROVIDERS = new Set([
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'bedrock',
  'unknown',
])

type MetadataValue = string | number | boolean

type IngestEvent = {
  model: unknown
  provider?: unknown
  tokens_in: unknown
  tokens_out: unknown
  latency_ms: unknown
  cost_usd?: unknown
  workflow_id?: unknown
  session_id?: unknown
  request_id?: unknown
  metadata?: unknown
  timestamp: unknown
}

type SanitizedEvent = {
  model: string
  provider?: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  workflowId?: string
  sessionId?: string
  requestId?: string
  metadata?: Record<string, MetadataValue>
  timestamp: string
}

type ExistingRequestRow = {
  request_id: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasHtml(value: string): boolean {
  return /<[^>]*>/u.test(value)
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function validateStringField(
  value: unknown,
  field: string,
  details: string[],
  options: {
    required?: boolean
    maxLength: number
    rejectHtml?: boolean
  },
): string | undefined {
  if (value === undefined || value === null) {
    if (options.required) {
      details.push(`${field} is required`)
    }
    return undefined
  }

  if (typeof value !== 'string') {
    details.push(`${field} must be a string`)
    return undefined
  }

  if (value.length === 0 && options.required) {
    details.push(`${field} is required`)
    return undefined
  }

  if (value.length === 0) {
    return undefined
  }

  if (value.length > options.maxLength) {
    details.push(`${field} must be at most ${options.maxLength} characters`)
    return undefined
  }

  if (options.rejectHtml && hasHtml(value)) {
    details.push(`${field} must not contain HTML`)
    return undefined
  }

  return value
}

function sanitizeMetadata(
  value: unknown,
  details: string[],
): Record<string, MetadataValue> | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (!isPlainObject(value)) {
    details.push('metadata must be an object')
    return undefined
  }

  const entries = Object.entries(value)

  if (entries.length > 10) {
    details.push('metadata must have at most 10 keys')
  }

  const metadata: Record<string, MetadataValue> = {}

  for (const [key, rawValue] of entries.slice(0, 10)) {
    if (key.length > 50) {
      details.push(`metadata key ${key} must be at most 50 characters`)
      continue
    }

    if (
      typeof rawValue !== 'string' &&
      typeof rawValue !== 'number' &&
      typeof rawValue !== 'boolean'
    ) {
      details.push(`metadata.${key} must be a string, number, or boolean`)
      continue
    }

    metadata[key] =
      typeof rawValue === 'string' ? rawValue.slice(0, 500) : rawValue
  }

  return Object.keys(metadata).length > 0 ? metadata : {}
}

function validateTimestamp(value: unknown, details: string[]): string | undefined {
  if (typeof value !== 'string') {
    details.push('timestamp must be a valid ISO 8601 string')
    return undefined
  }

  const parsed = Date.parse(value)

  if (Number.isNaN(parsed)) {
    details.push('timestamp must be a valid ISO 8601 string')
    return undefined
  }

  if (Math.abs(Date.now() - parsed) > MAX_TIMESTAMP_DRIFT_MS) {
    details.push('timestamp must be within +/- 5 minutes of server time')
    return undefined
  }

  return new Date(parsed).toISOString()
}

function validateEvent(event: unknown): { value?: SanitizedEvent; details: string[] } {
  const details: string[] = []

  if (!isPlainObject(event)) {
    return {
      details: ['each ingest event must be an object'],
    }
  }

  const input = event as IngestEvent
  const model = validateStringField(input.model, 'model', details, {
    required: true,
    maxLength: 100,
    rejectHtml: true,
  })

  let provider: string | undefined

  if (input.provider !== undefined && input.provider !== null) {
    if (typeof input.provider !== 'string') {
      details.push('provider must be a string')
    } else if (!ALLOWED_PROVIDERS.has(input.provider)) {
      details.push(
        'provider must be one of: openai, anthropic, google, deepseek, bedrock, unknown',
      )
    } else {
      provider = input.provider
    }
  }

  if (!isIntegerInRange(input.tokens_in, 0, 1_000_000)) {
    details.push('tokens_in must be a non-negative integer between 0 and 1000000')
  }

  if (!isIntegerInRange(input.tokens_out, 0, 1_000_000)) {
    details.push('tokens_out must be a non-negative integer between 0 and 1000000')
  }

  if (!isIntegerInRange(input.latency_ms, 0, 300_000)) {
    details.push('latency_ms must be a non-negative integer between 0 and 300000')
  }

  if (
    input.cost_usd !== undefined &&
    input.cost_usd !== null &&
    !isNumberInRange(input.cost_usd, 0, 10_000)
  ) {
    details.push('cost_usd must be a number between 0 and 10000')
  }

  const workflowId = validateStringField(input.workflow_id, 'workflow_id', details, {
    maxLength: 200,
  })
  const sessionId = validateStringField(input.session_id, 'session_id', details, {
    maxLength: 200,
  })
  const requestId = validateStringField(input.request_id, 'request_id', details, {
    maxLength: 100,
  })
  const metadata = sanitizeMetadata(input.metadata, details)
  const timestamp = validateTimestamp(input.timestamp, details)

  if (details.length > 0 || !model || !timestamp) {
    return { details }
  }

  return {
    value: {
      model,
      provider,
      tokensIn: input.tokens_in as number,
      tokensOut: input.tokens_out as number,
      latencyMs: input.latency_ms as number,
      workflowId,
      sessionId,
      requestId,
      metadata,
      timestamp,
    },
    details,
  }
}

async function getExistingRequestIds(requestIds: string[]): Promise<Set<string>> {
  if (requestIds.length === 0) {
    return new Set()
  }

  const { data, error } = await supabaseService
    .from('requests')
    .select('request_id')
    .in('request_id', requestIds)

  if (error) {
    throw error
  }

  return new Set(
    ((data ?? []) as ExistingRequestRow[])
      .map((row) => row.request_id)
      .filter((requestId): requestId is string => typeof requestId === 'string'),
  )
}

export const ingestRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/v1/ingest',
    {
      config: {
        rateLimit: {
          max: 1000,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const authHeader = request.headers.authorization

        if (!authHeader?.startsWith('Bearer ')) {
          return reply.status(401).send({ error: 'Unauthorized', code: 401 })
        }

        const rawApiKey = authHeader.slice('Bearer '.length).trim()

        if (!rawApiKey) {
          return reply.status(401).send({ error: 'Unauthorized', code: 401 })
        }

        const auth = await validateApiKey(rawApiKey)

        if (!auth) {
          return reply.status(401).send({ error: 'Unauthorized', code: 401 })
        }

        const body = request.body
        const events = Array.isArray(body) ? body : [body]

        if (events.length === 0) {
          return reply.status(400).send({
            error: 'Validation failed',
            code: 400,
            details: ['request body must contain at least one event'],
          })
        }

        if (events.length > MAX_BATCH_SIZE) {
          return reply.status(400).send({
            error: 'Validation failed',
            code: 400,
            details: [`batch size must be at most ${MAX_BATCH_SIZE}`],
          })
        }

        const validatedEvents = events.map((event) => validateEvent(event))
        const details = validatedEvents.flatMap((result, index) =>
          result.details.map((detail) => `event ${index + 1}: ${detail}`),
        )

        if (details.length > 0) {
          request.log.warn({ apiKeyId: auth.apiKeyId, details }, 'Ingest validation failed')

          return reply.status(400).send({
            error: 'Validation failed',
            code: 400,
            details,
          })
        }

        const sanitizedEvents = validatedEvents
          .map((result) => result.value)
          .filter((event): event is SanitizedEvent => Boolean(event))

        const requestIds = sanitizedEvents
          .map((event) => event.requestId)
          .filter((requestId): requestId is string => Boolean(requestId))

        const existingRequestIds = await getExistingRequestIds(requestIds)

        if (
          sanitizedEvents.length > 0 &&
          sanitizedEvents.every(
            (event) =>
              typeof event.requestId === 'string' &&
              existingRequestIds.has(event.requestId),
          )
        ) {
          return reply.status(200).send({ received: true, duplicate: true })
        }

        for (const event of sanitizedEvents) {
          if (event.requestId && existingRequestIds.has(event.requestId)) {
            continue
          }

          const modelNormalised = normaliseModel(event.model)
          const provider = event.provider ?? detectProvider(event.model)
          const { costUsd, unknownModel } = await calculateCost(
            modelNormalised,
            event.tokensIn,
            event.tokensOut,
          )

          await addIngestJob({
            userId: auth.userId,
            apiKeyId: auth.apiKeyId,
            modelRaw: event.model,
            modelNormalised,
            provider,
            tokensIn: event.tokensIn,
            tokensOut: event.tokensOut,
            costUsd,
            latencyMs: event.latencyMs,
            workflowId: event.workflowId,
            sessionId: event.sessionId,
            requestId: event.requestId,
            unknownModel,
            metadata: event.metadata,
            timestamp: event.timestamp,
          })
        }

        return reply.status(200).send({ received: true })
      } catch (error) {
        request.log.error({ err: error }, 'Failed to process ingest request')

        return reply.status(500).send({
          error: 'Internal server error',
          code: 500,
        })
      }
    },
  )
}
