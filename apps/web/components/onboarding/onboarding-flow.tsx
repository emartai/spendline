"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Check, Copy } from "lucide-react"

import { createBrowserClient } from "../../lib/supabase/client"
import { useToast } from "../ui/toast"

type OnboardingFlowProps = {
  initialOnboarded: boolean
  userEmail: string
}

type OverviewResponse = {
  total_requests: number
  avg_cost_usd: number
}

type CreateKeyResponse = {
  id: string
  name: string
  key: string
  key_prefix: string
}

const PYTHON_SNIPPET = (prefix: string) =>
  `pip install spendline\n\n# key prefix: ${prefix}\nfrom spendline import track\ntrack(openai.chat.completions.create(...))`

const JAVASCRIPT_SNIPPET = (prefix: string) =>
  `npm install spendline\n\n// key prefix: ${prefix}\nimport { patchOpenAI } from "spendline"\npatchOpenAI(openai)`

export function OnboardingFlow({ initialOnboarded, userEmail }: OnboardingFlowProps) {
  const { showToast } = useToast()
  const [isVisible, setIsVisible] = useState(!initialOnboarded)
  const [step, setStep] = useState(1)
  const [apiKeyName, setApiKeyName] = useState("Production")
  const [generatedKey, setGeneratedKey] = useState("")
  const [keyPrefix, setKeyPrefix] = useState("sl_live_")
  const [tab, setTab] = useState<"python" | "javascript">("python")
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedValue, setCopiedValue] = useState("")
  const [firstRequestCost, setFirstRequestCost] = useState<number | null>(null)

  const snippet = tab === "python" ? PYTHON_SNIPPET(keyPrefix) : JAVASCRIPT_SNIPPET(keyPrefix)

  const fetchWithAuth = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const supabase = createBrowserClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error("Missing session.")
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
      throw new Error(`Failed to load ${path}`)
    }

    return response.json() as Promise<T>
  }, [])

  const markOnboarded = useCallback(async () => {
    const supabase = createBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return
    }

    await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? userEmail,
          onboarded: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
  }, [userEmail])

  async function handleSkip() {
    await markOnboarded()
    setIsVisible(false)
  }

  async function generateKey() {
    setIsGenerating(true)

    try {
      const response = await fetchWithAuth<CreateKeyResponse>("/v1/apikeys", {
        method: "POST",
        body: JSON.stringify({
          name: apiKeyName.trim() || "Production",
        }),
      })

      setGeneratedKey(response.key)
      setKeyPrefix(response.key_prefix)
      showToast("API key generated.", "success")
      window.setTimeout(() => setStep(2), 2000)
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to create API key.", "error")
    } finally {
      setIsGenerating(false)
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedValue(value)
    showToast("Copied to clipboard.", "success")
    window.setTimeout(() => setCopiedValue(""), 2000)
  }

  const pollForFirstRequest = useCallback(async () => {
    try {
      const overview = await fetchWithAuth<OverviewResponse>("/v1/stats/overview")

      if (overview.total_requests > 0) {
        setFirstRequestCost(overview.avg_cost_usd)
        await markOnboarded()
        setStep(4)
      }
    } catch {
      // Keep polling quietly.
    }
  }, [fetchWithAuth, markOnboarded])

  useEffect(() => {
    if (!isVisible || step !== 3) {
      return
    }

    const interval = window.setInterval(() => {
      void pollForFirstRequest()
    }, 3000)

    return () => window.clearInterval(interval)
  }, [isVisible, pollForFirstRequest, step])

  const dots = useMemo(() => [1, 2, 3], [])

  if (!isVisible) {
    return null
  }

  return (
    <div className="overlay">
      <div className="panel">
        {step <= 3 ? (
          <>
            <div className="topbar">
              <div className="progress">
                {dots.map((value) => (
                  <span key={value} className={value === step ? "active" : value < step ? "done" : ""} />
                ))}
              </div>
              <p>Step {step} of 3</p>
            </div>

            {step === 1 ? (
              <section>
                <h2>Create your API key</h2>
                <p>Start with a named key so your first SDK call can authenticate immediately.</p>
                <input
                  placeholder="e.g. Production, Staging"
                  type="text"
                  value={apiKeyName}
                  onChange={(event) => setApiKeyName(event.target.value)}
                />
                <button className="primary" type="button" onClick={() => void generateKey()} disabled={isGenerating}>
                  {isGenerating ? "Generating..." : "Generate Key"}
                </button>
                {generatedKey ? (
                  <div className="code-card">
                    <code>{generatedKey}</code>
                    <button type="button" onClick={() => void copyValue(generatedKey)}>
                      {copiedValue === generatedKey ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {step === 2 ? (
              <section>
                <h2>Install the SDK</h2>
                <p>Pick a runtime and copy the starter snippet with your live key prefix.</p>
                <div className="tabs">
                  <button className={tab === "python" ? "active" : ""} type="button" onClick={() => setTab("python")}>
                    Python
                  </button>
                  <button className={tab === "javascript" ? "active" : ""} type="button" onClick={() => setTab("javascript")}>
                    JavaScript
                  </button>
                </div>
                <div className="snippet">
                  <pre>{snippet}</pre>
                  <button type="button" onClick={() => void copyValue(snippet)}>
                    {copiedValue === snippet ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
                  </button>
                </div>
                <button className="primary" type="button" onClick={() => setStep(3)}>
                  Next
                </button>
              </section>
            ) : null}

            {step === 3 ? (
              <section>
                <h2>Make your first call</h2>
                <p>Send one tracked request and we’ll watch the dashboard for live data.</p>
                <div className="snippet">
                  <pre>{tab === "python"
                    ? `from spendline import track\ntrack(openai.chat.completions.create(model="gpt-5-mini", messages=[{"role": "user", "content": "Hello"}]))`
                    : `import { track } from "spendline"\nawait track(() => openai.chat.completions.create({ model: "gpt-5-mini", messages: [{ role: "user", content: "Hello" }] }))`}</pre>
                </div>
                <div className="waiting">
                  <span className="pulse" />
                  <span>Waiting for your first request...</span>
                </div>
              </section>
            ) : null}

            <div className="footer">
              <button className="ghost" type="button" onClick={() => void handleSkip()}>
                Skip for now
              </button>
            </div>
          </>
        ) : (
          <section className="success">
            <div className="success-mark">
              <Check size={28} strokeWidth={2} />
            </div>
            <h2>You&apos;re live!</h2>
            <p>Your first request cost {firstRequestCost === null ? "$0.00" : `$${firstRequestCost.toFixed(4)}`}</p>
            <button className="primary" type="button" onClick={() => setIsVisible(false)}>
              Go to Dashboard
            </button>
          </section>
        )}
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(13, 17, 23, 0.8);
          padding: 24px;
        }

        .panel {
          width: min(100%, 560px);
          border: 1px solid #30363d;
          border-radius: 16px;
          background: #161b22;
          padding: 40px;
          box-shadow: 0 32px 96px rgba(0, 0, 0, 0.3);
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .progress {
          display: flex;
          gap: 8px;
        }

        .progress span {
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #30363d;
        }

        .progress span.active,
        .progress span.done {
          background: #2ecc8a;
        }

        .topbar p {
          margin: 0;
          color: #8b949e;
          font-size: 13px;
        }

        h2 {
          margin: 0 0 10px;
          font-size: 32px;
          letter-spacing: -0.04em;
        }

        p {
          margin: 0 0 20px;
          color: #8b949e;
          line-height: 1.6;
        }

        input {
          width: 100%;
          height: 44px;
          border: 1px solid #30363d;
          border-radius: 10px;
          background: #0d1117;
          color: #e6edf3;
          padding: 0 14px;
          margin-bottom: 16px;
        }

        .primary,
        .ghost,
        .tabs button,
        .code-card button,
        .snippet button {
          cursor: pointer;
        }

        .primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 140px;
          height: 42px;
          border: none;
          border-radius: 10px;
          background: #2ecc8a;
          color: #0d1117;
          font-weight: 700;
          padding: 0 18px;
        }

        .ghost {
          border: none;
          background: transparent;
          color: #8b949e;
          padding: 0;
        }

        .code-card,
        .snippet {
          position: relative;
          border: 1px solid #21262d;
          border-radius: 12px;
          background: #0d1117;
          padding: 18px 20px;
          margin-bottom: 18px;
        }

        .code-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        code,
        pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          color: #e6edf3;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 13px;
          line-height: 1.7;
        }

        .code-card button,
        .snippet button {
          position: absolute;
          top: 14px;
          right: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: 1px solid #30363d;
          border-radius: 8px;
          background: #161b22;
          color: #e6edf3;
        }

        .tabs {
          display: inline-flex;
          gap: 8px;
          border-radius: 10px;
          background: #0d1117;
          padding: 4px;
          margin-bottom: 16px;
        }

        .tabs button {
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: #8b949e;
          padding: 8px 12px;
        }

        .tabs button.active {
          border-color: #30363d;
          background: #21262d;
          color: #e6edf3;
        }

        .waiting {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          color: #8b949e;
          font-size: 14px;
        }

        .pulse {
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: #2ecc8a;
          animation: pulse 1.2s ease-in-out infinite;
        }

        .footer {
          display: flex;
          justify-content: flex-start;
          margin-top: 12px;
        }

        .success {
          text-align: center;
        }

        .success-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          border-radius: 9999px;
          background: rgba(46, 204, 138, 0.12);
          color: #2ecc8a;
          margin-bottom: 20px;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.92);
          }

          50% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (max-width: 767px) {
          .panel {
            padding: 28px 20px;
          }

          h2 {
            font-size: 26px;
          }
        }
      `}</style>
    </div>
  )
}
