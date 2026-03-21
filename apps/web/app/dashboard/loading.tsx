import { ChartSkeleton, StatCardSkeleton, TableRowSkeleton } from "../../components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="stack-16">
      <div className="dashboard-loading-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <ChartSkeleton />
      <div className="stack-16">
        {Array.from({ length: 5 }, (_, index) => (
          <TableRowSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
