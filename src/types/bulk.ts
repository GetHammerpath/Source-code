/** Batch row for virtualized DataGrid. Segments map to script for API. */
export interface BatchRow {
  id: string;
  avatar_id: string;
  avatar_name: string;
  segment1: string;
  segment2: string;
  segment3: string;
  segment4?: string;
  segment5?: string;
}

const SEGMENT_KEYS = ["segment1", "segment2", "segment3", "segment4", "segment5"] as const;

/** Build script from segments 1..sceneCount (default 3). */
export function batchRowToScript(row: BatchRow, sceneCount: number = 3): string {
  const n = Math.min(Math.max(1, sceneCount), 5);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const key = SEGMENT_KEYS[i];
    const val = (row as Record<string, string>)[key];
    if (val != null && String(val).trim()) parts.push(String(val).trim());
  }
  return parts.join("\n\n").trim() || (row.segment1 || "");
}

export function createEmptyRow(): BatchRow {
  return {
    id: crypto.randomUUID?.() || `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    avatar_id: "",
    avatar_name: "",
    segment1: "",
    segment2: "",
    segment3: "",
    segment4: "",
    segment5: "",
  };
}

export function getSegments(row: BatchRow): string[] {
  return SEGMENT_KEYS.map((k) => (row as Record<string, string>)[k] ?? "");
}

export function setSegments(row: BatchRow, segments: string[]): Partial<BatchRow> {
  const out: Partial<BatchRow> = {};
  SEGMENT_KEYS.forEach((k, i) => {
    (out as Record<string, string>)[k] = segments[i] ?? "";
  });
  return out;
}
