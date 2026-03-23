import { Queue } from 'bullmq'

import { supabaseService } from './supabase.js'

export interface IngestJob {
  userId: string
  apiKeyId: string
  modelRaw: string
  modelNormalised: string
  provider: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  latencyMs: number
  workflowId?: string
  sessionId?: string
  requestId?: string
  unknownModel: boolean
  metadata?: Record<string, string | number | boolean>
  timestamp: string
}

const redisUrl = process.env.UPSTASH_REDIS_URL
const redisToken = process.env.UPSTASH_REDIS_TOKEN

if (!redisUrl) {
  throw new Error('UPSTASH_REDIS_URL is required')
}

if (!redisToken) {
  throw new Error('UPSTASH_REDIS_TOKEN is required')
}

const parsedRedisUrl = new URL(redisUrl)
const bullMqConnection = {
  host: parsedRedisUrl.hostname,
  port: Number(parsedRedisUrl.port || (parsedRedisUrl.protocol === 'rediss:' ? '6379' : '6379')),
  username: parsedRedisUrl.username || 'default',
  password: redisToken,
  maxRetriesPerRequest: null,
  tls: parsedRedisUrl.protocol === 'rediss:' ? {} : undefined,
}

export { bullMqConnection }

export const ingestQueue = new Queue<IngestJob, void, string>('ingest', {
  connection: bullMqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
})

async function persistIngestJobDirect(job: IngestJob): Promise<void> {
  const { error } = await supabaseService.from('requests').insert({
    user_id: job.userId,
    api_key_id: job.apiKeyId,
    model_raw: job.modelRaw,
    model_normalised: job.modelNormalised,
    provider: job.provider,
    tokens_in: job.tokensIn,
    tokens_out: job.tokensOut,
    cost_usd: job.costUsd,
    latency_ms: job.latencyMs,
    workflow_id: job.workflowId,
    session_id: job.sessionId,
    request_id: job.requestId,
    unknown_model: job.unknownModel,
    metadata: job.metadata,
    timestamp: job.timestamp,
  })

  if (error) {
    throw error
  }

  void supabaseService
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', job.apiKeyId)
}

export async function addIngestJob(job: IngestJob): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    await persistIngestJobDirect(job)
    return
  }

  await ingestQueue.add('ingest', job)
}
