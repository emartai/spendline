"use client"

import { RouteError } from "../../components/ui/route-error"

export default function DashboardError() {
  return <RouteError message="We couldn't render the overview page right now." />
}
