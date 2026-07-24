import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, PlayCircle, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const OUTPUTS = [
  {
    label: "Missing employee photos",
    path: "evs/reports/legacy-employee-photo-audit-*/employee-photo-missing.csv",
  },
  {
    label: "Property summary",
    path: "evs/reports/legacy-employee-photo-audit-*/employee-photo-property-summary.csv",
  },
  {
    label: "Raw run evidence",
    path: "evs/reports/legacy-employee-photo-audit-*/summary.json",
  },
];

export default function EmployeePhotoAuditPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F5]">
      <div className="border-b border-[#D6D6D2] bg-[#15284B] px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link href="/dock" className="text-white/65 transition-colors hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="rounded-lg bg-[#3D66B9] p-2">
            <UserRoundCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Employee Photo Audit</h1>
            <p className="text-sm text-white/60">EVS ad-hoc BrowserStack report</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#294782]">Legacy property sites</p>
            <h2 className="mt-2 text-2xl font-bold text-[#15284B]">Missing team photo report</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#000000]/70">
              Runs the BrowserStack EVS profile against legacy property pages at the anchored team section and saves reusable audit evidence.
            </p>
          </div>
          <Badge className="w-fit border-[#D6D6D2] bg-white text-[#15284B]">Saved toolbox lane</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-[#D6D6D2]">
            <CardContent className="space-y-3 p-5">
              <PlayCircle className="h-5 w-5 text-[#3D66B9]" />
              <div>
                <p className="text-sm font-semibold text-[#15284B]">Run Command</p>
                <code className="mt-2 block rounded bg-[#15284B] px-3 py-2 text-xs text-white">./run_legacy_employee_photo_audit.sh</code>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#D6D6D2]">
            <CardContent className="space-y-3 p-5">
              <ShieldCheck className="h-5 w-5 text-[#3B9189]" />
              <div>
                <p className="text-sm font-semibold text-[#15284B]">Credential Source</p>
                <p className="mt-2 text-sm leading-6 text-[#000000]/70">BrowserStack auth is injected through the Keeper-backed EVS wrapper.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#D6D6D2]">
            <CardContent className="space-y-3 p-5">
              <FileSpreadsheet className="h-5 w-5 text-[#BD4830]" />
              <div>
                <p className="text-sm font-semibold text-[#15284B]">Primary Output</p>
                <p className="mt-2 text-sm leading-6 text-[#000000]/70">CSV rows list property, employee name, role, issue type, image URL, and evidence text.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#D6D6D2]">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-[#15284B]">Saved Outputs</p>
            <div className="mt-4 divide-y divide-[#D6D6D2]">
              {OUTPUTS.map((output) => (
                <div key={output.path} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between">
                  <span className="text-sm font-medium text-[#15284B]">{output.label}</span>
                  <code className="rounded bg-[#F6F6F5] px-2 py-1 text-xs text-[#294782]">{output.path}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
