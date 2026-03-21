"use client"

import type { ReactNode } from "react"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

type ToastType = "success" | "error" | "info"

type Toast = {
  id: number
  message: string
  type: ToastType
}

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000)

    setToasts((current) => [...current, { id, message, type }])

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4000)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.")
  }

  return context
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <>
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <style jsx>{`
        .toast-stack {
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 1000;
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
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
          animation: slide-in 220ms ease;
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
    </>
  )
}
