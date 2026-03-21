import { TableRowSkeleton } from "../../../components/ui/skeleton"

export default function DashboardLogsLoading() {
  return (
    <div className="stack-16">
      <div className="dashboard-filter-bar" />
      {Array.from({ length: 10 }, (_, index) => (
        <TableRowSkeleton key={index} />
      ))}
    </div>
  )
}
