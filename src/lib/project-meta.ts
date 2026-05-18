export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  planning: { label: "Planning", variant: "outline" },
  active: { label: "Active", variant: "default" },
  on_hold: { label: "On hold", variant: "secondary" },
  completed: { label: "Completed", variant: "secondary" },
  archived: { label: "Archived", variant: "outline" },
};

export const PRIORITY_META: Record<string, { label: string; variant: BadgeVariant }> = {
  low: { label: "Low", variant: "outline" },
  normal: { label: "Normal", variant: "secondary" },
  high: { label: "High", variant: "default" },
  urgent: { label: "Urgent", variant: "destructive" },
};
