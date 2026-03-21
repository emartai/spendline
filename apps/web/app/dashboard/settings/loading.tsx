import { CardSkeleton } from "../../../components/ui/skeleton"

export default function DashboardSettingsLoading() {
  return (
    <div className="stack-16">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}
