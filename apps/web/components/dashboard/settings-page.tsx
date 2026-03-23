"use client"

import { useEffect, useMemo, useState } from "react"

import { AlertTriangle, Download, KeyRound, Trash2 } from "lucide-react"
import useSWR from "swr"

import { deleteAccount, deleteAllData, requestPasswordReset } from "../../app/actions/settings"
import { createBrowserClient } from "../../lib/supabase/client"
import { useToast } from "../ui/toast"

type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY"

type ProfileResponse = {
  id: string
  email: string
  timezone: string
  date_format: DateFormat
  onboarded: boolean
}

async function fetchProfile(): Promise<ProfileResponse> {
  const supabase = createBrowserClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Unable to load account details.")
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? "",
      },
      { onConflict: "id" },
    )
    .select("id, email, timezone, date_format, onboarded")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load profile.")
  }

  return data as ProfileResponse
}

function buildCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "timestamp,model_normalised,provider,tokens_in,tokens_out,cost_usd,latency_ms,workflow_id,session_id,request_id,metadata\n"
  }

  const headers = Object.keys(rows[0]!)
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          const text = typeof value === "string" ? value : JSON.stringify(value ?? "")
          return `"${text.replaceAll('"', '""')}"`
        })
        .join(","),
    ),
  ]

  return lines.join("\n")
}

function getTimezones() {
  const values = Intl.supportedValuesOf("timeZone")
  const grouped = new Map<string, string[]>()

  for (const timezone of values) {
    const [region] = timezone.split("/")
    const bucket = grouped.get(region ?? "Other") ?? []
    bucket.push(timezone)
    grouped.set(region ?? "Other", bucket)
  }

  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))
}

