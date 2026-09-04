"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  FileText,
  Lightbulb,
  Mail,
  MessageCircle,
  MessageSquare,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getGbpPostQueue, getGbpPostSuggestions, type GbpDraftQueueItem, type GbpPostSuggestion } from "@/lib/api";
import { canPerformOfferingAction, getRoleTitle } from "@/lib/permissions";

type LaneStatus = "active" | "draft_handoff" | "planned";

type ContentLane = {
  id: string;
  title: string;
  status: LaneStatus;
  icon: React.ElementType;
  owner: string;
  output: string;
  next: string;
  href?: string;
};

const CONTENT_LANES: ContentLane[] = [
  {
    id: "gbp",
    title: "GBP Posts",
    status: "active",
    icon: MessageSquare,
    owner: "Search & Local",
    output: "Captain-aware Google Business Profile drafts and proof",
    next: "Plug direct GBP API publishing into the proof ledger",
    href: "/gbp-posts",
  },
  {
    id: "social",
    title: "Social Drafts",
    status: "draft_handoff",
    icon: RadioTower,
    owner: "Content Office",
    output: "Facebook and Instagram copy packages",
    next: "Start as approved handoff, then integrate Meta",
  },
  {
    id: "email",
    title: "Email Snippets",
    status: "draft_handoff",
    icon: Mail,
    owner: "Content Office",
    output: "Leasing and campaign-ready copy blocks",
    next: "Reuse Captain angles with approval notes",
  },
  {
    id: "short_video",
    title: "Short Video",
    status: "planned",
    icon: Video,
    owner: "Content Office",
    output: "TikTok/Reels briefs and shot prompts",
    next: "Hold for content standards and human production",
  },
  {
    id: "community",
    title: "Community Listening",
    status: "planned",
    icon: MessageCircle,
    owner: "Navigator",
    output: "Yelp, Reddit, and local conversation notes",
    next: "Treat as signal intake before posting",
  },
];

function statusLabel(status: LaneStatus): string {
  if (status === "active") return "Active";
  if (status === "draft_handoff") return "Draft handoff";
  return "Planned";
}

function statusClasses(status: LaneStatus): string {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "draft_handoff") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function countByStatus(queue: GbpDraftQueueItem[], status: GbpDraftQueueItem["status"]): number {
  return queue.filter((item) => item.status === status).length;
}

