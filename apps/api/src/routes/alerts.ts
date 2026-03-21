import type { FastifyPluginAsync, FastifyRequest } from 'fastify'

import { getAlertHistory } from '../lib/alert-history.js'
import { sendDailyDigest } from '../lib/email.js'
import { supabaseAnon, supabaseService } from '../lib/supabase.js'

type AlertSettingsRow = {
  monthly_threshold_usd: number | string | null
  daily_digest_enabled: boolean | null
  email: string | null
  updated_at: string | null
}

type ProfileRow = {
  email: string | null
}

type RequestRow = {
  model_normalised: string
  cost_usd: number | string
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

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

async function getExistingSettings(userId: string): Promise<AlertSettingsRow | null> {
  const { data, error } = await supabaseService
    .from('alert_settings')
    .select('monthly_threshold_usd, daily_digest_enabled, email, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as AlertSettingsRow | null) ?? null
}

async function getProfileEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabaseService
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return ((data as ProfileRow | null) ?? null)?.email ?? null
}

async function fetchYesterdayRequests(userId: string): Promise<RequestRow[]> {
  const today = new Date()
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)

  const { data, error } = await supabaseService
    .from('requests')
    .select('model_normalised, cost_usd')
    .eq('user_id', userId)
    .gte('timestamp', start.toISOString())
    .lt('timestamp', end.toISOString())

  if (error) {
    throw error
  }

  return (data ?? []) as RequestRow[]
}

function buildModelBreakdown(rows: RequestRow[]) {
  const byModel = new Map<string, { model: string; spend_usd: number; requests: number }>()

  for (const row of rows) {
    const current = byModel.get(row.model_normalised) ?? {
      model: row.model_normalised,
      spend_usd: 0,
      requests: 0,
    }

    current.spend_usd += toNumber(row.cost_usd)
    current.requests += 1
    byModel.set(row.model_normalised, current)
  }

  return [...byModel.values()].sort((left, right) => right.spend_usd - left.spend_usd)
}

export const alertRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/v1/alerts/history',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await requireUserId(request)

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized', code: 401 })
        }

        const history = await getAlertHistory(userId, 10)

        return reply.status(200).send({
          alerts: history.map((entry) => ({
            id: entry.id,
            type: entry.alert_type,
            amount_usd: entry.amount_usd === null ? null : toNumber(entry.amount_usd),
            email: entry.email,
            created_at: entry.created_at,
          })),
        })
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch alert history')

        return reply.status(500).send({
          error: 'Internal server error',
          code: 500,
        })
      }
    },
  )

  app.get(
    '/v1/alerts/settings',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await requireUserId(request)

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized', code: 401 })
        }

        const settings = await getExistingSettings(userId)

        return reply.status(200).send(
          settings ?? {
            monthly_threshold_usd: null,
            daily_digest_enabled: null,
            email: null,
            updated_at: null,
          },
        )
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch alert settings')

        return reply.status(500).send({
          error: 'Internal server error',
          code: 500,
        })
      }
    },
  )

  app.put(
    '/v1/alerts/settings',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await requireUserId(request)

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized', code: 401 })
        }

        const body = (request.body ?? {}) as {
          monthly_threshold_usd?: unknown
          daily_digest_enabled?: unknown
          email?: unknown
        }

        const details: string[] = []

        if (
          body.monthly_threshold_usd !== undefined &&
          (typeof body.monthly_threshold_usd !== 'number' ||
            !Number.isFinite(body.monthly_threshold_usd) ||
            body.monthly_threshold_usd < 0 ||
            body.monthly_threshold_usd > 999999.99)
        ) {
          details.push('monthly_threshold_usd must be a number between 0 and 999999.99')
        }

        if (
          body.daily_digest_enabled !== undefined &&
          typeof body.daily_digest_enabled !== 'boolean'
        ) {
          details.push('daily_digest_enabled must be a boolean')
        }

        if (body.email !== undefined) {
          if (typeof body.email !== 'string' || body.email.length > 254 || !validateEmail(body.email)) {
            details.push('email must be a valid email address')
          }
        }

        if (details.length > 0) {
          return reply.status(400).send({
            error: 'Validation failed',
            code: 400,
            details,
          })
        }

        const existing = await getExistingSettings(userId)
        const fallbackEmail = await getProfileEmail(userId)
        const email =
          typeof body.email === 'string'
            ? body.email
            : existing?.email ?? fallbackEmail

        if (!email) {
          return reply.status(400).send({
            error: 'Validation failed',
            code: 400,
            details: ['email must be set before saving alert settings'],
          })
        }

        const { data, error } = await supabaseService
          .from('alert_settings')
          .upsert(
            {
              user_id: userId,
              monthly_threshold_usd:
                body.monthly_threshold_usd !== undefined
                  ? body.monthly_threshold_usd
                  : existing?.monthly_threshold_usd ?? null,
              daily_digest_enabled:
                body.daily_digest_enabled !== undefined
                  ? body.daily_digest_enabled
                  : existing?.daily_digest_enabled ?? false,
              email,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )
          .select('monthly_threshold_usd, daily_digest_enabled, email, updated_at')
          .single()

        if (error) {
          throw error
        }

        return reply.status(200).send(data)
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update alert settings')

        return reply.status(500).send({
          error: 'Internal server error',
          code: 500,
        })
      }
    },
  )

  app.post(
    '/v1/alerts/test',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = await requireUserId(request)

        if (!userId) {
          return reply.status(401).send({ error: 'Unauthorized', code: 401 })
        }

        const settings = await getExistingSettings(userId)

        if (!settings?.email) {
          return reply.status(400).send({
            error: 'Validation failed',
            code: 400,
            details: ['email must be configured before sending a test digest'],
          })
        }

        const rows = await fetchYesterdayRequests(userId)

        await sendDailyDigest({
          email: settings.email,
          totalSpendUsd: rows.reduce((total, row) => total + toNumber(row.cost_usd), 0),
          requestCount: rows.length,
          modelBreakdown: buildModelBreakdown(rows),
          dashboardUrl: process.env.CORS_ORIGIN ?? 'http://localhost:3000/dashboard',
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        })

        return reply.status(200).send({
          sent: true,
          email: settings.email,
        })
      } catch (error) {
        request.log.error({ err: error }, 'Failed to send test alert email')

        return reply.status(500).send({
          error: 'Internal server error',
          code: 500,
        })
      }
    },
  )
}
