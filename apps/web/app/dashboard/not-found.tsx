import Link from "next/link"

export default function DashboardNotFound() {
  return (
    <div className="dashboard-not-found">
      <p className="dashboard-not-found-eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page you requested does not exist in the Spendline dashboard.</p>
      <Link href="/dashboard">Back to dashboard</Link>
    </div>
  )
}