export function SettingsPage() {
  const { showToast } = useToast()
  const { data, error, isLoading, mutate } = useSWR("/profiles/settings", fetchProfile)
  const [timezone, setTimezone] = useState("UTC")
  const [dateFormat, setDateFormat] = useState<DateFormat>("MM/DD/YYYY")
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleteDataOpen, setIsDeleteDataOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [confirmDataText, setConfirmDataText] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")

  const timezoneOptions = useMemo(() => getTimezones(), [])

  useEffect(() => {
    if (data) {
      setTimezone(data.timezone ?? "UTC")
      setDateFormat(data.date_format ?? "MM/DD/YYYY")
    }
  }, [data])

  async function savePreferences() {
    if (!data) {
      return
    }

    setIsSaving(true)

    try {
      const supabase = createBrowserClient()
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          timezone,
          date_format: dateFormat,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)

      if (updateError) {
        throw updateError
      }

      await mutate()
      showToast("Preferences saved.", "success")
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : "Unable to save preferences.", "error")
    } finally {
      setIsSaving(false)
    }
  }

  async function exportData() {
    setIsExporting(true)

    try {
      const supabase = createBrowserClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Missing session.")
      }

      const firstResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/stats/requests?page=1&limit=100`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!firstResponse.ok) {
        throw new Error("Unable to export request data.")
      }

      const firstPayload = (await firstResponse.json()) as { total: number; requests: Array<Record<string, unknown>> }
      const allRows = [...firstPayload.requests]
      const totalPages = Math.max(1, Math.ceil(firstPayload.total / 100))

      for (let page = 2; page <= totalPages; page += 1) {
        const nextResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/stats/requests?page=${page}&limit=100`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        )

        if (!nextResponse.ok) {
          throw new Error("Unable to export the full request history.")
        }

        const nextPayload = (await nextResponse.json()) as { requests: Array<Record<string, unknown>> }
        allRows.push(...nextPayload.requests)
      }

      const csv = buildCsv(allRows)
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "spendline-data.csv"
      anchor.click()
      URL.revokeObjectURL(url)

      showToast(`Exported ${allRows.length} request rows.`, "success")
    } catch (exportError) {
      showToast(exportError instanceof Error ? exportError.message : "Unable to export data.", "error")
    } finally {
      setIsExporting(false)
    }
  }

  async function handlePasswordReset() {
    if (!data?.email) {
      showToast("Missing account email.", "error")
      return
    }

    setIsResetting(true)

    try {
      const result = await requestPasswordReset(data.email)
      if ("error" in result) {
        throw new Error(result.error)
      }

      setPasswordMessage("Check your inbox")
      showToast("Check your inbox for the password reset link.", "success")
    } catch (resetError) {
      showToast(resetError instanceof Error ? resetError.message : "Unable to send reset email.", "error")
    } finally {
      setIsResetting(false)
    }
  }

  if (error) {
    return (
      <div className="error-card">
        <AlertTriangle size={20} strokeWidth={1.5} />
        <div>
          <h2>Unable to load settings</h2>
          <p>Refresh the page and try again.</p>
        </div>
        <style jsx>{`
          .error-card {
            display: flex;
            gap: 14px;
            border: 1px solid #30363d;
            border-radius: 12px;
            background: #161b22;
            padding: 24px;
          }

          h2 {
            margin: 0 0 6px;
          }

          p {
            margin: 0;
            color: #8b949e;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <section className="card">
        <div className="header">
          <div>
            <h2>Account</h2>
            <p>Basic account controls for your Spendline workspace.</p>
          </div>
        </div>

        <div className="field">
          <span className="label">Email</span>
          <div className="readonly">{isLoading ? "Loading..." : data?.email ?? "developer@spendline.dev"}</div>
        </div>

        <button className="secondary" type="button" onClick={() => void handlePasswordReset()} disabled={isResetting}>
          <KeyRound size={16} strokeWidth={1.5} />
          {isResetting ? "Sending..." : "Change Password"}
        </button>
        {passwordMessage ? <p className="inline-message">{passwordMessage}</p> : null}
      </section>

      <section className="card">
        <div className="header">
          <div>
            <h2>Preferences</h2>
            <p>Choose how the dashboard formats dates and schedules alerts.</p>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="timezone">
            Timezone
          </label>
          <select id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {timezoneOptions.map(([region, timezones]) => (
              <optgroup key={region} label={region}>
                {timezones.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="label">Date format</span>
          <div className="radio-group">
            <label>
              <input
                checked={dateFormat === "MM/DD/YYYY"}
                name="date-format"
                type="radio"
                onChange={() => setDateFormat("MM/DD/YYYY")}
              />
              <span>MM/DD/YYYY</span>
            </label>
            <label>
              <input
                checked={dateFormat === "DD/MM/YYYY"}
                name="date-format"
                type="radio"
                onChange={() => setDateFormat("DD/MM/YYYY")}
              />
              <span>DD/MM/YYYY</span>
            </label>
          </div>
        </div>

        <button className="primary" type="button" onClick={() => void savePreferences()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </button>
      </section>

      <section className="card">
        <div className="header">
          <div>
            <h2>Export Data</h2>
            <p>Download your tracked request data as CSV.</p>
          </div>
        </div>

        <button className="secondary" type="button" onClick={() => void exportData()} disabled={isExporting}>
          <Download size={16} strokeWidth={1.5} />
          {isExporting ? "Downloading..." : "Download all my data as CSV"}
        </button>
      </section>

      <section className="card warning">
        <div className="header">
          <div>
            <h2>Delete All Data</h2>
            <p>Permanently removes all tracked requests and alert settings. Your account and API keys remain intact.</p>
          </div>
        </div>

        <button className="warning-button" type="button" onClick={() => setIsDeleteDataOpen(true)}>
          <Trash2 size={16} strokeWidth={1.5} />
          Delete All My Data
        </button>
      </section>

      <section className="card danger">
        <div className="header">
          <div>
            <h2>Delete Account</h2>
            <p>Permanently deletes your account, all API keys, request history, and alert settings. This cannot be undone.</p>
          </div>
        </div>

        <button className="danger-button" type="button" onClick={() => setIsDeleteOpen(true)}>
          <Trash2 size={16} strokeWidth={1.5} />
          Delete Account
        </button>
      </section>

      {isDeleteDataOpen ? (
        <div className="modal-backdrop">
          <div className="modal warning-modal">
            <h3>Delete all data?</h3>
            <p>This permanently removes all your tracked requests and alert settings. Your account and API keys will remain.</p>
            <label className="label" htmlFor="delete-data-confirmation">
              Type <strong>delete my data</strong> to confirm
            </label>
            <input
              id="delete-data-confirmation"
              value={confirmDataText}
              onChange={(event) => setConfirmDataText(event.target.value)}
              placeholder="delete my data"
              type="text"
            />
            <div className="modal-actions">
              <button className="secondary" type="button" onClick={() => setIsDeleteDataOpen(false)}>
                Cancel
              </button>
              <form action={deleteAllData}>
                <button
                  className="warning-button"
                  disabled={confirmDataText !== "delete my data"}
                  type="submit"
                >
                  Delete All Data
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteOpen ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Delete account</h3>
            <p>This will permanently delete your account and all associated data.</p>
            <label className="label" htmlFor="delete-confirmation">
              Type <strong>delete my account</strong> to confirm
            </label>
            <input
              id="delete-confirmation"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="delete my account"
              type="text"
            />
            <div className="modal-actions">
              <button className="secondary" type="button" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </button>
              <form action={deleteAccount}>
                <button
                  className="danger-button"
                  disabled={confirmText !== "delete my account"}
                  type="submit"
                >
                  Permanently Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .settings-page {
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

        .warning {
          border-color: rgba(210, 153, 34, 0.3);
        }

        .danger {
          border-color: rgba(248, 81, 73, 0.2);
        }

        .header {
          margin-bottom: 18px;
        }

        h2 {
          margin: 0 0 8px;
          font-size: 20px;
        }

        .header p {
          margin: 0;
          color: #8b949e;
          font-size: 13px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 18px;
        }

        .label {
          color: #8b949e;
          font-size: 13px;
        }

        .readonly,
        select,
        input {
          width: 100%;
          min-height: 40px;
          border: 1px solid #30363d;
          border-radius: 8px;
          background: #0d1117;
          color: #e6edf3;
          padding: 10px 12px;
        }

        .radio-group {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .radio-group label {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #30363d;
          border-radius: 9999px;
          background: #0d1117;
          padding: 10px 14px;
        }

        .primary,
        .secondary,
        .warning-button,
        .danger-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 40px;
          border-radius: 8px;
          padding: 0 18px;
          cursor: pointer;
        }

        .primary {
          border: none;
          background: #2ecc8a;
          color: #0d1117;
        }

        .secondary {
          border: 1px solid #30363d;
          background: #21262d;
          color: #e6edf3;
        }

        .warning-button {
          border: 1px solid rgba(210, 153, 34, 0.4);
          background: rgba(210, 153, 34, 0.1);
          color: #d29922;
        }

        .danger-button {
          border: 1px solid rgba(248, 81, 73, 0.35);
          background: rgba(248, 81, 73, 0.12);
          color: #f85149;
        }

        .inline-message {
          margin: 12px 0 0;
          color: #2ecc8a;
          font-size: 13px;
        }

        .primary:disabled,
        .secondary:disabled,
        .warning-button:disabled,
        .danger-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(13, 17, 23, 0.84);
          padding: 20px;
        }

        .modal {
          width: min(100%, 480px);
          border: 1px solid rgba(248, 81, 73, 0.24);
          border-radius: 16px;
          background: #161b22;
          padding: 24px;
        }

        .warning-modal {
          border-color: rgba(210, 153, 34, 0.3);
        }

        .modal h3 {
          margin: 0 0 8px;
          font-size: 22px;
        }

        .modal p {
          margin: 0 0 16px;
          color: #8b949e;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 18px;
        }

        @media (max-width: 767px) {
          .card {
            padding: 18px;
          }

          .modal-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}
