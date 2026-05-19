import { supabase } from "@/integrations/supabase/client";

type TaskSnapshot = {
  tempId: string;
  parentTempId: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  order_index: number;
  module: string | null;
  site: string | null;
  man_days: number | null;
  pic_org: string | null;
  pic_orgs: string[];
  start_offset_days: number | null;
  due_offset_days: number | null;
};

type MilestoneSnapshot = {
  tempId: string;
  title: string;
  description: string | null;
  phase: string | null;
  order_index: number;
  due_offset_days: number | null;
};

type Payload = {
  milestones: MilestoneSnapshot[];
  tasks: TaskSnapshot[];
};

const offsetDays = (date: string | null, anchor: string | null): number | null => {
  if (!date || !anchor) return null;
  const d = new Date(date).getTime();
  const a = new Date(anchor).getTime();
  if (isNaN(d) || isNaN(a)) return null;
  return Math.round((d - a) / 86400000);
};

const addDays = (anchor: string, offset: number | null): string | null => {
  if (offset == null) return null;
  const d = new Date(anchor);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export async function saveProjectAsTemplate(opts: {
  projectId: string;
  name: string;
  description?: string;
  createdBy: string;
}) {
  const proj = await supabase.from("projects").select("start_date").eq("id", opts.projectId).single();
  const anchor = proj.data?.start_date ?? null;

  const [{ data: milestones }, { data: tasks }] = await Promise.all([
    supabase.from("project_milestones").select("*").eq("project_id", opts.projectId).is("deleted_at", null).order("order_index"),
    supabase.from("project_tasks").select("*").eq("project_id", opts.projectId).is("deleted_at", null).order("order_index"),
  ]);

  const taskIdMap = new Map<string, string>();
  (tasks ?? []).forEach((t) => taskIdMap.set(t.id, crypto.randomUUID()));

  const payload: Payload = {
    milestones: (milestones ?? []).map((m) => ({
      tempId: crypto.randomUUID(),
      title: m.title,
      description: m.description ?? null,
      phase: m.phase ?? null,
      order_index: m.order_index ?? 0,
      due_offset_days: offsetDays(m.due_date, anchor),
    })),
    tasks: (tasks ?? []).map((t) => ({
      tempId: taskIdMap.get(t.id)!,
      parentTempId: t.parent_task_id ? taskIdMap.get(t.parent_task_id) ?? null : null,
      title: t.title,
      description: t.description ?? null,
      priority: t.priority,
      status: "todo",
      order_index: t.order_index ?? 0,
      module: t.module ?? null,
      site: t.site ?? null,
      man_days: t.man_days ?? null,
      pic_org: t.pic_org ?? null,
      pic_orgs: t.pic_orgs ?? [],
      start_offset_days: offsetDays(t.start_date, anchor),
      due_offset_days: offsetDays(t.due_date, anchor),
    })),
  };

  const { error } = await supabase.from("project_templates").insert({
    name: opts.name,
    description: opts.description ?? null,
    source_project_id: opts.projectId,
    created_by: opts.createdBy,
    payload: payload as never,
  });
  if (error) throw error;
}

export async function instantiateTemplate(opts: {
  templateId: string;
  newProjectId: string;
  createdBy: string;
  startDate?: string | null;
}) {
  const { data: tmpl, error } = await supabase.from("project_templates").select("payload").eq("id", opts.templateId).single();
  if (error) throw error;
  const payload = (tmpl?.payload ?? { milestones: [], tasks: [] }) as Payload;
  const anchor = opts.startDate ?? new Date().toISOString().slice(0, 10);

  if (payload.milestones.length) {
    await supabase.from("project_milestones").insert(payload.milestones.map((m) => ({
      project_id: opts.newProjectId,
      title: m.title,
      description: m.description,
      phase: m.phase,
      order_index: m.order_index,
      due_date: addDays(anchor, m.due_offset_days),
      status: "pending",
    })));
  }

  if (payload.tasks.length) {
    // Insert in two passes: roots first, then children (with mapped parent ids)
    const idMap = new Map<string, string>();
    const roots = payload.tasks.filter((t) => !t.parentTempId);
    const children = payload.tasks.filter((t) => t.parentTempId);

    const insertBatch = async (batch: TaskSnapshot[], lookupParent: boolean) => {
      if (!batch.length) return;
      const rows = batch.map((t) => {
        const newId = crypto.randomUUID();
        idMap.set(t.tempId, newId);
        return {
          id: newId,
          project_id: opts.newProjectId,
          parent_task_id: lookupParent && t.parentTempId ? idMap.get(t.parentTempId) ?? null : null,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: "todo",
          order_index: t.order_index,
          module: t.module,
          site: t.site,
          man_days: t.man_days,
          pic_org: t.pic_org,
          pic_orgs: t.pic_orgs,
          created_by: opts.createdBy,
          start_date: addDays(anchor, t.start_offset_days),
          due_date: addDays(anchor, t.due_offset_days),
        };
      });
      const { error: insErr } = await supabase.from("project_tasks").insert(rows);
      if (insErr) throw insErr;
    };

    await insertBatch(roots, false);
    let remaining = [...children];
    let guard = 0;
    while (remaining.length && guard < 20) {
      const ready = remaining.filter((t) => idMap.has(t.parentTempId!));
      if (!ready.length) break;
      await insertBatch(ready, true);
      remaining = remaining.filter((t) => !idMap.has(t.tempId));
      guard++;
    }
  }
}
