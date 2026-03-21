import { CardSkeleton } from "../../../components/ui/skeleton"

export default function DashboardAlertsLoading() {
  return (
    <div className="stack-16">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}
