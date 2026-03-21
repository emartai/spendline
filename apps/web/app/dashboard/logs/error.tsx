"use client"

import { RouteError } from "../../../components/ui/route-error"

export default function DashboardLogsError() {
  return <RouteError message="We couldn't render the request log right now." />
}
