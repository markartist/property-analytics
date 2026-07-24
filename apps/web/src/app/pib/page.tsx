"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function PibBuilderRedirectPage() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/analysis/pib");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F6F6F5] px-6 py-10 text-[#15284B]">
      <h1 className="text-3xl font-bold">Opening PIB Builder...</h1>
      <p className="mt-3 text-sm text-[#294782]">Redirecting to the report builder.</p>
    </div>
  );
}
