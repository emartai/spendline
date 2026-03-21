"use client"

import type { ReactNode } from "react"

import {
  Bell,
  ExternalLink,
  Key,
  LayoutDashboard,
  List,
  Menu,
  Settings,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { signOut } from "../../app/actions/auth"

type DashboardShellProps = {
  children: ReactNode
  userEmail: string
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/logs", label: "Request Log", icon: List },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const

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
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                className={`nav-item${isActive ? " active" : ""}`}
                href={item.href}
              >
                <Icon size={18} strokeWidth={1.5} />
                <span>{item.label}</span>
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
          display: flex;
          height: 100vh;
          width: 240px;
          flex-direction: column;
          border-right: 1px solid #21262d;
          background: #0d1117;
        }

        .sidebar-top {
          padding: 20px 16px;
        }

        .logo {
          display: inline-flex;
          align-items: center;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .logo-mark {
          color: #2ecc8a;
        }

        .nav {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
        }

        .nav-item {
          display: flex;
          height: 40px;
          align-items: center;
          gap: 10px;
          border-left: 2px solid transparent;
          padding: 0 16px;
          color: #8b949e;
          font-size: 14px;
          font-weight: 500;
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
        }

        .nav-item:hover {
          background: #161b22;
          color: #e6edf3;
        }

        .nav-item.active {
          border-left-color: #2ecc8a;
          background: rgba(46, 204, 138, 0.05);
          color: #2ecc8a;
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
          margin-left: 240px;
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
            transform: translateX(-240px);
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
            left: 192px;
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
