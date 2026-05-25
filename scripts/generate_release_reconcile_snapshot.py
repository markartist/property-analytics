#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from collections import defaultdict
from datetime import date
from pathlib import Path


ROOT = Path("/Users/mark/Property_Analytics")
OUTPUT_PATH = ROOT / "config" / "release_reconcile_snapshot.json"

LANE_RULES = [
    (
        "apartmentiq_market_intelligence",
        [
            "Data_Collection/collectors/apartmentiq_collector.py",
            "Data_Collection/config/apartmentiq.yaml",
            "apps/api/migrations/0055_create_apartmentiq_tables.sql",
            "infra/migrations/034_create_apartmentiq_tables.sql",
            "docs/APARTMENTIQ_API_SOURCE_CONTRACT_2026-05-22.md",
            "run_apartmentiq_",
            "scripts/generate_apartmentiq_",
            "utils/apartmentiq_auth.py",
        ],
    ),
    (
        "edge_messages_experimentation",
        [
            "apps/api/migrations/0039_create_edge_experimentation_tables.sql",
            "infra/migrations/026_create_edge_experimentation_tables.sql",
            "apps/api/src/routes/experiments.ts",
            "apps/web/src/app/experiments/",
            "apps/web/public/edge-message-apartments-preview.png",
            "ops/cloudflare/edge-transparent-pricing-intro/",
            "docs/EDGE_EXPERIMENTATION_",
            "docs/EXPERIMENT_LAB_ADMIN_UI_SPEC_2026-05-02.md",
            "docs/EDGE_MESSAGE_TOOLKIT_2026-05-23.md",
            "packages/shared/src/experiment-",
        ],
    ),
    (
        "captain_governance_runtime",
        [
            "apps/api/migrations/0026_create_captain_support_agents.sql",
            "apps/api/migrations/0027_create_captain_runtime_tables.sql",
            "apps/api/migrations/0047_create_directive_control_center.sql",
            "apps/api/migrations/0048_create_captain_runtime_orchestration.sql",
            "apps/api/migrations/0049_create_expert_reads.sql",
            "apps/api/migrations/0050_create_property_access_control.sql",
            "apps/api/migrations/0051_create_awareness_network.sql",
            "infra/migrations/013_create_captain_support_agents.sql",
            "infra/migrations/014_create_captain_runtime_tables.sql",
            "infra/migrations/0034_create_directive_control_center.sql",
            "infra/migrations/0035_create_captain_runtime_orchestration.sql",
            "infra/migrations/0036_create_expert_reads.sql",
            "infra/migrations/0037_create_property_access_control.sql",
            "infra/migrations/0038_create_awareness_network.sql",
            "apps/api/src/platform/access/",
            "apps/api/src/platform/awareness/",
            "apps/api/src/platform/captain",
            "apps/api/src/platform/directives/",
            "apps/api/src/platform/expert-reads/",
            "apps/api/src/routes/awareness.ts",
            "apps/api/src/routes/captain",
            "apps/api/src/routes/directives.ts",
            "apps/api/src/routes/expert-reads.ts",
            "apps/web/src/app/admin/directives/",
            "apps/web/src/app/analysis/captain/",
            "apps/web/src/app/captains/",
            "reports/captains_log/",
            "scripts/audit_captain",
            "scripts/audit_fleet_scribe",
            "scripts/captain_fleet_support.py",
            "scripts/generate_captain_runtime_catchup_plan.py",
            "scripts/run_captain_runtime_catchup.py",
            "scripts/seed_directive_control_center.sh",
            "scripts/standup_captain_roster.py",
            "docs/CAPTAIN",
            "docs/CAPTAINS",
            "docs/DIRECTIVE_CONTROL_CENTER",
            "docs/EXPERT_READS",
            "docs/FLEET_SCRIBE",
            "docs/FLAGSHIP",
            "docs/PORTFOLIO_CAPTAIN",
            "docs/PROPERTY_ACCESS_CONTROL",
            "docs/WATCHLIST",
        ],
    ),
    (
        "model_gateway",
        [
            "apps/api/migrations/0052_create_model_provider_gateway.sql",
            "infra/migrations/0039_create_model_provider_gateway.sql",
            "apps/api/src/platform/model-gateway/",
            "apps/api/scripts/check_cloudflare_shadow_config.ts",
            "apps/api/scripts/run_model_gateway_shadow_evaluation.ts",
            "apps/api/scripts/smoke_cloudflare_shadow_model_gateway.ts",
            "apps/api/test/platform/model-provider-gateway.test.ts",
            "docs/MODEL_PROVIDER_GATEWAY",
        ],
    ),
    (
        "property_identity_and_source_contracts",
        [
            "Data_Collection/utils/property_identity.py",
            "Data_Collection/utils/property_regions_ingest.py",
            "apps/api/migrations/0023_seed_phase1_platform_control_plane.sql",
            "apps/api/migrations/0025_thirtylines_unit_feed_snapshots.sql",
            "apps/api/migrations/0028_create_property_operating_metrics.sql",
            "apps/api/migrations/0029_create_available_unit_interest_metrics.sql",
            "apps/api/migrations/0030_create_marketing_bi_conversion_sources.sql",
            "apps/api/migrations/0031_create_marketing_bi_daily_packets.sql",
            "apps/api/migrations/0032_create_dataforseo_serp_tables.sql",
            "apps/api/migrations/0033_create_dataforseo_enrichment_tables.sql",
            "apps/api/migrations/0034_create_marketing_bi_conversion_summary.sql",
            "apps/api/migrations/0035_create_marketing_bi_excel_exports.sql",
            "apps/api/migrations/0036_create_marketing_bi_conversion_dashboard.sql",
            "apps/api/migrations/0037_create_marketing_bi_recovery_sources.sql",
            "apps/api/migrations/0038_create_marketing_bi_cost_per_conversion.sql",
            "apps/api/migrations/0040_create_reputation_com_tables.sql",
            "apps/api/migrations/0041_create_marketing_ops_summary.sql",
            "apps/api/migrations/0042_create_spotlight_weekly_field_notes.sql",
            "apps/api/migrations/0043_create_competitor_market_research.sql",
            "apps/api/migrations/0044_create_aptiq_watchlist_summaries.sql",
            "apps/api/migrations/0045_create_marketing_bi_source_performance.sql",
            "apps/api/migrations/0046_create_marketing_bi_gap_fill_tables.sql",
            "infra/migrations/015_create_property_operating_metrics.sql",
            "infra/migrations/016_create_available_unit_interest_metrics.sql",
            "infra/migrations/017_create_marketing_bi_conversion_sources.sql",
            "infra/migrations/018_create_marketing_bi_daily_packets.sql",
            "infra/migrations/019_create_dataforseo_serp_tables.sql",
            "infra/migrations/020_create_dataforseo_enrichment_tables.sql",
            "infra/migrations/021_create_marketing_bi_conversion_summary.sql",
            "infra/migrations/022_create_marketing_bi_excel_exports.sql",
            "infra/migrations/023_create_marketing_bi_conversion_dashboard.sql",
            "infra/migrations/024_create_marketing_bi_recovery_sources.sql",
            "infra/migrations/025_create_marketing_bi_cost_per_conversion.sql",
            "infra/migrations/027_create_reputation_com_tables.sql",
            "infra/migrations/028_create_marketing_ops_summary.sql",
            "infra/migrations/029_create_spotlight_weekly_field_notes.sql",
            "infra/migrations/030_create_competitor_market_research.sql",
            "infra/migrations/031_create_aptiq_watchlist_summaries.sql",
            "infra/migrations/032_create_marketing_bi_source_performance.sql",
            "infra/migrations/033_create_marketing_bi_gap_fill_tables.sql",
            "infra/migrations/012_thirtylines_unit_feed_snapshots.sql",
            "scripts/backfill_selected_gsc_window.py",
            "scripts/build_property_identity_matrix.py",
            "scripts/check_dataforseo_auth.py",
            "scripts/check_property_identity",
            "scripts/enrich_property_locations.py",
            "scripts/generate_keyword_deep_dive.py",
            "scripts/generate_portfolio_organic_new_users_weekly_export.py",
            "scripts/generate_portfolio_site_audit.py",
            "scripts/operating_metrics_brief_intake.py",
            "scripts/refresh_remote_communities_snapshot.py",
            "scripts/run_dataforseo_spotlight_deep_trial.py",
            "scripts/send_seo_t30_property_brief.py",
            "scripts/site_audit/",
            "utils/dataforseo_auth.py",
            "Data_Collection/utils/aptiq_watchlist_summary_ingest.py",
            "Data_Collection/utils/available_unit_interest_ingest.py",
            "Data_Collection/utils/bi_manual_ingest.py",
            "Data_Collection/utils/build_competitor_market_packets.py",
            "Data_Collection/utils/competitor_market_research_ingest.py",
            "Data_Collection/utils/dataforseo_serp_ingest.py",
            "Data_Collection/utils/marketing_",
            "Data_Collection/utils/operating_metrics_ingest.py",
            "Data_Collection/utils/reputation_com_ingest.py",
            "Data_Collection/utils/spotlight_weekly_field_notes_ingest.py",
            "docs/APTIQ_WATCHLIST_SUMMARY_SOURCE_CONTRACT_2026-05-05.md",
            "docs/AVAILABLE_UNIT_INTEREST_SOURCE_CONTRACT_2026-04-27.md",
            "docs/COMPETITOR_MARKET_RESEARCH_SOURCE_CONTRACT_2026-05-05.md",
            "docs/DATAFORSEO_SERP_SOURCE_CONTRACT_2026-04-28.md",
            "docs/MARKETING_BI_",
            "docs/MARKETING_OPERATIONS_CHARTER_2026-05-04.md",
            "docs/MARKETING_OPS_SUMMARY_SOURCE_CONTRACT_2026-05-04.md",
            "docs/MULTIFAMILY_SEO_LOCAL_CONTENT_ACTION_STANDARD_2026-05-07.md",
            "docs/PROPERTY_IDENTITY_MATRIX_2026-04-28.md",
            "docs/PROPERTY_OPERATING_METRICS_SOURCE_CONTRACT_2026-04-27.md",
            "docs/PROPERTY_REGIONS_SOURCE_CONTRACT_2026-05-04.md",
            "docs/SPOTLIGHT_WEEKLY_FIELD_NOTES_SOURCE_CONTRACT_2026-05-04.md",
        ],
    ),
    (
        "cloudflare_ops",
        [
            "Data_Collection/collectors/cloudflare_cache_audit.py",
            "Data_Collection/collectors/cloudflare_analytics_collector.py",
            "apps/api/migrations/0054_create_cloudflare_edge_daily_metrics.sql",
            "infra/migrations/0040_create_cloudflare_edge_daily_metrics.sql",
            "apps/api/scripts/wrangler_auth.py",
            "config/cloudflare_",
            "ops/cloudflare/",
            "scripts/bootstrap_cloudflare.sh",
            "scripts/smoke_cloudflare_analytics.py",
            "scripts/zero_trust_worker_secret_cutover.sh",
            "docs/CLOUDFLARE_EDGE_DELIVERY_ANALYTICS_SOURCE_CONTRACT_2026-05-14.md",
        ],
    ),
    (
        "pib_pop_brief_reporting",
        [
            "POP_Brief/",
            "apps/api/migrations/0024_create_property_brief_grounding_tables.sql",
            "infra/migrations/011_property_brief_grounding.sql",
            "apps/api/scripts/pib_data_to_d1.py",
            "apps/web/src/app/analysis/pib/page.tsx",
            "apps/web/src/app/pib/page.tsx",
            "apps/web/src/lib/pop-brief-nav.ts",
            "docs/PIB_",
            "docs/POP_BRIEF",
            "scripts/generate_keyword_deep_dive_pib.py",
            "scripts/generate_portfolio_psi_pib_report.py",
            "scripts/send_pib_roundup_email.py",
        ],
    ),
    (
        "copy_change_and_content_watch",
        [
            "Data_Collection/utils/copy_change_monitoring.py",
            "apps/api/migrations/0019_create_gbp_post_workflow.sql",
            "apps/api/src/routes/gbp-posts.ts",
            "apps/web/src/app/content-office/",
            "apps/web/src/app/gbp-posts/",
            "scripts/monitor_monteverde_website_watch.py",
            "scripts/register_copy_change_intervention.py",
            "scripts/send_copy_change_impact_brief.py",
            "docs/COPY_CHANGE_MONITORING_SOURCE_CONTRACT_2026-05-18.md",
            "docs/CONTENT_OPERATIONS_MODEL.md",
            "docs/PROPERTY_NARRATIVE_CANON_V1_2026-05-17.md",
            "docs/SITE_CHANGE_CAPTAIN_HANDOFF_STANDARD_2026-05-20.md",
            "docs/WEBSITE_CHANGE_WATCH_MONTEVERDE_2026-05-13.md",
            "Venterra_AI_Content_Suite/",
        ],
    ),
    (
        "platform_app",
        [
            ".gitignore",
            "apps/api/package.json",
            "apps/api/src/index.ts",
            "apps/api/src/platform/agent-runtime/",
            "apps/api/src/platform/lifecycle/",
            "apps/api/src/routes/pond.ts",
            "apps/api/src/routes/admin.ts",
            "apps/api/src/routes/exports.ts",
            "apps/api/src/routes/marketing-data.ts",
            "apps/api/src/routes/metrics.ts",
            "apps/api/src/lib/",
            "apps/api/test/",
            "apps/api/scripts/platform_phase1_client.py",
            "apps/api/scripts/verify_phase1_platform_cutover.sh",
            "apps/web/src/app/watchtower/",
            "apps/web/src/app/system/",
            "apps/web/src/app/page.tsx",
            "apps/web/src/app/dock/",
            "apps/web/src/components/shared/",
            "apps/web/src/lib/api.ts",
            "apps/web/src/lib/permissions.ts",
            "apps/api/src/lib/permissions.ts",
            "apps/api/src/routes/health.ts",
            "apps/api/src/routes/auth.ts",
            "apps/api/src/routes/platform.ts",
            "apps/api/src/env.ts",
            "apps/api/wrangler.toml",
            "apps/web/.env.production",
            "apps/web/package.json",
            "apps/web/src/app/admin/users/",
            "apps/web/src/app/analysis/",
            "apps/web/src/app/backup/",
            "apps/web/src/app/communities/",
            "apps/web/src/app/fish/",
            "apps/web/src/app/gsc/",
            "apps/web/src/app/layout.tsx",
            "apps/web/src/app/globals.css",
            "apps/web/src/app/marketing/",
            "apps/web/src/app/metrics-import/",
            "apps/web/src/app/pond/",
            "apps/web/src/components/app-shell.tsx",
            "apps/web/src/components/metrics/",
            "apps/web/src/components/ui/",
            "apps/web/src/lib/spotlight-properties.ts",
            "packages/shared/",
        ],
    ),
    (
        "data_collection_hardening",
        [
            "Data_Collection/",
            "generate_morning_full_report.py",
            "send_morning_full_report.py",
            "send_daily_health_report.py",
            "send_weekly_progress_report.py",
            "run_daily_health_report.sh",
            "run_collection_retry_cycle.sh",
            "apps/api/scripts/captain_sources_to_d1.py",
            "apps/api/scripts/dataforseo_captain_to_d1.py",
            "apps/api/scripts/d1_mirror_sync.py",
            "apps/api/scripts/gsc_daily_to_d1.py",
            "apps/api/scripts/guest_cards_to_d1.py",
            "apps/api/scripts/marketing_data_to_d1.py",
            "apps/api/scripts/operating_metrics_to_d1.py",
            "utils/config_manager.py",
            "utils/data_quality_validator.py",
            "utils/email_sender.py",
            "utils/google_ads_ksm.py",
            "utils/keeper_file_materializer.py",
            "utils/ksm.py",
            "utils/report_builder.py",
            "utils/specialty_email_policy.py",
            "utils/summary_email_guard.py",
            "scripts/export_psi_lifetime_report.py",
            "scripts/verify_morning_delivery.py",
        ],
    ),
    (
        "content_operations",
        [
            "apps/web/src/app/site-content/",
            "apps/web/src/components/site-content-creator-page.tsx",
            "apps/web/src/app/intelligence-office/",
            "apps/web/src/app/admin/intelligence/",
            "apps/web/src/app/analysis/search-intelligence/",
            "apps/web/src/app/vacs/",
            "apps/api/src/routes/admin-site-content.ts",
            "apps/api/src/routes/admin-intelligence.ts",
            "apps/api/src/routes/search-intelligence.ts",
            "apps/api/src/routes/intelligence-memory.ts",
            "apps/api/src/routes/vacs.ts",
            "apps/api/src/platform/intelligence/",
            "apps/api/src/platform/shared/specs-property-marketing-v1.ts",
            "docs/INTELLIGENCE_OFFICE_MODEL.md",
            "docs/SITE_CONTENT_CREATOR_MODEL.md",
            "docs/SEARCH_INTELLIGENCE_REPORT_V1_0_0.md",
        ],
    ),
    (
        "zero_trust_sso",
        [
            "docs/CLOUDFLARE_ZERO_TRUST_",
            "docs/KSM_",
            "docs/ENTRA_CLOUDFLARE_SSO_BLUEPRINT_2026-04-14.md",
            "scripts/zero_trust_",
            "scripts/bootstrap_cloudflare.sh",
            "apps/api/src/middleware/auth.ts",
            "apps/web/src/components/auth-provider.tsx",
            "apps/web/src/app/login/",
        ],
    ),
    (
        "evs_browserstack",
        [
            "apps/api/migrations/0020_create_evs_tables.sql",
            "apps/api/migrations/0053_create_evs_batch_result_tables.sql",
            "apps/web/src/app/evs/",
            "apps/api/src/routes/evs.ts",
            "apps/api/src/evs/",
            "ops/browserstack/",
            "evs/",
        ],
    ),
    (
        "pilot_reporting",
        [
            "pilot_control_cwv/",
            "pilot_roundup/",
            "apps/web/src/app/tracker/",
            "apps/web/src/components/tracker/",
            "apps/web/src/lib/pilot-kpi.ts",
            "apps/pilot-tracker-standalone/",
            "ops/pilot_roundup/",
            "ops/gtmetrix/",
            "run_pilot_",
            "scripts/export_evs_lead_attribution_truth.py",
            "scripts/export_evs_pond_availability.py",
            "scripts/export_evs_property_contact_truth.py",
            "scripts/import_portfolio_qa_contract.py",
            "scripts/import_round1_qa_batch.py",
            "scripts/generate_pilot_",
            "scripts/generate_sightmap_pilot_roundup.py",
            "scripts/send_pilot_",
            "scripts/send_selected_cwv_t30_report.py",
            "scripts/send_lease_up_vs_pilot_performance_brief.py",
            "run_spotlight_performance_roundup_daily.sh",
        ],
    ),
    (
        "paid_media_workbook",
        [
            "paid_media_workbook/",
        ],
    ),
    (
        "qa_and_local_scratch",
        [
            "tmp/",
            "tools/",
            "focus_report/config/",
            "freedom-in-christ-class/",
            "SESSION_MEMORY_2026-04-08_PILOT_SITE_EVIDENCE_AND_HARMONIZATION.md",
            ".github/workflows/evs-browserstack-experiential.yml",
        ],
    ),
]


