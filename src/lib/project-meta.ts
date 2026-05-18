export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
export interface MetaEntry { label: string; variant: BadgeVariant }

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

export function metaEntries(meta: Record<string, MetaEntry>): [string, MetaEntry][] {
  return Object.entries(meta);
}
