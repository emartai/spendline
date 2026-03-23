"use client"

import { useEffect, useMemo, useState } from "react"

import { Bell, Mail, RefreshCw, Save, Send } from "lucide-react"
import useSWR from "swr"

import { createBrowserClient } from "../../lib/supabase/client"

type AlertSettingsResponse = {
  monthly_threshold_usd: number | null
  daily_digest_enabled: boolean | null
  email: string | null
  updated_at: string | null
}

type OverviewResponse = {
  total_month_usd: number
}

type AlertHistoryResponse = {
  alerts: Array<{
    id: string
    type: 'threshold' | 'daily_digest'
    amount_usd: number | null
    email: string
    created_at: string
  }>
}

type ToastType = "success" | "error" | "info"

type ToastItem = {
  id: number
  message: string
  type: ToastType
}

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createBrowserClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Missing session")
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    ...(init?.headers as Record<string, string> | undefined),
  }

  if (init?.body !== undefined && !("Content-Type" in headers)) {
    headers["Content-Type"] = "application/json"
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = `Failed to load ${path}`

    try {
      const body = (await response.json()) as { error?: string; details?: string[] }
      message = body.details?.[0] ?? body.error ?? message
    } catch {
      // Ignore JSON parsing issues and fall back to the default error message.
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value)
}

function getProgressColor(progress: number) {
  if (progress >= 100) return "#f85149"
  if (progress >= 80) return "#d29922"
  return "#2ECC8A"
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (nextValue: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="thumb" />
      <style jsx>{`
        .toggle {
          position: relative;
          width: 32px;
          height: 18px;
          border: none;
          border-radius: 9999px;
          background: #30363d;
          cursor: pointer;
          transition: background 200ms ease;
        }

        .toggle.on {
          background: #1D9E75;
        }

        .toggle:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #ffffff;
          transition: transform 200ms ease;
        }

        .toggle.on .thumb {
          transform: translateX(14px);
        }
      `}</style>
    </button>
  )
}

