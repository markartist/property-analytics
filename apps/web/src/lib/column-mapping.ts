/** Maps spreadsheet header labels → DB column names for leasing metrics. */
export const COLUMN_MAPPING: Record<string, string> = {
  week_date: "week_date",
  "Week Ending": "week_date",
  "Week ending": "week_date",
  "week ending": "week_date",
  Scope: "type",
  GCards: "g_cards",
  Visits: "visits",
  "First Tours": "first_tours",
  Apps: "apps",
  Leases: "leases",
  "C&Ds": "c_and_ds",
  "Move-Ins": "move_ins",
  "V/GC Conv": "v_gc_conv",
  "A/GC Conv": "a_gc_conv",
  "L/GC Conv": "l_gc_conv",
  "L/V Ratio": "l_v_ratio",
  "C&D Pct of GCs": "c_d_pct_of_gcs",
  "MI/GC Conv": "mi_gc_conv",
  "MI/V Ratio": "mi_v_ratio",
  "GCards Δ": "g_cards_delta",
  "Visits Δ": "visits_delta",
  "Apps Δ": "apps_delta",
  "Leases Δ": "leases_delta",
  "C&Ds Δ": "c_and_ds_delta",
  "Move-Ins Δ": "move_ins_delta",
  "V/GC Conv Δ": "v_gc_conv_delta",
  "A/GC Conv Δ": "a_gc_conv_delta",
  "L/GC Conv Δ": "l_gc_conv_delta",
  "L/V Ratio Δ": "l_v_ratio_delta",
  "C&D Pct of GCs Δ": "c_d_pct_of_gcs_delta",
  "MI/GC Conv Δ": "mi_gc_conv_delta",
  "MI/V Ratio Δ": "mi_v_ratio_delta",
};

export const NUMBER_FIELDS = new Set([
  "g_cards", "visits", "first_tours", "apps", "leases", "c_and_ds", "move_ins",
  "v_gc_conv", "a_gc_conv", "l_gc_conv", "l_v_ratio", "c_d_pct_of_gcs", "mi_gc_conv", "mi_v_ratio",
  "g_cards_delta", "visits_delta", "apps_delta", "leases_delta", "c_and_ds_delta", "move_ins_delta",
  "v_gc_conv_delta", "a_gc_conv_delta", "l_gc_conv_delta", "l_v_ratio_delta", "c_d_pct_of_gcs_delta",
  "mi_gc_conv_delta", "mi_v_ratio_delta",
]);

/** Friendly headers for CSV template download */
export const TEMPLATE_HEADERS = [
  "Week Ending", "Scope", "GCards", "Visits", "First Tours", "Apps", "Leases",
  "C&Ds", "Move-Ins", "V/GC Conv", "A/GC Conv", "L/GC Conv", "L/V Ratio",
  "C&D Pct of GCs", "MI/GC Conv", "MI/V Ratio", "GCards Δ", "Visits Δ",
  "Apps Δ", "Leases Δ", "C&Ds Δ", "Move-Ins Δ", "V/GC Conv Δ", "A/GC Conv Δ",
  "L/GC Conv Δ", "L/V Ratio Δ", "C&D Pct of GCs Δ", "MI/GC Conv Δ", "MI/V Ratio Δ",
];

/**
 * Parse a tab-separated (or comma-separated) block of text into leasing-metric records.
 * Returns an array of parsed row objects ready for API upsert.
 */
export function parseMetricsText(text: string): Record<string, unknown>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("Data must include a header row and at least one data row.");

  // Detect delimiter: if first line has tabs use tab, else comma
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim());

  // Build header → column index map
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const field = COLUMN_MAPPING[h];
    if (field) headerMap[field] = i;
  });

  if (Object.keys(headerMap).length < 2) {
    throw new Error(
      `Could not match required headers. Ensure data is tab- or comma-separated with headers like "Week Ending" and "Scope". Found: ${headers.join(", ")}`
    );
  }

  const rows = lines.slice(1);
  const parsed: Record<string, unknown>[] = [];

  for (const row of rows) {
    const values = row.split(delimiter);
    if (values.length < headers.length * 0.5) continue;

    const record: Record<string, unknown> = {};
    for (const [field, idx] of Object.entries(headerMap)) {
      const raw = values[idx]?.trim();
      if (!raw) continue;

      if (NUMBER_FIELDS.has(field)) {
        record[field] = parseFloat(raw.replace(/[^\d.,-]/g, "").replace(/,/g, "")) || 0;
      } else if (field === "week_date") {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) record[field] = d.toISOString().split("T")[0];
      } else if (field === "type") {
        const lower = raw.toLowerCase();
        if (lower === "portfolio") record[field] = "portfolio";
        else if (lower === "community") record[field] = "community";
      } else {
        record[field] = raw;
      }
    }

    if (record.type && record.week_date) parsed.push(record);
  }

  if (parsed.length === 0) {
    throw new Error("No valid rows found. Each row needs a week_date and Scope (Community/Portfolio).");
  }
  return parsed;
}
