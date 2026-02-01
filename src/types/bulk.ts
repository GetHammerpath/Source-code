/** Batch row for virtualized DataGrid. Segments map to script for API. */
export interface BatchRow {
  id: string;
  avatar_id: string;
  avatar_name: string;
  segment1: string;
  segment2: string;
  segment3: string;
}

export function batchRowToScript(row: BatchRow): string {
  return [row.segment1, row.segment2, row.segment3].filter(Boolean).join("\n\n").trim() || row.segment1;
}

export function createEmptyRow(): BatchRow {
  return {
    id: crypto.randomUUID?.() || `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    avatar_id: "",
    avatar_name: "",
    segment1: "",
    segment2: "",
    segment3: "",
  };
}