export function AlertsPage() {
  const [thresholdInput, setThresholdInput] = useState("")
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false)
  const [email, setEmail] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [isSavingThreshold, setIsSavingThreshold] = useState(false)
  const [isSavingDigest, setIsSavingDigest] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const {
    data: settings,
    error: settingsError,
    mutate: mutateSettings,
  } = useSWR<AlertSettingsResponse>("/v1/alerts/settings", fetchWithAuth, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  })

  const {
    data: overview,
    error: overviewError,
    mutate: mutateOverview,
  } = useSWR<OverviewResponse>("/v1/stats/overview", fetchWithAuth, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  })
  const {
    data: history,
    error: historyError,
    mutate: mutateHistory,
  } = useSWR<AlertHistoryResponse>("/v1/alerts/history", fetchWithAuth, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  })

  useEffect(() => {
    const supabase = createBrowserClient()

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setUserEmail(data.user.email)
      }
    })
  }, [])

  useEffect(() => {
    if (!settings) {
      return
    }

    setThresholdInput(
      typeof settings.monthly_threshold_usd === "number" ? settings.monthly_threshold_usd.toFixed(2) : "",
    )
    setDailyDigestEnabled(Boolean(settings.daily_digest_enabled))
    setEmail(settings.email ?? userEmail)
  }, [settings, userEmail])

  useEffect(() => {
    if (!settings?.email && !email && userEmail) {
      setEmail(userEmail)
    }
  }, [settings, userEmail, email])

  function showToast(message: string, type: ToastType) {
    const id = Date.now() + Math.floor(Math.random() * 1000)

    setToasts((current) => [...current, { id, message, type }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4000)
  }

  const currentSpend = overview?.total_month_usd ?? 0
  const thresholdValue = Number.parseFloat(thresholdInput)
  const hasThreshold = Number.isFinite(thresholdValue) && thresholdValue > 0
  const progress = hasThreshold ? Math.min((currentSpend / thresholdValue) * 100, 100) : 0
  const progressColor = getProgressColor(progress)
  const error = settingsError || overviewError || historyError
  const persistedThreshold =
    typeof settings?.monthly_threshold_usd === "number" ? settings.monthly_threshold_usd : null

  const emptyHistory = useMemo(
    () => (
      <div className="empty-history">
        <Bell size={18} strokeWidth={1.5} />
        <p>No alerts triggered yet</p>
      </div>
    ),
    [],
  )

  async function saveThreshold() {
    if (!thresholdInput.trim()) {
      showToast("Enter a monthly threshold before saving.", "error")
      return
    }

    const parsed = Number.parseFloat(thresholdInput)

    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast("Monthly threshold must be a valid positive number.", "error")
      return
    }

    setIsSavingThreshold(true)

    try {
      await fetchWithAuth<AlertSettingsResponse>("/v1/alerts/settings", {
        method: "PUT",
        body: JSON.stringify({
          monthly_threshold_usd: parsed,
          daily_digest_enabled: dailyDigestEnabled,
          email: email.trim(),
        }),
      })

      await Promise.all([mutateSettings(), mutateOverview(), mutateHistory()])
      showToast("Spend threshold saved.", "success")
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : "Unable to save threshold.", "error")
    } finally {
      setIsSavingThreshold(false)
    }
  }

  async function saveDigestSettings() {
    if (!email.trim()) {
      showToast("Add an email before saving daily digest settings.", "error")
      return
    }

    setIsSavingDigest(true)

    try {
      await fetchWithAuth<AlertSettingsResponse>("/v1/alerts/settings", {
        method: "PUT",
        body: JSON.stringify({
          monthly_threshold_usd: hasThreshold ? thresholdValue : persistedThreshold,
          daily_digest_enabled: dailyDigestEnabled,
          email: email.trim(),
        }),
      })

      await Promise.all([mutateSettings(), mutateHistory()])
      showToast("Daily digest settings saved.", "success")
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : "Unable to save digest settings.", "error")
    } finally {
      setIsSavingDigest(false)
    }
  }

  async function sendTestEmail() {
    if (!email.trim()) {
      showToast("Add an email before sending a test digest.", "error")
      return
    }

    setIsSendingTest(true)

    try {
      await fetchWithAuth<AlertSettingsResponse>("/v1/alerts/settings", {
        method: "PUT",
        body: JSON.stringify({
          monthly_threshold_usd: hasThreshold ? thresholdValue : persistedThreshold,
          daily_digest_enabled: dailyDigestEnabled,
          email: email.trim(),
        }),
      })

      const response = await fetchWithAuth<{ sent: boolean; email: string }>("/v1/alerts/test", {
        method: "POST",
      })

      await Promise.all([mutateSettings(), mutateHistory()])
      showToast(`Test email sent to ${response.email}.`, "success")
    } catch (sendError) {
      showToast(sendError instanceof Error ? sendError.message : "Unable to send test email.", "error")
    } finally {
      setIsSendingTest(false)
    }
  }

  if (error) {
    return (
      <div className="error-card">
        <h2>Unable to load alert settings</h2>
        <p>Check your API connection and try again.</p>
        <button
          type="button"
          onClick={() => void Promise.all([mutateSettings(), mutateOverview(), mutateHistory()])}
        >
          <RefreshCw size={14} strokeWidth={1.5} />
          Retry
        </button>
        <style jsx>{`
          .error-card {
            border: 1px solid #30363d;
            border-radius: 12px;
            background: #161b22;
            padding: 24px;
          }

          h2 {
            margin: 0 0 8px;
            font-size: 20px;
          }

          p {
            margin: 0 0 16px;
            color: #8b949e;
          }

          button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 40px;
            border: 1px solid #30363d;
            border-radius: 8px;
            background: #21262d;
            color: #e6edf3;
            padding: 0 16px;
            cursor: pointer;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="alerts-page">
      <section className="card">
        <div className="card-header">
          <div>
            <h2>Spend Threshold</h2>
            <p>Alert me when monthly spend exceeds</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="threshold">Monthly threshold</label>
          <div className="currency-input">
            <span>$</span>
            <input
              id="threshold"
              type="number"
              min="0"
              step="0.01"
              placeholder="100.00"
              value={thresholdInput}
              onChange={(event) => setThresholdInput(event.target.value)}
            />
          </div>
        </div>

        {hasThreshold ? (
          <div className="progress-wrap">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${progress}%`,
                  background: progressColor,
                }}
              />
            </div>
            <p>
              Current spend: {formatCurrency(currentSpend)} / {formatCurrency(thresholdValue)}
            </p>
          </div>
        ) : null}

        <div className="actions">
          <button type="button" className="primary" onClick={() => void saveThreshold()} disabled={isSavingThreshold}>
            <Save size={16} strokeWidth={1.5} />
            {isSavingThreshold ? "Saving..." : "Save"}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Daily Digest</h2>
            <p>Send me a daily spend summary</p>
          </div>
          <Toggle checked={dailyDigestEnabled} onChange={setDailyDigestEnabled} />
        </div>

        <div className="field">
          <label htmlFor="digest-email">Email</label>
          <div className="icon-input">
            <Mail size={16} strokeWidth={1.5} />
            <input
              id="digest-email"
              type="email"
              placeholder="dev@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>

        <div className="actions split">
          <button
            type="button"
            className="secondary"
            onClick={() => void sendTestEmail()}
            disabled={isSendingTest}
          >
            <Send size={16} strokeWidth={1.5} />
            {isSendingTest ? "Sending..." : "Send test email"}
          </button>

          <button type="button" className="primary" onClick={() => void saveDigestSettings()} disabled={isSavingDigest}>
            <Save size={16} strokeWidth={1.5} />
            {isSavingDigest ? "Saving..." : "Save"}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Recent Alerts</h2>
            <p>Threshold alerts and digest sends</p>
          </div>
        </div>

        <div className="history-table">
          <div className="history-head">
            <span>Date</span>
            <span>Type</span>
            <span>Amount</span>
          </div>
          {(history?.alerts.length ?? 0) === 0
            ? emptyHistory
            : history?.alerts.map((alert) => (
                <div key={alert.id} className="history-row">
                  <span>{new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(alert.created_at))}</span>
                  <span>{alert.type === "threshold" ? "Threshold Alert" : "Daily Digest"}</span>
                  <span>{alert.amount_usd === null ? "--" : formatCurrency(alert.amount_usd)}</span>
                </div>
              ))}
        </div>
      </section>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <style jsx>{`
        .alerts-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .card {
          border: 1px solid #21262d;
          border-radius: 12px;
          background: #161b22;
          padding: 24px;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .card-header h2 {
          margin: 0 0 6px;
          color: #e6edf3;
          font-size: 20px;
        }

        .card-header p {
          margin: 0;
          color: #8b949e;
          font-size: 13px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field + .field {
          margin-top: 16px;
        }

        label {
          color: #8b949e;
          font-size: 13px;
        }

        .currency-input,
        .icon-input {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          height: 40px;
          border: 1px solid #30363d;
          border-radius: 8px;
          background: #0d1117;
          padding: 0 12px;
          transition: border-color 200ms ease;
        }

        .currency-input:focus-within,
        .icon-input:focus-within {
          border-color: #2ecc8a;
        }

        .currency-input span,
        .icon-input :global(svg) {
          color: #8b949e;
          flex-shrink: 0;
        }

        input {
          width: 100%;
          height: 100%;
          border: none;
          background: transparent;
          color: #e6edf3;
          outline: none;
          font-size: 14px;
        }

        input::placeholder {
          color: #484f58;
        }

        .progress-wrap {
          margin-top: 20px;
        }

        .progress-track {
          height: 6px;
          overflow: hidden;
          border-radius: 9999px;
          background: #21262d;
        }

        .progress-fill {
          height: 100%;
          border-radius: 9999px;
          transition: width 300ms ease, background 200ms ease;
        }

        .progress-wrap p {
          margin: 12px 0 0;
          color: #8b949e;
          font-size: 13px;
          font-family: var(--font-jetbrains-mono), monospace;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .actions.split {
          justify-content: space-between;
          gap: 12px;
        }

        .primary,
        .secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 40px;
          border-radius: 8px;
          padding: 0 20px;
          font-size: 14px;
          transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
          cursor: pointer;
        }

        .primary {
          border: none;
          background: #2ecc8a;
          color: #0d1117;
        }

        .primary:hover {
          background: #25a870;
        }

        .secondary {
          border: 1px solid #30363d;
          background: #21262d;
          color: #e6edf3;
        }

        .secondary:hover {
          background: #30363d;
        }

        .primary:disabled,
        .secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .history-table {
          overflow: hidden;
          border: 1px solid #21262d;
          border-radius: 10px;
        }

        .history-head {
          display: grid;
          grid-template-columns: 1fr 1fr 0.8fr;
          gap: 16px;
          padding: 12px 16px;
          background: #0d1117;
          color: #8b949e;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .history-row {
          display: grid;
          grid-template-columns: 1fr 1fr 0.8fr;
          gap: 16px;
          border-top: 1px solid #21262d;
          padding: 12px 16px;
          color: #e6edf3;
          font-size: 14px;
        }

        .empty-history {
          display: flex;
          min-height: 120px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-top: 1px solid #21262d;
          color: #8b949e;
          font-size: 14px;
        }

        .empty-history p {
          margin: 0;
        }

        .toast-stack {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .toast {
          width: 320px;
          border: 1px solid #30363d;
          border-left: 3px solid #58a6ff;
          border-radius: 10px;
          background: #161b22;
          padding: 14px 16px;
          color: #e6edf3;
          font-size: 14px;
          animation: slide-in 200ms ease;
        }

        .toast.success {
          border-left-color: #2ecc8a;
        }

        .toast.error {
          border-left-color: #f85149;
        }

        .toast.info {
          border-left-color: #58a6ff;
        }

        @keyframes slide-in {
          from {
            transform: translateX(120%);
            opacity: 0;
          }

          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @media (max-width: 767px) {
          .card {
            padding: 18px;
          }

          .card-header {
            align-items: flex-start;
          }

          .actions.split {
            flex-direction: column;
          }

          .primary,
          .secondary {
            width: 100%;
          }

          .history-table {
            overflow-x: auto;
          }

          .history-head {
            min-width: 480px;
          }

          .history-row {
            min-width: 480px;
          }

          .toast-stack {
            right: 16px;
            bottom: 16px;
            left: 16px;
          }

          .toast {
            width: auto;
          }
        }
      `}</style>
    </div>
  )
}
