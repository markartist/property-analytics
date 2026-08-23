export type SignalColor = "green" | "yellow" | "red" | "gray";

export type LaunchSignal = {
  color: SignalColor;
  label: string;
  detail: string;
};

export type PropertyLink = {
  label: string;
  url: string;
};

export type LaunchMetric = {
  label: string;
  value: string;
  helper: string;
  tone: SignalColor;
  percent: number;
};

export type LaunchStep = {
  number: number;
  title: string;
  status: LaunchSignal;
};

export type LaunchFact = {
  label: string;
  value: string;
  signal: LaunchSignal;
};

export type LaunchStageBar = {
  label: string;
  value: number;
  total: number;
  tone: SignalColor;
};

export type LaunchBreakdown = {
  label: string;
  value: number;
  tone: SignalColor;
};

export type LaunchTrendPoint = {
  label: string;
  value: number;
};

export type OrganicTrendSummary = {
  latestDate: string;
  t30Sessions: number;
  priorT30Sessions: number;
  t30Users: number;
  t30Conversions: number;
  sessionChangePercent: number | null;
  organicSharePercent: number | null;
  trend: LaunchTrendPoint[];
};

export type PsiTrendSummary = {
  latestDate: string;
  mobileScore: number | null;
  desktopScore: number | null;
  mobileLcp: number | null;
  desktopLcp: number | null;
  mobileCls: number | null;
  desktopCls: number | null;
  mobileTrend: LaunchTrendPoint[];
  desktopTrend: LaunchTrendPoint[];
};

export type PsiLaunchTarget = {
  label: string;
  url: string;
  status: "captured" | "held_until_switch" | "missing" | "failed";
  note: string;
  mobileScore: number | null;
  desktopScore: number | null;
  mobileLcp: number | null;
  desktopLcp: number | null;
  mobileCls: number | null;
  desktopCls: number | null;
  mobileTbt: number | null;
  desktopTbt: number | null;
  capturedAt: string;
};

export type LaunchProperty = {
  propertyCode: string;
  propertyName: string;
  market: string;
  units: number;
  launchDate: string;
  progressPercent: number;
  currentFocus: string;
  overall: LaunchSignal;
  currentUrl: PropertyLink;
  newUrl: PropertyLink;
  redirectPlan: string;
  metrics: LaunchMetric[];
  steps: LaunchStep[];
  facts: LaunchFact[];
  organic: OrganicTrendSummary;
  psi: PsiTrendSummary;
  psiLaunchTargets: PsiLaunchTarget[];
  domain: LaunchSignal;
  routing: LaunchSignal;
  indexing: LaunchSignal;
  analytics: LaunchSignal;
  performance: LaunchSignal;
  operations: LaunchSignal;
  historyNote: string;
  nextStep: string;
};

export type LaunchSnapshot = {
  generatedForDisplay: string;
  launchDate: string;
  targetHost: string;
  rollupMetrics: LaunchMetric[];
  stageBars: LaunchStageBar[];
  openItemBreakdown: LaunchBreakdown[];
  marketBreakdown: LaunchBreakdown[];
  summary: {
    totalProperties: number;
    totalHomes: number;
    averageProgress: number;
    readyToWatch: number;
    needsAttention: number;
    blocked: number;
    publicMovesCompleted: number;
    domainsControlled: number;
    stagingReachable: number;
    analyticsReady: number;
    performanceMeasured: number;
    detailsClosed: number;
    searchBaselinesCaptured: number;
    finalApprovals: number;
    organicT30Sessions: number;
    organicPriorT30Sessions: number;
    organicSessionChangePercent: number | null;
    organicSharePercent: number | null;
    organicLatestDate: string;
    psiHistoryProperties: number;
    psiMobileAverage: number | null;
    psiDesktopAverage: number | null;
    psiLatestDate: string;
    freshPsiMeasurementsOk: number;
    freshPsiMeasurementsFailed: number;
    freshPsiPropertiesCompleted: number;
    freshPsiLatestDate: string;
    finalVanityPsiStatus: string;
    vanityQaGreen: number;
    vanityQaYellow: number;
    vanityQaRed: number;
    vanityQaTotal: number;
    vanityQaRoot200: number;
    vanityQaHolds: number;
    vanityQaCanonical: number;
    vanityQaIndexable: number;
    vanityQaRobotsIndexable: number;
    vanityQaMobileSmokeOk: number;
    vanityQaCorePagesChecked: number;
    vanityQaCorePageIssues: number;
    vanityQaPropertiesWithCorePageIssues: number;
    vanityQaLatestDate: string;
    vanityQaEvidencePath: string | null;
    promoBannerStatus: string;
  };
  properties: LaunchProperty[];
};
