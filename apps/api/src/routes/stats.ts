import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { supabaseAnon, supabaseService } from '../lib/supabase.js'

type RequestRow = {
  id: string
  model_raw: string
  model_normalised: string
  provider: string
  tokens_in: number
  tokens_out: number
  cost_usd: number | string
  latency_ms: number
  workflow_id: string | null
  session_id: string | null
  request_id: string | null
  unknown_model: boolean
  metadata: Record<string, unknown> | null
  timestamp: string
}

type ModelLookupRow = {
  model_id: string
  display_name: string
}

type Interval = 'hourly' | 'daily' | 'weekly'

type TimeseriesRow = {
  bucket: string
  spend_usd: number | string
  requests: number | string
}

const DAY_MS = 24 * 60 * 60 * 1000

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7)
}

function sumCost(rows: RequestRow[]): number {
  return rows.reduce((total, row) => total + toNumber(row.cost_usd), 0)
}

function averageCost(rows: RequestRow[]): number {
  if (rows.length === 0) {
    return 0
  }

  return sumCost(rows) / rows.length
}

function roundTo(value: number, decimals: number): number {
  const multiplier = 10 ** decimals
  return Math.round(value * multiplier) / multiplier
}

function percentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100
  }

  return roundTo(((current - previous) / previous) * 100, 1)
}

async function requireUserId(request: FastifyRequest): Promise<string | null> {
  const authHeader = request.headers.authorization
  const token = authHeader?.replace('Bearer ', '').trim()

  if (!token) {
    return null
  }

  const {
    data: { user },
    error,
  } = await supabaseAnon.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return user.id
}

