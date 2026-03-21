import { Resend } from 'resend'

import DailyDigest from '../emails/DailyDigest.js'
import SpendAlert from '../emails/SpendAlert.js'

type SpendAlertProps = {
  email: string
  currentSpendUsd: number
  thresholdUsd: number
  topModel: string
  dashboardUrl: string
}

type DailyDigestProps = {
  email: string
  totalSpendUsd: number
  requestCount: number
  modelBreakdown: Array<{ model: string; spend_usd: number; requests: number }>
  dashboardUrl: string
  date: string
}

const resendApiKey = process.env.RESEND_API_KEY

if (!resendApiKey) {
  throw new Error('RESEND_API_KEY is required')
}

const resend = new Resend(resendApiKey)
const fromAddress =
  process.env.NODE_ENV === 'production' ? 'alerts@yourdomain.com' : 'onboarding@resend.dev'

export async function sendSpendAlert(props: SpendAlertProps): Promise<void> {
  await resend.emails.send({
    from: fromAddress,
    to: props.email,
    subject: `Spendline alert: $${props.currentSpendUsd.toFixed(2)} this month`,
    react: SpendAlert(props),
  })
}

export async function sendDailyDigest(props: DailyDigestProps): Promise<void> {
  await resend.emails.send({
    from: fromAddress,
    to: props.email,
    subject: `Spendline daily digest for ${props.date}`,
    react: DailyDigest(props),
  })
}
