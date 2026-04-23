"use client";

import { SiteContentCreatorPage } from "@/components/site-content-creator-page";
import { useAuth } from "@/components/auth-provider";
import { canPerformOfferingAction } from "@/lib/permissions";
import { RestrictedSurfaceCard } from "@/components/shared/restricted-surface-card";

export default function SiteContentRoutePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!canPerformOfferingAction(user?.role, "siteContent", "view")) {
    return (
      <RestrictedSurfaceCard
        title="Site Content Creator is steward-only"
        description="This governed content workspace is reserved for stewards managing crawl, mapping, assessment, and rewrite operations. Observers and curators should use the Dock, Watchtower, or downstream report surfaces instead."
      />
    );
  }

  return <SiteContentCreatorPage />;
}
