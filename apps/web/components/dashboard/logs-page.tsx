"use client"

import { useMemo, useState } from "react"

import { Download, RefreshCw } from "lucide-react"
import useSWR from "swr"

import { createBrowserClient } from "../../lib/supabase/client"

type RequestRow = {
  id: string
  model_raw: string
  model_normalised: string
  provider: string
  tokens_in: number
  tokens_out: number
  cost_usd: number
  latency_ms: number
  workflow_id: string | null
  session_id: string | null
  request_id: string | null
  unknown_model: boolean
  metadata: Record<string, unknown>
  timestamp: string
}

type RequestsResponse = {
  total: number
  page: number
  limit: number
  requests: RequestRow[]
}

type ModelsResponse = {
  models: Array<{
    model_id: string
    model_display: string
  }>
}

type Filters = {
  from: string
  to: string
  model: string
  provider: string
  workflowId: string
  sessionId: string
  minCost: string
  maxCost: string
}

const DEFAULT_FILTERS: Filters = {
  from: "",
  to: "",
  model: "",
  provider: "",
  workflowId: "",
  sessionId: "",
  minCost: "",
  maxCost: "",
}

const PROVIDERS = ["anthropic", "openai", "google", "deepseek", "bedrock"] as const

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

function buildRequestsPath(filters: Filters, page: number, limit: number) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })

  if (filters.model) params.set("model", filters.model)
  if (filters.provider) params.set("provider", filters.provider)
  if (filters.workflowId) params.set("workflow_id", filters.workflowId)
  if (filters.sessionId) params.set("session_id", filters.sessionId)
  if (filters.minCost) params.set("min_cost", filters.minCost)
  if (filters.maxCost) params.set("max_cost", filters.maxCost)
  if (filters.from) params.set("from", `${filters.from}T00:00:00.000Z`)
  if (filters.to) params.set("to", `${filters.to}T23:59:59.999Z`)

  return `/v1/stats/requests?${params.toString()}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
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

function escapeCsv(value: unknown) {
  const normalized = typeof value === "string" ? value : JSON.stringify(value ?? "")
  const escaped = normalized.replaceAll('"', '""')
  return `"${escaped}"`
}

export function LogsPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const requestsPath = useMemo(() => buildRequestsPath(filters, page, 50), [filters, page])

  const {
    data: requestsData,
    error: requestsError,
    isLoading,
    mutate,
  } = useSWR<RequestsResponse>(requestsPath, fetchWithAuth, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  })

  const { data: modelsData } = useSWR<ModelsResponse>("/v1/stats/models", fetchWithAuth, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  })

  const modelOptions = useMemo(() => {
    const values = new Set<string>()

    for (const model of modelsData?.models ?? []) {
      values.add(model.model_id)
    }

    for (const request of requestsData?.requests ?? []) {
      values.add(request.model_normalised)
    }

    return [...values].sort((left, right) => left.localeCompare(right))
  }, [modelsData, requestsData])

  const total = requestsData?.total ?? 0
  const requests = requestsData?.requests ?? []
  const totalPages = Math.max(1, Math.ceil(total / 50))

  async function exportCsv() {
    setIsExporting(true)

    try {
      const firstPage = await fetchWithAuth<RequestsResponse>(buildRequestsPath(filters, 1, 100))
      const allRows = [...firstPage.requests]
      const totalExportPages = Math.max(1, Math.ceil(firstPage.total / 100))

      for (let currentPage = 2; currentPage <= totalExportPages; currentPage += 1) {
        const nextPage = await fetchWithAuth<RequestsResponse>(buildRequestsPath(filters, currentPage, 100))
        allRows.push(...nextPage.requests)
      }

      const headers = [
        "timestamp",
        "model_normalised",
        "provider",
        "tokens_in",
        "tokens_out",
        "cost_usd",
        "latency_ms",
        "workflow_id",
        "session_id",
        "request_id",
        "metadata",
      ]

      const lines = [
        headers.join(","),
        ...allRows.map((row) =>
          [
            row.timestamp,
            row.model_normalised,
            row.provider,
            row.tokens_in,
            row.tokens_out,
            row.cost_usd,
            row.latency_ms,
            row.workflow_id ?? "",
            row.session_id ?? "",
            row.request_id ?? "",
            row.metadata,
          ]
            .map(escapeCsv)
            .join(","),
        ),
      ]

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "spendline-requests.csv"
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    setPage(1)
    setFilters((current) => ({ ...current, [key]: value }))
  }

  if (requestsError) {
    return (
      <div className="error-card">
        <h2>Unable to load request log</h2>
        <p>Check your API connection and try again.</p>
        <button type="button" onClick={() => void mutate()}>
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
    <div className="logs-page">
      <section className="filter-card">
        <div className="filter-grid">
          <label>
            <span>From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>

          <label>
            <span>To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter("to", event.target.value)}
            />
          </label>

          <label>
            <span>Model</span>
            <select
              value={filters.model}
              onChange={(event) => updateFilter("model", event.target.value)}
            >
              <option value="">All models</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Provider</span>
            <select
              value={filters.provider}
              onChange={(event) => updateFilter("provider", event.target.value)}
            >
              <option value="">All providers</option>
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Workflow ID</span>
            <input
              type="text"
              placeholder="chat-feature-v2"
              value={filters.workflowId}
              onChange={(event) => updateFilter("workflowId", event.target.value)}
            />
          </label>

          <label>
            <span>Session ID</span>
            <input
              type="text"
              placeholder="sess_abc123"
              value={filters.sessionId}
              onChange={(event) => updateFilter("sessionId", event.target.value)}
            />
          </label>

          <label>
            <span>Min Cost</span>
            <input
              type="number"
              placeholder="0.00"
              step="0.0001"
              value={filters.minCost}
              onChange={(event) => updateFilter("minCost", event.target.value)}
            />
          </label>

          <label>
            <span>Max Cost</span>
            <input
              type="number"
              placeholder="1.00"
              step="0.0001"
              value={filters.maxCost}
              onChange={(event) => updateFilter("maxCost", event.target.value)}
            />
          </label>
        </div>

        <div className="filter-actions">
          <button type="button" className="ghost" onClick={() => {
            setFilters(DEFAULT_FILTERS)
            setPage(1)
          }}>
            Clear filters
          </button>
        </div>
      </section>

      <div className="results-bar">
        <p>
          Showing {requests.length} of {total} requests
        </p>
        <button type="button" className="secondary" onClick={() => void exportCsv()} disabled={isExporting}>
          <Download size={16} strokeWidth={1.5} />
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {isLoading ? (
        <div className="table-card loading-card">Loading request log...</div>
      ) : requests.length === 0 ? (
        <div className="empty-card">
          <h2>No requests yet</h2>
          <p>Make your first tracked call:</p>
          <pre>{`from spendline import track\ntrack(openai.chat.completions.create(...))`}</pre>
        </div>
      ) : (
        <section className="table-card">
          <div className="table-scroll">
            <div className="table head">
              <span>Timestamp</span>
              <span>Model</span>
              <span>Provider</span>
              <span>Tokens In</span>
              <span>Tokens Out</span>
              <span>Cost</span>
              <span>Latency</span>
              <span>Workflow ID</span>
            </div>

            {requests.map((request) => {
              const expanded = expandedId === request.id

              return (
                <div key={request.id}>
                  <button
                    type="button"
                    className="table row"
                    onClick={() => setExpandedId(expanded ? null : request.id)}
                  >
                    <span>{formatDateTime(request.timestamp)}</span>
                    <span>{request.model_normalised}</span>
                    <span>{request.provider}</span>
                    <span className="mono">{request.tokens_in.toLocaleString("en-US")}</span>
                    <span className="mono">{request.tokens_out.toLocaleString("en-US")}</span>
                    <span className="mono" style={{ color: getCostColor(request.cost_usd) }}>
                      {formatCurrency(request.cost_usd)}
                    </span>
                    <span className="mono" style={{ color: getLatencyColor(request.latency_ms) }}>
                      {request.latency_ms}ms
                    </span>
                    <span className="mono">{request.workflow_id ?? "--"}</span>
                  </button>

                  {expanded ? (
                    <div className="expanded-row">
                      <pre>{JSON.stringify(request.metadata ?? {}, null, 2)}</pre>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="pagination">
            <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .slice(Math.max(0, page - 3), Math.max(5, Math.min(totalPages, page + 2)))
              .map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value === page ? "active" : ""}
                  onClick={() => setPage(value)}
                >
                  {value}
                </button>
              ))}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </section>
      )}

      <style jsx>{`
        .logs-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .filter-card,
        .table-card,
        .empty-card,
        .loading-card {
          border: 1px solid #21262d;
          border-radius: 12px;
          background: #161b22;
        }

        .filter-card {
          padding: 16px;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        label {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        label span {
          color: #8b949e;
          font-size: 13px;
        }

        input,
        select {
          width: 100%;
          height: 40px;
          border: 1px solid #30363d;
          border-radius: 8px;
          background: #0d1117;
          color: #e6edf3;
          padding: 0 12px;
          outline: none;
        }

        input::placeholder {
          color: #484f58;
        }

        input:focus,
        select:focus {
          border-color: #2ecc8a;
        }

        .filter-actions {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
        }

        .ghost,
        .secondary,
        .pagination button {
          height: 40px;
          border-radius: 8px;
          padding: 0 16px;
          cursor: pointer;
          transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
        }

        .ghost {
          border: none;
          background: transparent;
          color: #8b949e;
        }

        .ghost:hover {
          color: #e6edf3;
        }

        .secondary,
        .pagination button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #30363d;
          background: #21262d;
          color: #e6edf3;
        }

        .secondary:disabled,
        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .results-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .results-bar p {
          margin: 0;
          color: #8b949e;
          font-size: 13px;
        }

        .table-scroll {
          overflow-x: auto;
        }

        .table {
          display: grid;
          grid-template-columns: 1.2fr 1fr 0.8fr 0.7fr 0.7fr 0.7fr 0.7fr 1fr;
          min-width: 1080px;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
        }

        .table.head {
          background: #0d1117;
          color: #8b949e;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .table.row {
          width: 100%;
          border: none;
          border-top: 1px solid #21262d;
          background: transparent;
          color: #e6edf3;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
        }

        .table.row:hover {
          background: #161b22;
        }

        .mono {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 13px;
        }

        .expanded-row {
          border-top: 1px solid #21262d;
          background: #0d1117;
          padding: 16px;
        }

        .expanded-row pre,
        .empty-card pre {
          margin: 0;
          overflow-x: auto;
          border: 1px solid #21262d;
          border-radius: 8px;
          background: #0d1117;
          padding: 16px 20px;
          color: #e6edf3;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 13px;
          line-height: 1.7;
        }

        .pagination {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid #21262d;
        }

        .pagination button.active {
          border-color: #2ecc8a;
          background: rgba(46, 204, 138, 0.1);
          color: #2ecc8a;
        }

        .empty-card,
        .loading-card {
          padding: 24px;
        }

        .empty-card h2,
        .loading-card {
          margin: 0 0 8px;
        }

        .empty-card p {
          margin: 0 0 16px;
          color: #8b949e;
        }

        @media (max-width: 1024px) {
          .filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 767px) {
          .filter-grid {
            grid-template-columns: 1fr;
          }

          .filter-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}