def git_changed_files() -> list[str]:
    result = subprocess.run(
        ["git", "status", "--short"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    files: list[str] = []
    for raw_line in result.stdout.splitlines():
      if not raw_line.strip():
        continue
      parts = raw_line.split(maxsplit=1)
      if len(parts) < 2:
        continue
      path = parts[1].strip()
      if " -> " in path:
        path = path.split(" -> ", 1)[1]
      files.append(path)
    return files


def classify(path: str) -> str:
    if path in {
        "apps/web/.env.production",
        ".env.production",
        "Project_Memory.md",
        "memory/MEMORY_INDEX.md",
        "memory/PROJECT_STATE.md",
        ".nvmrc",
    }:
      return "risky_local"
    for lane, prefixes in LANE_RULES:
      for prefix in prefixes:
        if path.startswith(prefix):
          return lane
    if (
        path.startswith("docs/")
        or path in {
            "AGENTS.md",
            "ATLAS_QUICK_START.md",
            "ATLAS_WORKING_MEMORY.md",
            "DATA_COLLECTION_README.md",
            "Project_Memory.md",
            "README.md",
            "README_old.md",
            "atlas_session_start.sh",
            "config/release_reconcile_snapshot.json",
            ".github/workflows/context-discipline.yml",
            "scripts/check_context_discipline.sh",
            "scripts/check_env.md",
            "scripts/check_captains_brief_header_lock.sh",
            "scripts/check_pib_guardrails.sh",
            "scripts/generate_release_reconcile_snapshot.py",
            "scripts/install_git_hooks.sh",
            "scripts/update_release_provenance.py",
            "apps/api/migrations/0022_create_governed_memory_tables.sql",
            }
    ):
      return "docs_and_memory"
    return "unclassified"


def main() -> int:
    changed = git_changed_files()
    grouped: dict[str, list[str]] = defaultdict(list)
    for path in changed:
      grouped[classify(path)].append(path)

    recommended_primary_slice = [
      "platform_app",
      "data_collection_hardening",
      "docs_and_memory",
    ]
    primary_count = sum(len(grouped.get(lane, [])) for lane in recommended_primary_slice)
    total_count = len(changed)

    data = {
      "version": "2026-05-25.release-reconcile-snapshot.v2",
      "updated_at": str(date.today()),
      "purpose": "Current dirty-tree release reconciliation snapshot grouped by canonical workstream lane.",
      "working_tree": {
        "changed_file_count": total_count,
        "primary_release_slice_count": primary_count,
        "non_primary_count": max(0, total_count - primary_count),
      },
      "recommended_release_candidate": {
        "label": "platform_app + data_collection_hardening",
        "canonical_branch": "codex/release-reconcile",
        "included_lanes": recommended_primary_slice,
        "exclude_lanes": [
          "apartmentiq_market_intelligence",
          "captain_governance_runtime",
          "cloudflare_ops",
          "content_operations",
          "copy_change_and_content_watch",
          "edge_messages_experimentation",
          "zero_trust_sso",
          "evs_browserstack",
          "model_gateway",
          "pib_pop_brief_reporting",
          "pilot_reporting",
          "property_identity_and_source_contracts",
          "qa_and_local_scratch",
          "risky_local",
          "unclassified",
        ],
        "readiness_note": "The first clean enterprise release slice should converge on platform/app plus data-collection hardening, with the other lanes explicitly separated.",
      },
      "lane_counts": {
        lane: len(paths)
        for lane, paths in sorted(grouped.items())
      },
      "lane_examples": {
        lane: paths[:8]
        for lane, paths in sorted(grouped.items())
      },
    }

    OUTPUT_PATH.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Updated {OUTPUT_PATH}")
    print(f"changed_file_count={total_count}")
    print(f"primary_release_slice_count={primary_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
