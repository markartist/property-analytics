"use client";

import { IntelligenceOfficePage } from "@/components/intelligence-office-page";
import { useAuth } from "@/components/auth-provider";
import { canPerformOfferingAction } from "@/lib/permissions";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";

export default function AdminIntelligencePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!canPerformOfferingAction(user?.role, "intelligenceOffice", "view")) {
    return (
      <RestrictedSurfaceCard
        title="Intelligence Office is steward-only"
        description="This surface governs directives, evidence, claims, and steward-owned narrative context. General operators should work from governed report and execution surfaces instead of editing the office directly."
      />
    );
  }

  return <IntelligenceOfficePage />;
}