async function fetchRequestsForRange(
  userId: string,
  from: Date,
  to?: Date,
): Promise<RequestRow[]> {
  let query = supabaseService
    .from('requests')
    .select(
      'id, model_raw, model_normalised, provider, tokens_in, tokens_out, cost_usd, latency_ms, workflow_id, session_id, request_id, unknown_model, metadata, timestamp',
    )
    .eq('user_id', userId)
    .gte('timestamp', from.toISOString())
    .order('timestamp', { ascending: true })

  if (to) {
    query = query.lt('timestamp', to.toISOString())
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as RequestRow[]
}

function parseNumberQuery(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseIsoQuery(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined
  }

  return Number.isNaN(Date.parse(value)) ? undefined : new Date(value).toISOString()
}

function getTopModel(rows: RequestRow[]): string | null {
  const spendByModel = new Map<string, number>()

  for (const row of rows) {
    spendByModel.set(
      row.model_normalised,
      (spendByModel.get(row.model_normalised) ?? 0) + toNumber(row.cost_usd),
    )
  }

  return [...spendByModel.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null
}

export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/stats/overview', async (request, reply) => {
    try {
      const userId = await requireUserId(request)

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', code: 401 })
      }

      const now = new Date()
      const monthStart = startOfUtcMonth(now)
      const elapsedInMonthMs = now.getTime() - monthStart.getTime()
      const previousMonthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
      )
      const previousEquivalentEnd = new Date(previousMonthStart.getTime() + elapsedInMonthMs)
      const todayStart = startOfUtcDay(now)
      const tomorrowStart = addDays(todayStart, 1)
      const yesterdayStart = addDays(todayStart, -1)

      const [currentMonthRows, previousMonthRows, todayRows, yesterdayRows] =
        await Promise.all([
          fetchRequestsForRange(userId, monthStart),
          fetchRequestsForRange(userId, previousMonthStart, previousEquivalentEnd),
          fetchRequestsForRange(userId, todayStart, tomorrowStart),
          fetchRequestsForRange(userId, yesterdayStart, todayStart),
        ])

      const totalMonthUsd = roundTo(sumCost(currentMonthRows), 2)
      const todayUsd = roundTo(sumCost(todayRows), 2)
      const totalRequests = currentMonthRows.length
      const avgCostUsd = roundTo(averageCost(currentMonthRows), 5)
      const topModel = getTopModel(currentMonthRows)

      return reply.status(200).send({
        total_month_usd: totalMonthUsd,
        today_usd: todayUsd,
        total_requests: totalRequests,
        avg_cost_usd: avgCostUsd,
        top_model: topModel,
        change: {
          total_month_pct: percentageChange(sumCost(currentMonthRows), sumCost(previousMonthRows)),
          today_pct: percentageChange(sumCost(todayRows), sumCost(yesterdayRows)),
          total_requests_pct: percentageChange(
            currentMonthRows.length,
            previousMonthRows.length,
          ),
          avg_cost_pct: percentageChange(
            averageCost(currentMonthRows),
            averageCost(previousMonthRows),
          ),
        },
      })
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch overview stats')

      return reply.status(500).send({
        error: 'Internal server error',
        code: 500,
      })
    }
  })

  app.get('/v1/stats/timeseries', async (request, reply) => {
    try {
      const userId = await requireUserId(request)

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', code: 401 })
      }

      const rawInterval = (request.query as { interval?: string }).interval
      const interval: Interval =
        rawInterval === 'hourly' || rawInterval === 'weekly' ? rawInterval : 'daily'

      const now = new Date()
      const rangeStart =
        interval === 'hourly'
          ? new Date(now.getTime() - 48 * 60 * 60 * 1000)
          : interval === 'weekly'
            ? addWeeks(startOfUtcDay(now), -12)
            : addDays(startOfUtcDay(now), -30)
      const bucket =
        interval === 'hourly' ? '1 hour' : interval === 'weekly' ? '1 week' : '1 day'

      const { data, error } = await supabaseService.rpc('get_request_timeseries', {
        p_user_id: userId,
        p_bucket: bucket,
        p_start: rangeStart.toISOString(),
      })

      if (error) {
        throw error
      }

      return reply.status(200).send({
        interval,
        data: ((data ?? []) as TimeseriesRow[]).map((row) => ({
          timestamp: row.bucket,
          spend_usd: roundTo(toNumber(row.spend_usd), 8),
          requests: Number(row.requests),
        })),
      })
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch timeseries stats')

      return reply.status(500).send({
        error: 'Internal server error',
        code: 500,
      })
    }
  })

  app.get('/v1/stats/models', async (request, reply) => {
    try {
      const userId = await requireUserId(request)

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', code: 401 })
      }

      const monthStart = startOfUtcMonth(new Date())
      const [rows, modelsLookup] = await Promise.all([
        fetchRequestsForRange(userId, monthStart),
        supabaseService.from('models').select('model_id, display_name'),
      ])

      if (modelsLookup.error) {
        throw modelsLookup.error
      }

      const displayNameByModel = new Map(
        ((modelsLookup.data ?? []) as ModelLookupRow[]).map((row) => [row.model_id, row.display_name]),
      )

      const byModel = new Map<
        string,
        {
          model_id: string
          provider: string
          spend_usd: number
          request_count: number
        }
      >()

      for (const row of rows) {
        const key = `${row.model_normalised}:${row.provider}`
        const current = byModel.get(key) ?? {
          model_id: row.model_normalised,
          provider: row.provider,
          spend_usd: 0,
          request_count: 0,
        }

        current.spend_usd += toNumber(row.cost_usd)
        current.request_count += 1
        byModel.set(key, current)
      }

      const models = [...byModel.values()]
        .map((entry) => ({
          model_id: entry.model_id,
          model_display: displayNameByModel.get(entry.model_id) ?? entry.model_id,
          provider: entry.provider,
          spend_usd: roundTo(entry.spend_usd, 2),
          request_count: entry.request_count,
          avg_cost_usd: roundTo(entry.spend_usd / entry.request_count, 5),
        }))
        .sort((left, right) => right.spend_usd - left.spend_usd)

      return reply.status(200).send({ models })
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch model stats')

      return reply.status(500).send({
        error: 'Internal server error',
        code: 500,
      })
    }
  })

  app.get('/v1/stats/requests', async (request, reply) => {
    try {
      const userId = await requireUserId(request)

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', code: 401 })
      }

      const query = request.query as Record<string, string | undefined>
      const page = Math.max(parseInt(query.page ?? '1', 10) || 1, 1)
      const limit = Math.min(Math.max(parseInt(query.limit ?? '50', 10) || 50, 1), 100)

      let dataQuery = supabaseService
        .from('requests')
        .select(
          'id, model_raw, model_normalised, provider, tokens_in, tokens_out, cost_usd, latency_ms, workflow_id, session_id, request_id, unknown_model, metadata, timestamp',
          { count: 'exact' },
        )
        .eq('user_id', userId)

      if (query.model) {
        dataQuery = dataQuery.eq('model_normalised', query.model)
      }

      if (query.provider) {
        dataQuery = dataQuery.eq('provider', query.provider)
      }

      const from = parseIsoQuery(query.from)
      const to = parseIsoQuery(query.to)
      const minCost = parseNumberQuery(query.min_cost)
      const maxCost = parseNumberQuery(query.max_cost)

      if (from) {
        dataQuery = dataQuery.gte('timestamp', from)
      }

      if (to) {
        dataQuery = dataQuery.lte('timestamp', to)
      }

      if (query.workflow_id) {
        dataQuery = dataQuery.eq('workflow_id', query.workflow_id)
      }

      if (query.session_id) {
        dataQuery = dataQuery.eq('session_id', query.session_id)
      }

      if (minCost !== undefined) {
        dataQuery = dataQuery.gte('cost_usd', minCost)
      }

      if (maxCost !== undefined) {
        dataQuery = dataQuery.lte('cost_usd', maxCost)
      }

      const start = (page - 1) * limit
      const end = start + limit - 1

      const { data, error, count } = await dataQuery
        .order('timestamp', { ascending: false })
        .range(start, end)

      if (error) {
        throw error
      }

      const requests = ((data ?? []) as RequestRow[]).map((row) => ({
        id: row.id,
        model_raw: row.model_raw,
        model_normalised: row.model_normalised,
        provider: row.provider,
        tokens_in: row.tokens_in,
        tokens_out: row.tokens_out,
        cost_usd: roundTo(toNumber(row.cost_usd), 8),
        latency_ms: row.latency_ms,
        workflow_id: row.workflow_id,
        session_id: row.session_id,
        request_id: row.request_id,
        unknown_model: row.unknown_model,
        metadata: row.metadata ?? {},
        timestamp: row.timestamp,
      }))

      return reply.status(200).send({
        total: count ?? 0,
        page,
        limit,
        requests,
      })
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch request stats')

      return reply.status(500).send({
        error: 'Internal server error',
        code: 500,
      })
    }
  })

  app.get('/v1/stats/users', async (request, reply) => {
    try {
      const userId = await requireUserId(request)

      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized', code: 401 })
      }

      const monthStart = startOfUtcMonth(new Date())
      const rows = await fetchRequestsForRange(userId, monthStart)

      const byUser = new Map<string, { spend_usd: number; request_count: number }>()

      for (const row of rows) {
        const metadataUserId = row.metadata?.user_id

        if (typeof metadataUserId !== 'string' || metadataUserId.length === 0) {
          continue
        }

        const current = byUser.get(metadataUserId) ?? { spend_usd: 0, request_count: 0 }
        current.spend_usd += toNumber(row.cost_usd)
        current.request_count += 1
        byUser.set(metadataUserId, current)
      }

      const users = [...byUser.entries()]
        .map(([user_id, value]) => ({
          user_id,
          spend_usd: roundTo(value.spend_usd, 2),
          request_count: value.request_count,
        }))
        .sort((left, right) => right.spend_usd - left.spend_usd)
        .slice(0, 10)

      return reply.status(200).send({ users })
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch user stats')

      return reply.status(500).send({
        error: 'Internal server error',
        code: 500,
      })
    }
  })
}
