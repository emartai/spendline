import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'

import { supabaseService } from '../lib/supabase.js'
import type { IngestJob } from '../lib/queue.js'

const redisUrl = process.env.UPSTASH_REDIS_URL
const redisToken = process.env.UPSTASH_REDIS_TOKEN

if (!redisUrl) {
  throw new Error('UPSTASH_REDIS_URL is required')
}

if (!redisToken) {
  throw new Error('UPSTASH_REDIS_TOKEN is required')
}

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  password: redisToken,
})

const deadLetterQueue = new Queue<IngestJob>('ingest-dlq', {
  connection,
})

type RequestDuplicateCheck = {
  id: string
}

async function requestAlreadyExists(requestId?: string): Promise<boolean> {
  if (!requestId) {
    return false
  }

  const { data, error } = await supabaseService
    .from('requests')
    .select('id')
    .eq('request_id', requestId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean((data as RequestDuplicateCheck | null)?.id)
}

async function insertRequest(job: IngestJob): Promise<void> {
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
}

function touchApiKey(apiKeyId: string): void {
  void supabaseService
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKeyId)
}

async function processIngest(job: Job<IngestJob>): Promise<void> {
  if (await requestAlreadyExists(job.data.requestId)) {
    return
  }

  await insertRequest(job.data)
  touchApiKey(job.data.apiKeyId)
}

async function pushToDeadLetterQueue(job: Job<IngestJob>, error: Error): Promise<void> {
  await deadLetterQueue.add('ingest-dlq', {
    ...job.data,
    metadata: {
      ...job.data.metadata,
      dead_letter: true,
      failed_reason: error.message,
    },
  })
}

export function startWorker(): Worker<IngestJob> {
  const worker = new Worker<IngestJob>('ingest', processIngest, {
    connection,
  })

  worker.on('failed', (job, error) => {
    if (!job) {
      return
    }

    const attempts = job.opts.attempts ?? 0

    if (job.attemptsMade >= attempts) {
      void pushToDeadLetterQueue(job, error)
    }
  })

  return worker
}
