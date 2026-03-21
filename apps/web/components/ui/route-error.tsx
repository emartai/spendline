"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"

type RouteErrorProps = {
  message: string
  reset?: () => void
}

export function RouteError({ message, reset }: RouteErrorProps) {
  return (
    <>
      <div className="error-card">
        <div className="icon-wrap">
          <AlertTriangle size={18} strokeWidth={1.5} />
        </div>
        <div className="content">
          <h2>Something went wrong</h2>
          <p>{message}</p>
        </div>
        {reset ? (
          <button type="button" onClick={() => reset()}>
            <RefreshCw size={14} strokeWidth={1.5} />
            Retry
          </button>
        ) : null}
      </div>

      <style jsx>{`
        .error-card {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          border: 1px solid #30363d;
          border-radius: 12px;
          background: #161b22;
          padding: 24px;
        }

        .icon-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 9999px;
          background: rgba(248, 81, 73, 0.12);
          color: #f85149;
          flex-shrink: 0;
        }

        .content {
          flex: 1;
        }

        h2 {
          margin: 0 0 8px;
          font-size: 20px;
        }

        p {
          margin: 0;
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

        @media (max-width: 767px) {
          .error-card {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  )
}
