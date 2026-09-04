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
        title="AI Content Suite is curator-only"
        description="This governed Pond workspace is reserved for curators and stewards editing mapped live site content."
      />
    );
  }

  return <SiteContentCreatorPage title="AI Content Suite" eyebrow="Live content editor" />;
}
