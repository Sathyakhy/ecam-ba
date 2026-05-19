// Warnings-only dependency engine for project tasks.
// Does NOT auto-reschedule. Surfaces conflicts so users can adjust.

export type DepTask = {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  predecessor_ids: string[] | null;
  status: string;
};

export type DepWarning = {
  taskId: string;
  taskTitle: string;
  kind: "starts_before_predecessor_ends" | "missing_dates" | "circular" | "predecessor_missing";
  message: string;
  predecessorId?: string;
};

const DAY = 86_400_000;

function toTime(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Detect cycles via DFS. Returns set of task ids that participate in a cycle. */
function detectCycles(tasks: DepTask[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const cycleNodes = new Set<string>();
  tasks.forEach((t) => color.set(t.id, WHITE));

  const visit = (id: string, stack: string[]) => {
    color.set(id, GRAY);
    stack.push(id);
    const t = byId.get(id);
    for (const p of t?.predecessor_ids ?? []) {
      const c = color.get(p);
      if (c === GRAY) {
        const idx = stack.indexOf(p);
        stack.slice(idx).forEach((n) => cycleNodes.add(n));
      } else if (c === WHITE) {
        visit(p, stack);
      }
    }
    stack.pop();
    color.set(id, BLACK);
  };

  tasks.forEach((t) => { if (color.get(t.id) === WHITE) visit(t.id, []); });
  return cycleNodes;
}

export function computeDependencyWarnings(tasks: DepTask[]): DepWarning[] {
  const warnings: DepWarning[] = [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const cycles = detectCycles(tasks);

  for (const t of tasks) {
    if (cycles.has(t.id)) {
      warnings.push({
        taskId: t.id,
        taskTitle: t.title,
        kind: "circular",
        message: `"${t.title}" is part of a circular dependency chain.`,
      });
    }

    const preds = t.predecessor_ids ?? [];
    if (preds.length === 0) continue;

    const tStart = toTime(t.start_date) ?? toTime(t.due_date);
    for (const pid of preds) {
      const p = byId.get(pid);
      if (!p) {
        warnings.push({
          taskId: t.id,
          taskTitle: t.title,
          kind: "predecessor_missing",
          message: `"${t.title}" depends on a task that no longer exists.`,
          predecessorId: pid,
        });
        continue;
      }
      const pEnd = toTime(p.due_date) ?? toTime(p.start_date);
      if (tStart == null || pEnd == null) {
        warnings.push({
          taskId: t.id,
          taskTitle: t.title,
          kind: "missing_dates",
          message: `"${t.title}" or its predecessor "${p.title}" is missing dates needed to validate the dependency.`,
          predecessorId: pid,
        });
        continue;
      }
      if (tStart + DAY <= pEnd) {
        warnings.push({
          taskId: t.id,
          taskTitle: t.title,
          kind: "starts_before_predecessor_ends",
          message: `"${t.title}" starts before predecessor "${p.title}" ends.`,
          predecessorId: pid,
        });
      }
    }
  }
  return warnings;
}
