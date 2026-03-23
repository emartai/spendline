"use client"

import type { ReactNode } from "react"

import { ExternalLink, Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { signOut } from "../../app/actions/auth"

type DashboardShellProps = {
  children: ReactNode
  userEmail: string
}

function NavIcon({ href }: { href: string }) {
  switch (href) {
    case "/dashboard":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      )
    case "/dashboard/logs":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3" cy="6" r="1" />
          <circle cx="3" cy="12" r="1" />
          <circle cx="3" cy="18" r="1" />
        </svg>
      )
    case "/dashboard/alerts":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    case "/dashboard/api-keys":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7.5" cy="15.5" r="4.5" />
          <path d="M21 2l-9.6 9.6M15.5 7.5l2 2L21 6l-2-2" />
        </svg>
      )
    case "/dashboard/settings":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    default:
      return null
  }
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/logs", label: "Request Log" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/api-keys", label: "API Keys" },
  { href: "/dashboard/settings", label: "Settings" },
]

function getPageTitle(pathname: string) {
  const match = NAV_ITEMS.find((item) => item.href === pathname)
  if (match) {
    return match.label
  }

  const nestedMatch = NAV_ITEMS.find((item) => item.href !== "/dashboard" && pathname.startsWith(item.href))
  return nestedMatch?.label ?? "Dashboard"
}

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  return (
    <div className="dashboard-shell">
      <input className="drawer-toggle" id="dashboard-drawer" type="checkbox" />

      <label className="drawer-backdrop" htmlFor="dashboard-drawer" />

      <aside className="sidebar">
        <div className="sidebar-top">
          <Link className="logo" href="/dashboard">
            <span className="logo-mark">$</span>
            <span>pendline</span>
          </Link>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                className={`nav-item${isActive ? " active" : ""}`}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  height: "42px",
                  padding: "0 14px",
                  borderRadius: "10px",
                  border: "1px solid transparent",
                  background: isActive ? "rgba(255, 255, 255, 0.04)" : "transparent",
                  boxShadow: isActive ? "inset 0 1px 0 rgba(255, 255, 255, 0.015)" : "none",
                  color: isActive ? "#52d59e" : "#a3adba",
                  fontSize: "13px",
                  fontWeight: 500,
                  lineHeight: 1,
                }}
              >
                <span
                  className="nav-icon"
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    width: "18px",
                    minWidth: "18px",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "currentColor",
                  }}
                >
                  <NavIcon href={item.href} />
                </span>
                <span className="nav-label" style={{ whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <p className="user-email" title={userEmail}>
            {userEmail}
          </p>
          <form action={signOut}>
            <button className="sign-out-button" type="submit">
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="topbar-left">
            <label className="drawer-button" htmlFor="dashboard-drawer">
              <Menu size={18} strokeWidth={1.5} />
            </label>
            <h1>{pageTitle}</h1>
          </div>

          <a className="docs-link" href="/" rel="noreferrer">
            <span>Docs</span>
            <ExternalLink size={16} strokeWidth={1.5} />
          </a>
        </header>

        <main className="content-area">
          <div className="content-inner">{children}</div>
        </main>
      </div>

      <label className="drawer-close" htmlFor="dashboard-drawer">
        <X size={18} strokeWidth={1.5} />
      </label>

      <style jsx>{`
        .dashboard-shell {
          min-height: 100vh;
          background: #0d0f14;
        }

        .drawer-toggle {
          display: none;
        }

        .drawer-backdrop,
        .drawer-close,
        .drawer-button {
          display: none;
        }

        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 30;
          height: 100vh;
          display: flex;
          width: 224px;
          flex-direction: column;
          border-right: 1px solid #21262d;
          background: #111722;
        }

        .sidebar-top {
          padding: 18px 16px 10px;
        }

        .logo {
          display: inline-flex;
          align-items: center;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .logo-mark {
          color: #2ecc8a;
        }

        .nav {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 0 10px;
        }

        .nav-item {
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #e6edf3;
        }

        .nav-item.active {
          border-color: rgba(29, 158, 117, 0.08);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.015);
          color: #52d59e;
        }

        .sidebar-bottom {
          margin-top: auto;
          border-top: 1px solid #21262d;
          padding: 16px;
        }

        .user-email {
          margin: 0 0 12px;
          overflow: hidden;
          color: #8b949e;
          font-size: 13px;
          line-height: 1.5;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sign-out-button {
          width: 100%;
          height: 40px;
          border: none;
          background: transparent;
          color: #8b949e;
          text-align: left;
          transition: color 200ms ease;
          cursor: pointer;
        }

        .sign-out-button:hover {
          color: #e6edf3;
        }

        .content {
          margin-left: 224px;
          min-height: 100vh;
          background: #0d0f14;
        }

        .topbar {
          display: flex;
          height: 60px;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #21262d;
          padding: 0 32px;
          background: rgba(13, 15, 20, 0.94);
          backdrop-filter: blur(8px);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .topbar h1 {
          margin: 0;
          color: #e6edf3;
          font-size: 16px;
          font-weight: 600;
        }

        .docs-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #8b949e;
          font-size: 14px;
          transition: color 200ms ease;
        }

        .docs-link:hover {
          color: #e6edf3;
        }

        .content-area {
          padding: 32px;
        }

        .content-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        @media (max-width: 767px) {
          .drawer-button {
            display: inline-flex;
            height: 36px;
            width: 36px;
            align-items: center;
            justify-content: center;
            border: 1px solid #30363d;
            border-radius: 8px;
            background: #161b22;
            color: #e6edf3;
            cursor: pointer;
          }

          .sidebar {
            transform: translateX(-224px);
            transition: transform 250ms ease;
            box-shadow: 24px 0 48px rgba(0, 0, 0, 0.25);
          }

          .content {
            margin-left: 0;
          }

          .topbar {
            padding: 0 16px;
          }

          .content-area {
            padding: 20px 16px 24px;
          }

          .drawer-backdrop {
            position: fixed;
            inset: 0;
            z-index: 20;
            display: block;
            background: rgba(13, 17, 23, 0.8);
            opacity: 0;
            pointer-events: none;
            transition: opacity 250ms ease;
          }

          .drawer-close {
            position: fixed;
            top: 14px;
            left: 176px;
            z-index: 31;
            display: inline-flex;
            height: 36px;
            width: 36px;
            align-items: center;
            justify-content: center;
            border: 1px solid #30363d;
            border-radius: 8px;
            background: #161b22;
            color: #e6edf3;
            opacity: 0;
            pointer-events: none;
            transition: opacity 250ms ease;
            cursor: pointer;
          }

          .drawer-toggle:checked ~ .sidebar {
            transform: translateX(0);
          }

          .drawer-toggle:checked ~ .drawer-backdrop {
            opacity: 1;
            pointer-events: auto;
          }

          .drawer-toggle:checked ~ .drawer-close {
            opacity: 1;
            pointer-events: auto;
          }
        }
      `}</style>
    </div>
  )
}
