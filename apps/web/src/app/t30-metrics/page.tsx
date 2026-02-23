"use client";

import { LeasingMetricsPage } from "@/components/metrics/leasing-metrics-page";
import { getCommunities, getT30Metrics, upsertT30Metrics, deleteT30Metrics } from "@/lib/api";

export default function T30MetricsPage() {
  return (
    <LeasingMetricsPage
      period="T30"
      days="30"
      getMetrics={getT30Metrics}
      upsertMetrics={upsertT30Metrics}
      deleteMetrics={deleteT30Metrics}
      getCommunities={getCommunities}
    />
  );
}
