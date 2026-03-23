"use client"

import { useEffect, useState } from "react"

import { DollarSign, TrendingDown, TrendingUp, X, Zap } from "lucide-react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import useSWR from "swr"

import { createBrowserClient } from "../../lib/supabase/client"

type Interval = "hourly" | "daily" | "weekly"

type OverviewResponse = {
  total_month_usd: number
  today_usd: number
  total_requests: number
  avg_cost_usd: number
  top_model: string | null
  change: {
    total_month_pct: number
    today_pct: number
    total_requests_pct: number
    avg_cost_pct: number
  }
}

type TimeseriesResponse = {
  interval: Interval
  data: Array<{
    timestamp: string
    spend_usd: number
    requests: number
  }>
}

type ModelsResponse = {
  models: Array<{
    model_id: string
    model_display: string
    provider: string
    spend_usd: number
    request_count: number
    avg_cost_usd: number
  }>
}

type UsersResponse = {
  users: Array<{
    user_id: string
    spend_usd: number
    request_count: number
  }>
}

type RequestsResponse = {
  total: number
  page: number
  limit: number
  requests: Array<{
    id: string
    model_normalised: string
    provider: string
    cost_usd: number
    latency_ms: number
    timestamp: string
  }>
}

const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6": "#d2a8ff",
  "claude-sonnet-4-6": "#bc8cff",
  "claude-haiku-4-5": "#8957e5",
  "claude-3-5-sonnet-20241022": "#a78bfa",
  "claude-3-5-haiku-20241022": "#7c3aed",
  "gpt-5.2": "#60a5fa",
  "gpt-5-mini": "#3b82f6",
  "gpt-5-nano": "#1d4ed8",
  "gpt-4o": "#93c5fd",
  "gpt-4o-mini": "#bfdbfe",
  "gpt-4.1": "#38bdf8",
  "gpt-4.1-mini": "#7dd3fc",
  o3: "#0ea5e9",
  "o4-mini": "#0284c7",
  "gemini-3-1-pro-preview": "#4ade80",
  "gemini-2-5-pro": "#86efac",
  "gemini-2-5-flash": "#bbf7d0",
  "deepseek-chat": "#fb923c",
  "deepseek-reasoner": "#f97316",
  unknown: "#484f58",
}

function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : value < 1 ? 4 : 2,
  }).format(value)
}

function formatPercent(value: number) {
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value.toFixed(1)}%`
}

function formatTimestamp(timestamp: string, interval: Interval) {
  const date = new Date(timestamp)

  if (interval === "hourly") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
    }).format(date)
  }

  if (interval === "weekly") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date)
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date)
}

function formatRelativeTime(timestamp: string) {
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function getCostColor(cost: number) {
  if (cost > 0.1) return "#f85149"
  if (cost >= 0.01) return "#d29922"
  return "#2ECC8A"
}

function getLatencyColor(latency: number) {
  if (latency > 3000) return "#f85149"
  if (latency >= 1000) return "#d29922"
  return "#2ECC8A"
}

async function fetchWithAuth<T>(path: string): Promise<T> {
  const supabase = createBrowserClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Missing session")
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to load ${path}`)
  }

  return response.json() as Promise<T>
}

function ChangeBadge({ value }: { value: number }) {
  const decreased = value < 0

  return (
    <span className={`change-badge ${decreased ? "good" : "bad"}`}>
      {decreased ? <TrendingDown size={11} strokeWidth={1.5} /> : <TrendingUp size={11} strokeWidth={1.5} />}
      {formatPercent(value)}
    </span>
  )
}

function StatCard({
  label,
  value,
  change,
}: {
  label: string
  value: string
  change: number
}) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <strong className="stat-value">{value}</strong>
      <div className="stat-footer">
        <ChangeBadge value={change} />
      </div>
    </article>
  )
}

