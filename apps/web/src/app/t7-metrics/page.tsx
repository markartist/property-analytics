"use client";

import { LeasingMetricsPage } from "@/components/metrics/leasing-metrics-page";
import { getCommunities, getT7Metrics, upsertT7Metrics, deleteT7Metrics } from "@/lib/api";

export default function T7MetricsPage() {
  return (
    <LeasingMetricsPage
      period="T7"
      days="7"
      getMetrics={getT7Metrics}
      upsertMetrics={upsertT7Metrics}
      deleteMetrics={deleteT7Metrics}
      getCommunities={getCommunities}
    />
  );
}
