import type { Metadata } from "next";
import { LaunchDashboardClient } from "./launch-dashboard-client";

export const metadata: Metadata = {
  title: "Resi Edge Property Move Monitor - Data Pond",
  description: "Read-only portfolio launch status dashboard.",
};

export default function ResiEdgeLaunchPage() {
  return <LaunchDashboardClient />;
}
