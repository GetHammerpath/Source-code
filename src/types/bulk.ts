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
  /** Dynamic segments when sceneCount > 5 */
  segments?: string[];
}

const SEGMENT_KEYS = ["segment1", "segment2", "segment3", "segment4", "segment5"] as const;
const MAX_SCENES = 1000;

/** Build script from segments 1..sceneCount (1-1000). */
export function batchRowToScript(row: BatchRow, sceneCount: number = 3): string {
  const n = Math.min(Math.max(1, sceneCount), MAX_SCENES);
  const segs = getSegments(row, n);
  const parts = segs.slice(0, n).filter((s) => s?.trim());
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

export function getSegments(row: BatchRow, maxLen?: number): string[] {
  if (row.segments && Array.isArray(row.segments)) {
    const arr = [...row.segments];
    while (arr.length < (maxLen ?? 5)) arr.push("");
    return arr;
  }
  const fromKeys = SEGMENT_KEYS.map((k) => (row as Record<string, string>)[k] ?? "");
  if (maxLen && maxLen > 5) {
    while (fromKeys.length < maxLen) fromKeys.push("");
  }
  return fromKeys;
}

export function setSegments(row: BatchRow, segments: string[]): Partial<BatchRow> {
  const out: Partial<BatchRow> = {};
  if (segments.length <= 5) {
    SEGMENT_KEYS.forEach((k, i) => {
      (out as Record<string, string>)[k] = segments[i] ?? "";
    });
    if (row.segments) (out as BatchRow).segments = undefined;
  } else {
    (out as BatchRow).segments = segments;
    SEGMENT_KEYS.forEach((k, i) => {
      (out as Record<string, string>)[k] = segments[i] ?? "";
    });
  }
  return out;
}

export const SCENE_COUNT_MIN = 1;
export const SCENE_COUNT_MAX = MAX_SCENES;
