"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";
import { apiFetch } from "@/lib/api";
import { canPerformOfferingAction } from "@/lib/permissions";

type DirectiveProfile = {
  role_id: string;
  role_name: string;
  office_type: string;
  plain_role: string;
  purpose: string;
  decision_questions: string[];
  primary_sources: string[];
  advisory_sources: string[];
  output_contract: string;
  current_directive_setting: string;
  hard_guardrails: string[];
  do_not_allow_rules: string[];
  required_evidence: string[];
  escalation_triggers: string[];
  publication_permissions: Record<string, unknown>;
  external_communication_permissions: Record<string, unknown>;
  report_family_applicability: string[];
  owner: string;
  version: number;
  approval_status: string;
};

type ProfileEnvelope = {
  profile: {
    role_id: string;
    role_name: string;
    office_type: string;
    active_status: string;
    owner: string;
  };
  active_directive: DirectiveProfile | null;
};

function ListField({ title, values }: { title: string; values: string[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
        {values.map((value) => (
          <li key={value} className="border-l-2 border-slate-200 pl-3">
            {value}
          </li>
        ))}
      </ul>
    </section>
  );
}

function JsonField({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      <dl className="mt-3 grid gap-2 text-sm text-slate-800">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="grid grid-cols-[220px_1fr] gap-3">
            <dt className="font-semibold">{key}</dt>
            <dd>{Array.isArray(item) ? item.join(", ") : String(item)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function DirectiveControlCenterPage() {
  const { user, loading } = useAuth();
  const [profiles, setProfiles] = useState<ProfileEnvelope[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState("Loading directives...");

  useEffect(() => {
    if (!user || !canPerformOfferingAction(user.role, "directiveControlCenter", "view")) return;
    apiFetch("/v1/directives/profiles")
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((json) => {
        const nextProfiles = json.profiles ?? [];
        setProfiles(nextProfiles);
        setSelectedRoleId(nextProfiles[0]?.profile?.role_id ?? "");
        setStatus(`${nextProfiles.length} directive profiles loaded.`);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }, [user]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter(({ profile, active_directive }) =>
      [profile.role_id, profile.role_name, profile.office_type, profile.active_status, active_directive?.owner]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [filter, profiles]);

  const selected = profiles.find(({ profile }) => profile.role_id === selectedRoleId)?.active_directive ?? null;

  if (loading) return null;
  if (!canPerformOfferingAction(user?.role, "directiveControlCenter", "view")) {
    return (
      <RestrictedSurfaceCard
        title="Directive Control Center is steward-only"
        description="This surface governs operational policy data for Captains, Commodores, Fleet, Expert Bench lanes, and Fleet Scribe publication controls."
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-8 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-700">Directive Control Center</p>
          <h1 className="mt-2 text-4xl font-bold">Governed Role Directives</h1>
          <p className="mt-3 max-w-4xl text-lg leading-8 text-slate-600">
            View active policy data for each office and bench lane. Draft editing, validation, approval, activation, rollback,
            runtime snapshots, and simulation are exposed through structured API controls rather than loose prompt editing.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Search / Filter</label>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Office, role, status, owner"
            />
            <p className="mt-3 text-sm text-slate-500">{status}</p>
            <div className="mt-4 max-h-[70vh] space-y-2 overflow-auto">
              {filtered.map(({ profile, active_directive }) => (
                <button
                  key={profile.role_id}
                  onClick={() => setSelectedRoleId(profile.role_id)}
                  className={`w-full rounded-md border p-3 text-left ${
                    selectedRoleId === profile.role_id ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="font-bold">{profile.role_name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                    {profile.office_type} · v{active_directive?.version ?? "-"} · {profile.active_status}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {selected ? (
            <section className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Identity</p>
                <h2 className="mt-2 text-3xl font-bold">{selected.role_name}</h2>
                <p className="mt-2 text-slate-600">{selected.plain_role}</p>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                  <div><b>Role ID</b><br />{selected.role_id}</div>
                  <div><b>Office</b><br />{selected.office_type}</div>
                  <div><b>Owner</b><br />{selected.owner}</div>
                  <div><b>Status</b><br />v{selected.version} {selected.approval_status}</div>
                </div>
              </div>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Purpose</p>
                <p className="mt-2 text-lg leading-8 text-slate-800">{selected.purpose}</p>
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Output Contract</p>
                <p className="mt-2 leading-7 text-slate-800">{selected.output_contract}</p>
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Behavior Settings</p>
                <p className="mt-2 leading-7 text-slate-800">{selected.current_directive_setting}</p>
              </section>

              <div className="grid gap-5 xl:grid-cols-2">
                <ListField title="Decision Questions" values={selected.decision_questions} />
                <ListField title="Primary Sources" values={selected.primary_sources} />
                <ListField title="Advisory Sources" values={selected.advisory_sources} />
                <ListField title="Required Evidence" values={selected.required_evidence} />
                <ListField title="Guardrails" values={selected.hard_guardrails} />
                <ListField title="Do Not Allow" values={selected.do_not_allow_rules} />
                <ListField title="Escalations" values={selected.escalation_triggers} />
                <ListField title="Report Families" values={selected.report_family_applicability} />
                <JsonField title="Publication Permissions" value={selected.publication_permissions} />
                <JsonField title="External Communication Permissions" value={selected.external_communication_permissions} />
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-8">No directive selected.</section>
          )}
        </div>
      </div>
    </main>
  );
}
