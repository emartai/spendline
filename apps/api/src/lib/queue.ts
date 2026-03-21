import { Queue } from 'bullmq'
import IORedis from 'ioredis'

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

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  password: redisToken,
})

export const ingestQueue = new Queue<IngestJob>('ingest', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
})

export async function addIngestJob(job: IngestJob): Promise<void> {
  await ingestQueue.add('ingest', job)
}
