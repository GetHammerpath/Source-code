/** Batch row for virtualized DataGrid. segment* = script (dialogue), visual_segment* = visual context. */
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
  /** Visual context per scene (AI Generator path) */
  visual_segment1?: string;
  visual_segment2?: string;
  visual_segment3?: string;
  visual_segment4?: string;
  visual_segment5?: string;
  visual_segments?: string[];
}

const SEGMENT_KEYS = ["segment1", "segment2", "segment3", "segment4", "segment5"] as const;
const VISUAL_SEGMENT_KEYS = ["visual_segment1", "visual_segment2", "visual_segment3", "visual_segment4", "visual_segment5"] as const;
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

export function getVisualSegments(row: BatchRow, maxLen?: number): string[] {
  if (row.visual_segments && Array.isArray(row.visual_segments)) {
    const arr = [...row.visual_segments];
    while (arr.length < (maxLen ?? 5)) arr.push("");
    return arr;
  }
  const fromKeys = VISUAL_SEGMENT_KEYS.map((k) => (row as Record<string, string>)[k] ?? "");
  if (maxLen && maxLen > 5) {
    while (fromKeys.length < maxLen) fromKeys.push("");
  }
  return fromKeys;
}

export function setVisualSegments(row: BatchRow, segments: string[]): Partial<BatchRow> {
  const out: Partial<BatchRow> = {};
  if (segments.length <= 5) {
    VISUAL_SEGMENT_KEYS.forEach((k, i) => {
      (out as Record<string, string>)[k] = segments[i] ?? "";
    });
    if (row.visual_segments) (out as BatchRow).visual_segments = undefined;
  } else {
    (out as BatchRow).visual_segments = segments;
    VISUAL_SEGMENT_KEYS.forEach((k, i) => {
      (out as Record<string, string>)[k] = segments[i] ?? "";
    });
  }
  return out;
}

/** Build scene_prompts for API when we have both script and visual per scene */
export function batchRowToScenePrompts(
  row: BatchRow,
  sceneCount: number
): Array<{ scene_number: number; prompt: string; script: string }> | null {
  const scripts = getSegments(row, sceneCount);
  const visuals = getVisualSegments(row, sceneCount);
  const hasVisuals = visuals.some((v) => v?.trim());
  if (!hasVisuals) return null;
  return Array.from({ length: sceneCount }, (_, i) => ({
    scene_number: i + 1,
    prompt: visuals[i]?.trim() || "",
    script: scripts[i]?.trim() || "",
  }));
}

export const SCENE_COUNT_MIN = 1;
export const SCENE_COUNT_MAX = MAX_SCENES;
