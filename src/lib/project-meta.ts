export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
export interface MetaEntry { label: string; variant: BadgeVariant; color?: string }

export const STATUS_META: Record<string, MetaEntry> = {
  planning: { label: "Planning", variant: "outline" },
  active: { label: "Active", variant: "default" },
  on_hold: { label: "On hold", variant: "secondary" },
  completed: { label: "Completed", variant: "secondary" },
  archived: { label: "Archived", variant: "outline" },
};

export const PRIORITY_META: Record<string, MetaEntry> = {
  low: { label: "Low", variant: "outline" },
  normal: { label: "Normal", variant: "secondary" },
  high: { label: "High", variant: "default" },
  urgent: { label: "Urgent", variant: "destructive" },
};

export const TASK_STATUS_META: Record<string, MetaEntry & { column: string }> = {
  todo:        { label: "To do",       variant: "outline",     column: "todo" },
  in_progress: { label: "In progress", variant: "default",     column: "in_progress" },
  done:        { label: "Done",        variant: "secondary",   column: "done" },
  blocked:     { label: "Blocked",     variant: "destructive", column: "blocked" },
};

export const TASK_COLUMNS = ["todo", "in_progress", "done", "blocked"] as const;
export type TaskStatus = typeof TASK_COLUMNS[number];

export function metaEntries<T>(meta: Record<string, T>): [string, T][] {
  return Object.entries(meta);
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}