export function OverviewPage() {
  const [interval, setInterval] = useState<Interval>("daily")
  const [bannerDismissed, setBannerDismissed] = useState(true)

  useEffect(() => {
    const dismissed = localStorage.getItem("spendline-first-call-dismissed")
    if (!dismissed) {
      setBannerDismissed(false)
    }
  }, [])

  function dismissBanner() {
    localStorage.setItem("spendline-first-call-dismissed", "1")
    setBannerDismissed(true)
  }

  const { data: overview, error: overviewError } = useSWR<OverviewResponse>(
    "/v1/stats/overview",
    fetchWithAuth,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  )
  const { data: timeseries, error: timeseriesError } = useSWR<TimeseriesResponse>(
    `/v1/stats/timeseries?interval=${interval}`,
    fetchWithAuth,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  )
  const { data: models, error: modelsError } = useSWR<ModelsResponse>(
    "/v1/stats/models",
    fetchWithAuth,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  )
  const { data: users, error: usersError } = useSWR<UsersResponse>(
    "/v1/stats/users",
    fetchWithAuth,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  )
  const { data: requests, error: requestsError } = useSWR<RequestsResponse>(
    "/v1/stats/requests?limit=10",
    fetchWithAuth,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  )

  const error = overviewError || timeseriesError || modelsError || usersError || requestsError

  if (error) {
    return (
      <div className="error-card">
        <h2>Unable to load dashboard data</h2>
        <p>Check your API connection and try refreshing the page.</p>
        <style jsx>{`
          .error-card {
            border: 1px solid #30363d;
            border-radius: 12px;
            background: #161b22;
            padding: 24px;
          }

          .error-card h2 {
            margin: 0 0 8px;
            font-size: 20px;
          }

          .error-card p {
            margin: 0;
            color: #8b949e;
          }
        `}</style>
      </div>
    )
  }

  const topUsers = users?.users ?? []
  const hasRequests = (overview?.total_requests ?? 0) > 0
  const showBanner = hasRequests && !bannerDismissed

  return (
    <div className="overview">
      {showBanner ? (
        <div className="first-call-banner">
          <span>🎉 First request tracked! Your LLM spend monitoring is live.</span>
          <button type="button" onClick={dismissBanner} aria-label="Dismiss">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      ) : null}

      <section className="stats-grid">
        <StatCard
          label="Total This Month"
          value={overview ? formatCurrency(overview.total_month_usd) : "Loading..."}
          change={overview?.change.total_month_pct ?? 0}
        />
        <StatCard
          label="Today's Spend"
          value={overview ? formatCurrency(overview.today_usd) : "Loading..."}
          change={overview?.change.today_pct ?? 0}
        />
        <StatCard
          label="Total Requests"
          value={overview ? new Intl.NumberFormat("en-US").format(overview.total_requests) : "Loading..."}
          change={overview?.change.total_requests_pct ?? 0}
        />
        <StatCard
          label="Avg Cost / Request"
          value={overview ? formatCurrency(overview.avg_cost_usd) : "Loading..."}
          change={overview?.change.avg_cost_pct ?? 0}
        />
      </section>

      <section className="panel chart-panel">
        <div className="panel-header">
          <div>
            <h2>Spend Over Time</h2>
            <p>{overview?.top_model ? `Top model: ${overview.top_model}` : "Watching your request stream"}</p>
          </div>

          <div className="toggle-group">
            {(["hourly", "daily", "weekly"] as Interval[]).map((value) => (
              <button
                key={value}
                className={value === interval ? "active" : ""}
                type="button"
                onClick={() => setInterval(value)}
              >
                {value[0]!.toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="chart-wrap">
          {(timeseries?.data?.length ?? 0) === 0 ? (
            <div className="chart-empty">
              <p className="chart-empty-heading">No spend data yet</p>
              <p className="chart-empty-sub">Make your first tracked call to see your spend graph populate in real time.</p>
              <Link className="chart-empty-link" href="/dashboard/api-keys">Go to API Keys →</Link>
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height={(timeseries?.data?.length ?? 0) === 0 ? 0 : 280}>
            <AreaChart data={timeseries?.data ?? []}>
              <defs>
                <linearGradient id="spendlineArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2ECC8A" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2ECC8A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#21262d" strokeDasharray="3 3" />
              <XAxis
                axisLine={false}
                dataKey="timestamp"
                minTickGap={24}
                tick={{ fill: "#484f58", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}
                tickFormatter={(value) => formatTimestamp(String(value), interval)}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: "#484f58", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(Number(value), true)}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: 8,
                }}
                formatter={(value: number, name: string) =>
                  name === "spend_usd" ? [formatCurrency(value), "Spend"] : [value, "Requests"]
                }
                labelFormatter={(label) => formatTimestamp(String(label), interval)}
              />
              <Area
                activeDot={{ fill: "#2ECC8A", r: 4, strokeWidth: 0 }}
                dataKey="spend_usd"
                fill="url(#spendlineArea)"
                stroke="#2ECC8A"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-header compact">
            <div>
              <h2>Model Breakdown</h2>
              <p>Current month by spend</p>
            </div>
          </div>

          <div className="chart-wrap small">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={models?.models ?? []}>
                <CartesianGrid vertical={false} stroke="#21262d" strokeDasharray="3 3" />
                <XAxis
                  axisLine={false}
                  dataKey="model_display"
                  tick={{ fill: "#484f58", fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: "#484f58", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}
                  tickFormatter={(value) => formatCurrency(Number(value), true)}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 8,
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Spend"]}
                />
                <Bar
                  dataKey="spend_usd"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                >
                  {(models?.models ?? []).map((model) => (
                    <Cell
                      key={model.model_id}
                      fill={MODEL_COLORS[model.model_id] ?? MODEL_COLORS.unknown}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="legend">
            {(models?.models ?? []).slice(0, 5).map((model) => (
              <div key={model.model_id} className="legend-item">
                <span
                  className="legend-dot"
                  style={{ background: MODEL_COLORS[model.model_id] ?? MODEL_COLORS.unknown }}
                />
                <span>{model.model_display}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header compact">
            <div>
              <h2>Recent Requests</h2>
              <p>Latest 10 tracked calls</p>
            </div>
          </div>

          <div className="mini-table">
            <div className="mini-head">
              <span>Model</span>
              <span>Cost</span>
              <span>Latency</span>
              <span>Time</span>
            </div>

            {(requests?.requests ?? []).map((request) => (
              <div key={request.id} className="mini-row">
                <span>{request.model_normalised}</span>
                <span style={{ color: getCostColor(request.cost_usd) }}>{formatCurrency(request.cost_usd)}</span>
                <span style={{ color: getLatencyColor(request.latency_ms) }}>
                  <Zap size={12} strokeWidth={1.5} />
                  {request.latency_ms}ms
                </span>
                <span>{formatRelativeTime(request.timestamp)}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {topUsers.length > 0 ? (
        <section className="panel users-panel">
          <div className="panel-header compact">
            <div>
              <h2>Top Users</h2>
              <p>Current month by metadata.user_id</p>
            </div>
          </div>

          <div className="users-table">
            <div className="users-head">
              <span>User ID</span>
              <span>Spend</span>
              <span>Requests</span>
            </div>

            {topUsers.map((user) => (
              <div key={user.user_id} className="users-row">
                <span>{user.user_id}</span>
                <span>
                  <DollarSign size={12} strokeWidth={1.5} />
                  {formatCurrency(user.spend_usd)}
                </span>
                <span>{new Intl.NumberFormat("en-US").format(user.request_count)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <style jsx>{`
        .overview {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .stat-card,
        .panel {
          border: 1px solid #21262d;
          border-radius: 12px;
          background: #161b22;
        }

        .stat-card {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .stat-label {
          margin: 0;
          color: #8b949e;
          font-size: 13px;
        }

        .stat-value {
          color: #e6edf3;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.03em;
          line-height: 1.1;
        }

        .stat-footer {
          margin-top: 4px;
        }

        .change-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .change-badge.good {
          background: rgba(46, 204, 138, 0.1);
          color: #2ecc8a;
        }

        .change-badge.bad {
          background: rgba(248, 81, 73, 0.1);
          color: #f85149;
        }

        .first-call-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid rgba(46, 204, 138, 0.3);
          border-radius: 10px;
          background: rgba(46, 204, 138, 0.08);
          padding: 12px 16px;
          color: #2ecc8a;
          font-size: 14px;
          font-weight: 500;
        }

        .first-call-banner button {
          flex-shrink: 0;
          border: none;
          background: transparent;
          color: #2ecc8a;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          opacity: 0.7;
          transition: opacity 200ms ease;
        }

        .first-call-banner button:hover {
          opacity: 1;
        }

        .chart-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 280px;
          text-align: center;
          padding: 32px;
        }

        .chart-empty-heading {
          margin: 0 0 8px;
          color: #e6edf3;
          font-size: 16px;
          font-weight: 600;
        }

        .chart-empty-sub {
          margin: 0 0 20px;
          color: #8b949e;
          font-size: 14px;
          max-width: 360px;
          line-height: 1.6;
        }

        .chart-empty-link {
          display: inline-flex;
          align-items: center;
          height: 36px;
          border: 1px solid #2ecc8a;
          border-radius: 8px;
          padding: 0 16px;
          color: #2ecc8a;
          font-size: 14px;
          font-weight: 500;
          transition: background 200ms ease;
        }

        .chart-empty-link:hover {
          background: rgba(46, 204, 138, 0.08);
        }

        .panel {
          padding: 20px 24px 24px;
        }

        .panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .panel-header.compact {
          margin-bottom: 16px;
        }

        .panel-header h2 {
          margin: 0 0 6px;
          color: #e6edf3;
          font-size: 20px;
        }

        .panel-header p {
          margin: 0;
          color: #8b949e;
          font-size: 13px;
        }

        .toggle-group {
          display: inline-flex;
          gap: 8px;
          border-radius: 10px;
          background: #0d1117;
          padding: 4px;
        }

        .toggle-group button {
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: #8b949e;
          padding: 8px 12px;
          transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
          cursor: pointer;
        }

        .toggle-group button.active {
          border-color: #30363d;
          background: #21262d;
          color: #e6edf3;
        }

        .chart-wrap {
          height: 280px;
        }

        .small {
          margin-bottom: 16px;
        }

        .two-column {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #8b949e;
          font-size: 12px;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 9999px;
        }

        .mini-table,
        .users-table {
          overflow: hidden;
          border: 1px solid #21262d;
          border-radius: 10px;
        }

        .mini-head,
        .users-head,
        .mini-row,
        .users-row {
          display: grid;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
        }

        .mini-head,
        .users-head {
          background: #0d1117;
          color: #8b949e;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .mini-head,
        .mini-row {
          grid-template-columns: 1.2fr 0.8fr 0.8fr 1fr;
        }

        .users-head,
        .users-row {
          grid-template-columns: 1.4fr 0.8fr 0.8fr;
        }

        .mini-row,
        .users-row {
          border-top: 1px solid #21262d;
          color: #e6edf3;
          font-size: 14px;
        }

        .mini-row span:nth-child(2),
        .mini-row span:nth-child(3),
        .users-row span:nth-child(2),
        .users-row span:nth-child(3) {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 13px;
        }

        .users-panel {
          margin-top: 0;
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 767px) {
          .stats-grid,
          .two-column {
            grid-template-columns: 1fr;
          }

          .panel {
            padding: 18px;
          }

          .panel-header {
            flex-direction: column;
          }

          .mini-table,
          .users-table {
            overflow-x: auto;
          }

          .mini-head,
          .mini-row {
            min-width: 640px;
          }

          .users-head,
          .users-row {
            min-width: 480px;
          }
        }
      `}</style>
    </div>
  )
}
