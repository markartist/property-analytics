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
  title: string;
  severity: string;
  priority: string;
  status: string;
  updated: string | null;
  staleDays: number | null;
  category: string;
  ownerRole: string;
  nextMove: string;
  ticketCare?: OpsWatchTicketCareRecord;
}

export interface OpsWatchTicketCareRecord {
  flags: string[];
  flagLabels: string[];
  blockerOwner: string;
  customerPromise: string;
  evidenceNeeded: string[];
  recommendedAction: string;
  captainStance: string;
  urgencyRank: number;
}

export interface OpsWatchTicketCarePropertyQueue {
  propertyCode: string;
  propertyName: string;
  posture: string;
  topFlag: string;
  ticketCount: number;
  staleCount: number;
  pendingVendorCount: number;
  proofNeededCount: number;
  customerWaitingCount: number;
  nextBestAction: string;
  records: OpsWatchCaptainRecord[];
}

export interface OpsWatchTicketCarePattern {
  patternKey: string;
  title: string;
  recordCount: number;
  propertyCount: number;
  recommendedAction: string;
}

export interface OpsWatchTicketCareSnapshot {
  summary: {
    ticketCount: number;
    propertyCount: number;
    criticalCount: number;
    pendingVendorCount: number;
    stale14DayCount: number;
    vendorIdleCount: number;
    proofNeededCount: number;
    customerWaitingCount: number;
    routingCheckCount: number;
    employeePhotoCount: number;
  };
  propertyQueues: OpsWatchTicketCarePropertyQueue[];
  patterns: OpsWatchTicketCarePattern[];
}

export interface OpsWatchCommodorePropertySignal {
  propertyCode: string;
  propertyName: string;
  regionName: string;
  captainHref: string;
  posture: string;
  topFlag: string;
  ticketCount: number;
  criticalCount: number;
  stale14DayCount: number;
  pendingVendorCount: number;
  proofNeededCount: number;
  customerWaitingCount: number;
  nextBestAction: string;
  records: OpsWatchCaptainRecord[];
}

export interface OpsWatchCommodoreRegion {
  regionKey: string;
  regionName: string;
  commodoreKey: string;
  commodoreName: string;
  commodoreCallSign: string;
  activationStatus: string;
  ordersStatus: string;
  cadence: string;
  humanOwner: string | null;
  standingOrders: string[];
  activePropertyCount: number;
  signaledPropertyCount: number;
  activeTicketCount: number;
  criticalCount: number;
  stale14DayCount: number;
  pendingVendorCount: number;
  proofNeededCount: number;
  customerWaitingCount: number;
  attentionPropertyCount: number;
  posture: string;
  topPattern: string;
  nextBestAction: string;
  properties: OpsWatchCommodorePropertySignal[];
}

export interface OpsWatchCommodorePattern {
  patternKey: string;
  title: string;
  recordCount: number;
  propertyCount: number;
  regionCount: number;
  severity: string;
  escalationPath: string;
  recommendedAction: string;
  affectedRegions: string[];
}

export interface OpsWatchCommodoreEscalation {
  escalationKey: string;
  title: string;
  regionName: string;
  severity: string;
  escalationPath: string;
  affectedPropertyCount: number;
  recommendedAction: string;
  captainHrefs: string[];
}

export interface OpsWatchCommodoreBridgeSnapshot {
  summary: {
    regionCount: number;
    activePropertyCount: number;
    signaledPropertyCount: number;
    activeTicketCount: number;
    criticalCount: number;
    stale14DayCount: number;
    pendingVendorCount: number;
    proofNeededCount: number;
    customerWaitingCount: number;
    escalationCount: number;
    crossRegionPatternCount: number;
    activeCommodoreCount: number;
  };
  regions: OpsWatchCommodoreRegion[];
  patterns: OpsWatchCommodorePattern[];
  escalations: OpsWatchCommodoreEscalation[];
  roster: {
    version: string;
    authority: string;
    status: string;
    cadence: string;
  };
  operatingModel: {
    role: string;
    owns: string;
    boundary: string;
    actionMode: string;
  };
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
  ticketCare: OpsWatchTicketCareSnapshot;
  commodoreBridge: OpsWatchCommodoreBridgeSnapshot;
  sourcePackets: OpsWatchSourcePacketRef[];
  governance: {
    mutationPolicy: string;
    publishPolicy: string;
    actionMode: string;
  };
}
