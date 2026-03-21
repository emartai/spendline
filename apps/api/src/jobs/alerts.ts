import cron, { type ScheduledTask } from 'node-cron'

import { recordAlertHistory } from '../lib/alert-history.js'
import { sendDailyDigest, sendSpendAlert } from '../lib/email.js'
import { supabaseService } from '../lib/supabase.js'

type AlertSettingsRow = {
  user_id: string
  monthly_threshold_usd: number | string | null
  threshold_fired_month: string | null
  daily_digest_enabled: boolean
  email: string
}

type RequestRow = {
  model_normalised: string
  cost_usd: number | string
}

let scheduledTasks: ScheduledTask[] = []

function logJobError(message: string, userId: string, error: unknown) {
  const details = error instanceof Error ? error.message : 'unknown error'
  process.stderr.write(`${message} for user ${userId}: ${details}\n`)
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0)
}

async function fetchRequestsForRange(userId: string, from: Date, to?: Date): Promise<RequestRow[]> {
  let query = supabaseService
    .from('requests')
    .select('model_normalised, cost_usd')
    .eq('user_id', userId)
    .gte('timestamp', from.toISOString())

  if (to) {
    query = query.lt('timestamp', to.toISOString())
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as RequestRow[]
}

function groupModelBreakdown(rows: RequestRow[]) {
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

async function runSpendThresholdJob() {
  const { data, error } = await supabaseService
    .from('alert_settings')
    .select('user_id, monthly_threshold_usd, threshold_fired_month, daily_digest_enabled, email')
    .not('monthly_threshold_usd', 'is', null)

  if (error) {
    throw error
  }

  const settings = (data ?? []) as AlertSettingsRow[]
  const now = new Date()
  const monthStart = startOfUtcMonth(now)
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  for (const setting of settings) {
    try {
      const rows = await fetchRequestsForRange(setting.user_id, monthStart)
      const currentSpend = rows.reduce((total, row) => total + toNumber(row.cost_usd), 0)
      const threshold = toNumber(setting.monthly_threshold_usd)

      if (currentSpend <= threshold || setting.threshold_fired_month === currentMonthKey) {
        continue
      }

      const topModel = groupModelBreakdown(rows)[0]?.model ?? 'unknown'

      await sendSpendAlert({
        email: setting.email,
        currentSpendUsd: currentSpend,
        thresholdUsd: threshold,
        topModel,
        dashboardUrl: process.env.CORS_ORIGIN ?? 'http://localhost:3000/dashboard',
      })

      await recordAlertHistory({
        userId: setting.user_id,
        alertType: 'threshold',
        amountUsd: currentSpend,
        email: setting.email,
      })

      const { error: updateError } = await supabaseService
        .from('alert_settings')
        .update({ threshold_fired_month: currentMonthKey })
        .eq('user_id', setting.user_id)

      if (updateError) {
        throw updateError
      }
    } catch (error) {
      logJobError('Spend threshold job failed', setting.user_id, error)
    }
  }
}

async function runDailyDigestJob() {
  const { data, error } = await supabaseService
    .from('alert_settings')
    .select('user_id, monthly_threshold_usd, threshold_fired_month, daily_digest_enabled, email')
    .eq('daily_digest_enabled', true)

  if (error) {
    throw error
  }

  const settings = (data ?? []) as AlertSettingsRow[]
  const today = startOfUtcDay(new Date())
  const yesterday = addDays(today, -1)

  for (const setting of settings) {
    try {
      const rows = await fetchRequestsForRange(setting.user_id, yesterday, today)

      if (rows.length === 0) {
        continue
      }

      await sendDailyDigest({
        email: setting.email,
        totalSpendUsd: rows.reduce((total, row) => total + toNumber(row.cost_usd), 0),
        requestCount: rows.length,
        modelBreakdown: groupModelBreakdown(rows),
        dashboardUrl: process.env.CORS_ORIGIN ?? 'http://localhost:3000/dashboard',
        date: yesterday.toISOString().slice(0, 10),
      })

      await recordAlertHistory({
        userId: setting.user_id,
        alertType: 'daily_digest',
        amountUsd: rows.reduce((total, row) => total + toNumber(row.cost_usd), 0),
        email: setting.email,
      })
    } catch (error) {
      logJobError('Daily digest job failed', setting.user_id, error)
    }
  }
}

export function startAlertJobs() {
  if (scheduledTasks.length > 0) {
    return scheduledTasks
  }

  scheduledTasks = [
    cron.schedule('0 * * * *', () => {
      void runSpendThresholdJob()
    }, {
      timezone: 'UTC',
    }),
    cron.schedule('0 8 * * *', () => {
      void runDailyDigestJob()
    }, {
      timezone: 'UTC',
    }),
  ]

  return scheduledTasks
}
