import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'

import { startAlertJobs } from './jobs/alerts.js'
import { apikeyRoutes } from './routes/apikeys.js'
import { accountRoutes } from './routes/account.js'
import { alertRoutes } from './routes/alerts.js'
import { ingestRoutes } from './routes/ingest.js'
import { modelRoutes } from './routes/models.js'
import { statsRoutes } from './routes/stats.js'
import { startWorker } from './workers/ingest.worker.js'

const app = Fastify({
  logger: true,
})

const port = Number(process.env.PORT ?? 3001)
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000'

async function buildServer() {
  await app.register(cors, {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })

  await app.register(helmet)

  await app.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
  })

  await app.register(ingestRoutes)
  await app.register(statsRoutes)
  await app.register(apikeyRoutes)
  await app.register(accountRoutes)
  await app.register(alertRoutes)
  await app.register(modelRoutes)

  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  })
}

async function start() {
  startWorker()
  startAlertJobs()
  await buildServer()
  await app.listen({ port, host: '0.0.0.0' })
}

start().catch((error) => {
  app.log.error(error)
  process.exit(1)
})
