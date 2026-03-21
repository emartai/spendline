import { CardSkeleton, TableRowSkeleton } from "../../../components/ui/skeleton"

export default function DashboardApiKeysLoading() {
  return (
    <div className="stack-16">
      <CardSkeleton />
      <div className="stack-16">
        {Array.from({ length: 3 }, (_, index) => (
          <TableRowSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}
