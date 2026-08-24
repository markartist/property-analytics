export interface OpsWatchSummary {
  source_count: number;
  active_source_count: number;
  blocked_source_count: number;
  connector_ready_not_harvested_count: number;
  jira_packet_count: number;
  confluence_packet_count: number;
  source_signal_count: number;
  high_source_signal_count: number;
  captain_record_count: number;
  property_count: number;
  critical_record_count: number;
  pending_vendor_record_count: number;
  stale_14_day_record_count: number;
  unresolved_record_count: number;
}

export interface OpsWatchReadinessRow {
  sourceKey: string;
  displayName: string;
  system: string;
  status: string;
  credentialSource: string;
  harvestMode: string;
  captainVisibility: string;
  defaultCadence: string;
  blocker: string;
  actionBoundary: string;
}

export interface OpsWatchSourceSignal {
  signalKey: string;
  title: string;
  url: string;
  category: string;
  severity: string;
  status: string;
  ownerRole: string;
  nextMove: string;
  updated: string | null;
}

export interface OpsWatchCaptainRecord {
  propertyCode: string;
  propertyName: string;
  sourceSystem: string;
  itemKey: string;
  itemUrl: string;
  severity: string;
  priority: string;
  status: string;
  updated: string | null;
  staleDays: number | null;
  category: string;
  ownerRole: string;
  nextMove: string;
}

export interface OpsWatchSourcePacketRef {
  sourceSystem: string;
  runId: string;
  asOf: string | null;
  summary: Record<string, unknown>;
}

export interface OpsWatchSnapshot {
  runId: string;
  asOf: string;
  generatedFrom: string;
  readoutPath: string;
  summary: OpsWatchSummary;
  sourceReadiness: OpsWatchReadinessRow[];
  sourceSignals: OpsWatchSourceSignal[];
  captainRecords: OpsWatchCaptainRecord[];
  sourcePackets: OpsWatchSourcePacketRef[];
  governance: {
    mutationPolicy: string;
    publishPolicy: string;
    actionMode: string;
  };
}
