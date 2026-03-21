"use client"

import { useEffect, useMemo, useState } from "react"

import { Check, Copy, Key, RefreshCw, Trash2 } from "lucide-react"
import useSWR from "swr"

import { createBrowserClient } from "../../lib/supabase/client"

type ApiKeyRecord = {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
}

type ApiKeysResponse = {
  api_keys: ApiKeyRecord[]
}

type CreateApiKeyResponse = {
  id: string
  name: string
  key: string
  key_prefix: string
  reveal: true
  created_at: string
  warning: string
}

type ToastType = "success" | "error" | "info"

type ToastItem = {
  id: number
  message: string
  type: ToastType
}

type TabId = "python" | "javascript"

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createBrowserClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Missing session")
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let message = `Failed to load ${path}`

    try {
      const body = (await response.json()) as { error?: string; details?: string[] }
      message = body.details?.[0] ?? body.error ?? message
    } catch {
      // Ignore malformed error payloads.
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function formatDate(value: string | null) {
  if (!value) {
    return "Never"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value)
}

function KeySnippet({
  code,
  copied,
  onCopy,
}: {
  code: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="snippet-shell">
      <pre>{code}</pre>
      <button type="button" className="snippet-copy" onClick={onCopy}>
        {copied ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <style jsx>{`
        .snippet-shell {
          position: relative;
        }

        pre {
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

        .snippet-copy {
          position: absolute;
          top: 12px;
          right: 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 32px;
          border: 1px solid #30363d;
          border-radius: 8px;
          background: #161b22;
          color: #e6edf3;
          padding: 0 12px;
          cursor: pointer;
          transition: background 200ms ease, border-color 200ms ease;
        }

        .snippet-copy:hover {
          background: #21262d;
          border-color: #484f58;
        }
      `}</style>
    </div>
  )
}

export function ApiKeysPage() {
  const [keyName, setKeyName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [revealedKey, setRevealedKey] = useState<CreateApiKeyResponse | null>(null)
  const [copiedModalKey, setCopiedModalKey] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [pendingRevoke, setPendingRevoke] = useState<ApiKeyRecord | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("python")
  const [copiedSnippet, setCopiedSnippet] = useState<TabId | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const {
    data,
    error,
    mutate,
    isLoading,
  } = useSWR<ApiKeysResponse>("/v1/apikeys", fetchWithAuth, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  })

  useEffect(() => {
    if (!revealedKey) {
      setCountdown(5)
      return
    }

    const interval = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [revealedKey])

  function showToast(message: string, type: ToastType) {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, message, type }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4000)
  }

  function handleSnippetCopied(tab: TabId) {
    setCopiedSnippet(tab)
    window.setTimeout(() => {
      setCopiedSnippet((current) => (current === tab ? null : current))
    }, 2000)
  }

  async function handleCreateKey() {
    if (!keyName.trim()) {
      showToast("Enter a name before generating a key.", "error")
      return
    }

    setIsCreating(true)

    try {
      const response = await fetchWithAuth<CreateApiKeyResponse>("/v1/apikeys", {
        method: "POST",
        body: JSON.stringify({ name: keyName.trim() }),
      })

      setRevealedKey(response)
      setKeyName("")
      setCopiedModalKey(false)
      await mutate()
      showToast("API key created.", "success")
    } catch (createError) {
      showToast(createError instanceof Error ? createError.message : "Unable to create API key.", "error")
    } finally {
      setIsCreating(false)
    }
  }

  async function handleRevokeKey() {
    if (!pendingRevoke) {
      return
    }

    setIsRevoking(true)

    try {
      await fetchWithAuth(`/v1/apikeys/${pendingRevoke.id}`, {
        method: "DELETE",
      })

      setPendingRevoke(null)
      await mutate()
      showToast("API key revoked.", "success")
    } catch (revokeError) {
      showToast(revokeError instanceof Error ? revokeError.message : "Unable to revoke API key.", "error")
    } finally {
      setIsRevoking(false)
    }
  }

  const displayPrefix = revealedKey?.key_prefix ?? data?.api_keys[0]?.key_prefix ?? "sl_live_xx"

  const pythonSnippet = useMemo(
    () =>
      `pip install spendline\nimport spendline; spendline.patch()\n# key prefix: ${displayPrefix}\n# or\nfrom spendline import track\ntrack(openai.chat.completions.create(...))`,
    [displayPrefix],
  )

  const javascriptSnippet = useMemo(
    () =>
      `npm install spendline\nimport { patchOpenAI } from 'spendline'\n// key prefix: ${displayPrefix}\npatchOpenAI(openai)`,
    [displayPrefix],
  )

  if (error) {
    return (
      <div className="error-card">
        <h2>Unable to load API keys</h2>
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
    <div className="api-keys-page">
      <section className="card">
        <div className="card-header">
          <div>
            <h2>Create API Key</h2>
            <p>Generate a key for production, staging, or local development.</p>
          </div>
        </div>

        <div className="create-row">
          <input
            type="text"
            placeholder="e.g. Production, Staging"
            value={keyName}
            onChange={(event) => setKeyName(event.target.value)}
          />
          <button type="button" className="primary" onClick={() => void handleCreateKey()} disabled={isCreating}>
            <Key size={16} strokeWidth={1.5} />
            {isCreating ? "Generating..." : "Generate Key"}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>API Keys</h2>
            <p>Manage active keys across your tracked environments.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="empty-card">Loading API keys...</div>
        ) : (data?.api_keys.length ?? 0) === 0 ? (
          <div className="empty-card">
            <p>No API keys yet. Generate your first key to start sending SDK telemetry.</p>
          </div>
        ) : (
          <div className="table-shell">
            <div className="table-head">
              <span>Name</span>
              <span>Key</span>
              <span>Created</span>
              <span>Last Used</span>
              <span>Actions</span>
            </div>

            {data?.api_keys.map((apiKey) => (
              <div key={apiKey.id} className="table-row">
                <span>{apiKey.name}</span>
                <span className="mono">{apiKey.key_prefix}...</span>
                <span>{formatDate(apiKey.created_at)}</span>
                <span>{formatDate(apiKey.last_used_at)}</span>
                <span>
                  <button type="button" className="danger-ghost" onClick={() => setPendingRevoke(apiKey)}>
                    <Trash2 size={16} strokeWidth={1.5} />
                    Revoke
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>SDK Quickstart</h2>
            <p>Copy the setup flow for your preferred SDK.</p>
          </div>
        </div>

        <div className="tab-row">
          {(["python", "javascript"] as TabId[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-button${activeTab === tab ? " active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "python" ? "Python" : "JavaScript"}
            </button>
          ))}
        </div>

        {activeTab === "python" ? (
          <KeySnippet
            code={pythonSnippet}
            copied={copiedSnippet === "python"}
            onCopy={() => {
              void copyToClipboard(pythonSnippet)
              handleSnippetCopied("python")
            }}
          />
        ) : (
          <KeySnippet
            code={javascriptSnippet}
            copied={copiedSnippet === "javascript"}
            onCopy={() => {
              void copyToClipboard(javascriptSnippet)
              handleSnippetCopied("javascript")
            }}
          />
        )}
      </section>

      {revealedKey ? (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h2>Your API Key</h2>
            <p>Copy this key now. It will not be shown again.</p>

            <div className="key-block">{revealedKey.key}</div>

            <button
              type="button"
              className="secondary copy-button"
              onClick={() => {
                void copyToClipboard(revealedKey.key)
                setCopiedModalKey(true)
                window.setTimeout(() => setCopiedModalKey(false), 2000)
              }}
            >
              {copiedModalKey ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
              {copiedModalKey ? "Copied" : "Copy"}
            </button>

            <div className="warning-banner">{revealedKey.warning}</div>

            <button
              type="button"
              className="primary done-button"
              disabled={countdown > 0}
              onClick={() => setRevealedKey(null)}
            >
              {countdown > 0 ? `Done (${countdown}s)` : "Done"}
            </button>
          </div>
        </div>
      ) : null}

      {pendingRevoke ? (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h2>Revoke this key?</h2>
            <p>Any SDKs using it will stop sending data.</p>

            <div className="confirm-actions">
              <button type="button" className="secondary" onClick={() => setPendingRevoke(null)} disabled={isRevoking}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={() => void handleRevokeKey()} disabled={isRevoking}>
                {isRevoking ? "Revoking..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <style jsx>{`
        .api-keys-page {
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

        .create-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
        }

        input {
          width: 100%;
          height: 40px;
          border: 1px solid #30363d;
          border-radius: 8px;
          background: #0d1117;
          color: #e6edf3;
          padding: 0 12px;
          outline: none;
          transition: border-color 200ms ease;
        }

        input::placeholder {
          color: #484f58;
        }

        input:focus {
          border-color: #2ecc8a;
        }

        .primary,
        .secondary,
        .danger,
        .danger-ghost,
        .tab-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 40px;
          border-radius: 8px;
          padding: 0 20px;
          font-size: 14px;
          cursor: pointer;
          transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
        }

        .primary {
          border: none;
          background: #2ecc8a;
          color: #0d1117;
        }

        .primary:hover {
          background: #25a870;
        }

        .secondary,
        .tab-button {
          border: 1px solid #30363d;
          background: #21262d;
          color: #e6edf3;
        }

        .secondary:hover,
        .tab-button:hover {
          background: #30363d;
        }

        .danger {
          border: 1px solid rgba(248, 81, 73, 0.2);
          background: transparent;
          color: #f85149;
        }

        .danger:hover,
        .danger-ghost:hover {
          background: rgba(248, 81, 73, 0.08);
        }

        .danger-ghost {
          border: none;
          background: transparent;
          color: #f85149;
          padding: 0;
          height: auto;
          justify-content: flex-start;
        }

        .primary:disabled,
        .secondary:disabled,
        .danger:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .table-shell {
          overflow: hidden;
          border: 1px solid #21262d;
          border-radius: 10px;
        }

        .table-head,
        .table-row {
          display: grid;
          grid-template-columns: 1fr 0.9fr 1fr 1fr 0.7fr;
          gap: 16px;
          align-items: center;
          padding: 12px 16px;
        }

        .table-head {
          background: #0d1117;
          color: #8b949e;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .table-row {
          border-top: 1px solid #21262d;
          color: #e6edf3;
          font-size: 14px;
        }

        .mono {
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 13px;
        }

        .empty-card {
          border: 1px dashed #30363d;
          border-radius: 10px;
          padding: 20px;
          color: #8b949e;
        }

        .tab-row {
          display: inline-flex;
          gap: 8px;
          margin-bottom: 16px;
          border-radius: 10px;
          background: #0d1117;
          padding: 4px;
        }

        .tab-button {
          border-color: transparent;
          background: transparent;
          color: #8b949e;
        }

        .tab-button.active {
          border-color: #30363d;
          background: #21262d;
          color: #e6edf3;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(13, 17, 23, 0.8);
        }

        .modal-panel {
          width: 480px;
          max-width: calc(100vw - 48px);
          border: 1px solid #30363d;
          border-radius: 16px;
          background: #161b22;
          padding: 32px;
          animation: modal-in 200ms ease;
        }

        .modal-panel h2 {
          margin: 0 0 8px;
          color: #e6edf3;
          font-size: 22px;
        }

        .modal-panel p {
          margin: 0 0 20px;
          color: #8b949e;
        }

        .key-block {
          overflow-x: auto;
          border: 1px solid #21262d;
          border-radius: 8px;
          background: #0d1117;
          padding: 16px 20px;
          color: #e6edf3;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 14px;
          line-height: 1.7;
        }

        .copy-button {
          margin-top: 16px;
        }

        .warning-banner {
          margin-top: 16px;
          border: 1px solid rgba(248, 81, 73, 0.2);
          border-radius: 8px;
          background: rgba(248, 81, 73, 0.08);
          padding: 12px 14px;
          color: #f85149;
          font-size: 13px;
          line-height: 1.5;
        }

        .done-button {
          margin-top: 20px;
          width: 100%;
        }

        .confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
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

        @keyframes modal-in {
          from {
            transform: scale(0.96);
            opacity: 0;
          }

          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @media (max-width: 767px) {
          .card {
            padding: 18px;
          }

          .create-row {
            grid-template-columns: 1fr;
          }

          .primary {
            width: 100%;
          }

          .table-shell {
            overflow-x: auto;
          }

          .table-head,
          .table-row {
            min-width: 760px;
          }

          .modal-panel {
            max-width: calc(100vw - 32px);
            padding: 24px;
          }

          .confirm-actions {
            flex-direction: column;
          }

          .confirm-actions :global(button) {
            width: 100%;
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
