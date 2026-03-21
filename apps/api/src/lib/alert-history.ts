import { supabaseService } from './supabase.js'

export type AlertHistoryType = 'threshold' | 'daily_digest'

type AlertHistoryRow = {
  id: string
  alert_type: AlertHistoryType
  amount_usd: number | string | null
  email: string
  created_at: string
}

export async function recordAlertHistory(params: {
  userId: string
  alertType: AlertHistoryType
  amountUsd?: number
  email: string
}): Promise<void> {
  const { error } = await supabaseService.from('alert_history').insert({
    user_id: params.userId,
    alert_type: params.alertType,
    amount_usd: params.amountUsd ?? null,
    email: params.email,
  })

  if (error) {
    throw error
  }
}

export async function getAlertHistory(userId: string, limit = 10): Promise<AlertHistoryRow[]> {
  const { data, error } = await supabaseService
    .from('alert_history')
    .select('id, alert_type, amount_usd, email, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []) as AlertHistoryRow[]
}