function newestDraftDate(queue: GbpDraftQueueItem[]): string {
  const newest = queue
    .map((item) => item.created_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (!newest) return "No draft history";
  return new Date(newest).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function topProperties(queue: GbpDraftQueueItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of queue) {
    counts.set(item.community_name, (counts.get(item.community_name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 4);
}

export default function ContentOfficePage() {
  const { user, loading: authLoading } = useAuth();
  const [queue, setQueue] = React.useState<GbpDraftQueueItem[]>([]);
  const [suggestions, setSuggestions] = React.useState<GbpPostSuggestion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const canView = canPerformOfferingAction(user?.role, "contentOffice", "view");

  React.useEffect(() => {
    if (authLoading || !canView) return;
    Promise.all([getGbpPostQueue(), getGbpPostSuggestions({ limit: 6 })])
      .then(([items, suggestionItems]) => {
        setQueue(items);
        setSuggestions(suggestionItems);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Content Office"))
      .finally(() => setLoading(false));
  }, [authLoading, canView]);

  if (authLoading) return null;

  if (!canView) {
    return (
      <RestrictedSurfaceCard
        title="Legacy Content Office is steward-only"
        description="The active content editing workspace is AI Content Suite inside the Pond."
      />
    );
  }

  const draftCount = countByStatus(queue, "draft");
  const approvedCount = countByStatus(queue, "approved");
  const publishedCount = countByStatus(queue, "published");
  const failedCount = countByStatus(queue, "failed");
  const reviewReady = draftCount + approvedCount;
  const properties = topProperties(queue);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8 md:px-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-emerald-700">
            <BriefcaseBusiness className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.22em]">{getRoleTitle(user?.role ?? "viewer")} legacy lane</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Legacy Content Office</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Retained for older channel queues. Live page mapping and content editing now belong in AI Content Suite.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">{reviewReady} ready for review</Badge>
          <Badge variant="outline">{publishedCount} published</Badge>
          <Badge variant="outline">GBP first</Badge>
        </div>
      </div>

      <Card className="border-[#7DCAC2]/50 bg-[#7DCAC2]/10">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#15284B]">Use AI Content Suite for current content work</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              The active workspace maps live property pages and lets curators edit section copy directly in the Pond.
            </p>
          </div>
          <Link
            href="/site-content"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#15284B] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#294782]"
          >
            Open AI Content Suite
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-4 text-sm text-rose-800">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={FileText} label="GBP drafts" value={String(draftCount)} />
        <MetricTile icon={BadgeCheck} label="Approved" value={String(approvedCount)} />
        <MetricTile icon={ShieldCheck} label="Published proof" value={String(publishedCount)} />
        <MetricTile icon={Clock3} label="Latest draft" value={loading ? "Loading" : newestDraftDate(queue)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Work Today</p>
                <p className="mt-1 text-sm text-slate-600">GBP remains the production lane while the office grows around it.</p>
              </div>
              <Link
                href="/gbp-posts"
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#15284B] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(21,40,75,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#0f1e39] hover:shadow-[0_14px_28px_rgba(21,40,75,0.24)]"
              >
                Open GBP Posts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              <WorkRow
                icon={MessageSquare}
                title="Review GBP queue"
                detail={`${draftCount} draft${draftCount === 1 ? "" : "s"} waiting, ${approvedCount} approved, ${publishedCount} published`}
                badge="Human approval"
              />
              <WorkRow
                icon={Sparkles}
                title="Use Captain angles"
                detail="Availability, concessions, reputation, amenities, and local search posture can now feed GBP draft context"
                badge="Live context"
              />
              <WorkRow
                icon={ShieldCheck}
                title="Record posting proof"
                detail={`${failedCount} failed proof item${failedCount === 1 ? "" : "s"} currently need follow-up`}
                badge="Proof ledger"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Property Pressure</p>
                <p className="mt-1 text-sm text-slate-600">Draft volume by property from the existing GBP workflow.</p>
              </div>
              <Badge variant="outline">{queue.length} total</Badge>
            </div>
            <div className="mt-5 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading queue...</p>
              ) : properties.length ? (
                properties.map((property) => (
                  <div key={property.name} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                    <span className="text-sm font-medium text-slate-800">{property.name}</span>
                    <Badge variant="secondary">{property.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No GBP drafts have been created yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Suggested GBP Posts</p>
              <p className="mt-1 text-sm text-slate-600">Captain and Data Pond signals translated into ready-to-prepare GBP opportunities.</p>
            </div>
            <Badge variant="outline">{suggestions.length} suggestions</Badge>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {suggestions.length ? (
              suggestions.slice(0, 6).map((suggestion) => (
                <Link key={suggestion.id} href="/gbp-posts" className="block rounded-md border border-emerald-200 bg-emerald-50 p-4 transition hover:border-emerald-300 hover:bg-emerald-100/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-emerald-200 bg-white text-emerald-800">Priority {suggestion.priority}</Badge>
                    <Badge variant="outline">{suggestion.angle}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-emerald-950">{suggestion.community_name}</p>
                  <p className="mt-1 line-clamp-3 text-sm leading-6 text-emerald-900">{suggestion.reason}</p>
                  {suggestion.source_evidence[0] && <p className="mt-3 text-xs text-emerald-700">{suggestion.source_evidence[0]}</p>}
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">No Captain-backed GBP suggestions are available yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Channel Lanes</p>
              <p className="mt-1 text-sm text-slate-600">One operating pattern, many eventual outputs.</p>
            </div>
            <Badge variant="outline">Crawl stage</Badge>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-5">
            {CONTENT_LANES.map((lane) => (
              <LaneTile key={lane.id} lane={lane} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <PrincipleTile title="Ground First" body="Every draft starts with governed property context, not a blank prompt." />
        <PrincipleTile title="Approve Before Publish" body="Human approval stays default until a channel proves it can publish safely." />
        <PrincipleTile title="Proof Comes Back" body="Published outputs need IDs, URLs, timestamps, source evidence, and performance learning." />
      </div>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="truncate text-lg font-semibold text-slate-950">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkRow({
  icon: Icon,
  title,
  detail,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  detail: string;
  badge: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <Badge variant="outline">{badge}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600">{detail}</p>
      </div>
    </div>
  );
}

function LaneTile({ lane }: { lane: ContentLane }) {
  const Icon = lane.icon;
  const content = (
    <div className="flex h-full flex-col rounded-md border border-slate-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/35">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
        <Badge className={statusClasses(lane.status)}>{statusLabel(lane.status)}</Badge>
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-950">{lane.title}</p>
      <p className="mt-1 text-sm text-slate-600">{lane.output}</p>
      <div className="mt-4 space-y-2 text-xs text-slate-500">
        <p>
          <span className="font-semibold text-slate-700">Owner:</span> {lane.owner}
        </p>
        <p>
          <span className="font-semibold text-slate-700">Next:</span> {lane.next}
        </p>
      </div>
    </div>
  );

  if (lane.href) {
    return (
      <Link href={lane.href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}

function PrincipleTile({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-emerald-700">
          <Lightbulb className="h-4 w-4" />
          <p className="text-sm font-semibold text-slate-950">{title}</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
      </CardContent>
    </Card>
  );
}
