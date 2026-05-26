import Link from "next/link";

const MODE_LINKS = [
  { href: "/tracker/all-sources", label: "Volumes: All Sources" },
  { href: "/tracker/website-source", label: "Volumes: Website Source Only" },
  { href: "/tracker/conversions", label: "Conversions: Website Source Only" },
];

export function TrackerModeTabs({ currentPath }: { currentPath: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm">
      <div className="grid gap-2 md:grid-cols-3">
        {MODE_LINKS.map((link) => {
          const active = currentPath === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "rounded-xl bg-[#15284B] px-4 py-3 text-sm font-semibold text-white shadow-sm"
                  : "rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
