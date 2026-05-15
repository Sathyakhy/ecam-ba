import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/onboarding/$profileId")({
  component: PlanPage,
});

const CHECKPOINTS = [30, 60, 90] as const;

function PlanPage() {
  const { profileId } = Route.useParams();
  const { profile, isAdmin, user } = useAuth();
  const isOwner = profile?.id === profileId;
  const canEdit = isAdmin;
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["plan-profile", profileId],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,full_name,username,avatar_url,job_title,department,start_date,onboarded").eq("id", profileId).single()).data,
  });

  const planQ = useQuery({
    queryKey: ["plan", profileId],
    queryFn: async () => (await supabase.from("onboarding_plans").select("*").eq("profile_id", profileId).maybeSingle()).data,
  });
  const planId = planQ.data?.id ?? null;

  const sectionsQ = useQuery({
    enabled: !!planId,
    queryKey: ["plan-sections", planId],
    queryFn: async () => (await supabase.from("onboarding_sections").select("*").eq("plan_id", planId!).order("order_index")).data ?? [],
  });
  const evalsQ = useQuery({
    enabled: !!planId,
    queryKey: ["plan-evals", planId],
    queryFn: async () => (await supabase.from("onboarding_evaluations").select("*").eq("plan_id", planId!).order("order_index")).data ?? [],
  });
  const expectQ = useQuery({
    enabled: !!planId,
    queryKey: ["plan-expect", planId],
    queryFn: async () => (await supabase.from("onboarding_expectations").select("*").eq("plan_id", planId!).order("order_index")).data ?? [],
  });
  const reflectQ = useQuery({
    enabled: !!planId,
    queryKey: ["plan-reflect", planId],
    queryFn: async () => (await supabase.from("onboarding_reflections").select("*").eq("plan_id", planId!).order("order_index")).data ?? [],
  });
  const progressQ = useQuery({
    enabled: !!planId,
    queryKey: ["plan-progress", planId],
    queryFn: async () => (await supabase.from("onboarding_progress").select("*").eq("plan_id", planId!).order("checkpoint")).data ?? [],
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["plan", profileId] });
    qc.invalidateQueries({ queryKey: ["plan-sections", planId] });
    qc.invalidateQueries({ queryKey: ["plan-evals", planId] });
    qc.invalidateQueries({ queryKey: ["plan-expect", planId] });
    qc.invalidateQueries({ queryKey: ["plan-reflect", planId] });
    qc.invalidateQueries({ queryKey: ["plan-progress", planId] });
  };

  if (!profileQ.data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  const p = profileQ.data;
  const initials = p.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  if (!planQ.data) {
    return (
      <div>
        <BackLink />
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No onboarding plan yet for this staff member.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <BackLink />

      {/* Header */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar className="h-16 w-16">
            {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name} />}
            <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding for</div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">{p.full_name}</h1>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground items-center">
              {p.job_title && <Badge variant="secondary">{p.job_title}</Badge>}
              {p.department && <Badge variant="outline">{p.department}</Badge>}
              {p.start_date && <span>Started {new Date(p.start_date).toLocaleDateString()}</span>}
              {p.onboarded ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">Onboarded</Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-600">Onboarding in progress</Badge>
              )}
            </div>
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant={p.onboarded ? "outline" : "default"}
              onClick={async () => {
                if (p.onboarded) {
                  // Reopen onboarding (history snapshots are kept)
                  const { error } = await supabase
                    .from("profiles")
                    .update({ onboarded: false } as never)
                    .eq("id", profileId);
                  if (error) return toast.error(error.message);
                  toast.success("Reopened onboarding");
                  qc.invalidateQueries({ queryKey: ["plan-profile", profileId] });
                  return;
                }
                // Snapshot the current plan into history, then mark onboarded
                const snapshot = {
                  profile: p,
                  plan: planQ.data,
                  sections: sectionsQ.data ?? [],
                  evaluations: evalsQ.data ?? [],
                  expectations: expectQ.data ?? [],
                  reflections: reflectQ.data ?? [],
                  progress: progressQ.data ?? [],
                };
                const evals = evalsQ.data ?? [];
                const ratings = evals
                  .map((e: any) => Number(e.rating_90 ?? e.rating_60 ?? e.rating_30))
                  .filter((n) => !isNaN(n));
                const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;
                const summary = avg != null
                  ? `Completed onboarding · avg rating ${avg.toFixed(1)}/5 across ${evals.length} areas`
                  : `Completed onboarding · ${evals.length} evaluation areas`;
                const { error: histErr } = await supabase.from("onboarding_history").insert({
                  profile_id: profileId,
                  plan_id: planId,
                  completed_by: user?.id ?? null,
                  summary,
                  snapshot,
                } as never);
                if (histErr) return toast.error(histErr.message);
                const { error } = await supabase
                  .from("profiles")
                  .update({ onboarded: true } as never)
                  .eq("id", profileId);
                if (error) return toast.error(error.message);
                toast.success("Marked as onboarded — review saved to history");
                qc.invalidateQueries({ queryKey: ["plan-profile", profileId] });
                qc.invalidateQueries({ queryKey: ["plan-history", profileId] });
              }}
            >
              {p.onboarded ? "Reopen onboarding" : "Mark as onboarded"}
            </Button>
          )}
        </div>
        <PlanHeaderEditor plan={planQ.data} canEdit={canEdit} onSaved={invalidateAll} />
      </Card>

      {/* Sections */}
      <SectionsBlock
        sections={sectionsQ.data ?? []}
        planId={planId!}
        canEdit={canEdit}
        onChange={invalidateAll}
      />

      {/* Evaluations */}
      <EvaluationsBlock
        rows={evalsQ.data ?? []}
        planId={planId!}
        canEdit={canEdit}
        onChange={invalidateAll}
      />

      {/* Expectations */}
      <ExpectationsBlock
        rows={expectQ.data ?? []}
        planId={planId!}
        canEdit={canEdit}
        onChange={invalidateAll}
      />

      {/* Reflections */}
      <ReflectionsBlock
        rows={reflectQ.data ?? []}
        planId={planId!}
        canEdit={canEdit}
        canAnswer={isOwner || canEdit}
        onChange={invalidateAll}
      />

      {/* Progress */}
      <ProgressBlock
        rows={progressQ.data ?? []}
        planId={planId!}
        canEdit={canEdit}
        onChange={invalidateAll}
      />

      {/* History */}
      <HistoryBlock profileId={profileId} canEdit={canEdit} />

      {canEdit && (
        <Card className="p-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Delete this plan and start over.</div>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!confirm("Delete the entire onboarding plan?")) return;
              await supabase.from("onboarding_plans").delete().eq("id", planId!);
              toast.success("Plan deleted");
              qc.invalidateQueries({ queryKey: ["plan", profileId] });
              qc.invalidateQueries({ queryKey: ["onboarding-plans"] });
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete plan
          </Button>
        </Card>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to="/onboarding"><ArrowLeft className="h-4 w-4 mr-1" /> Back to onboarding</Link>
    </Button>
  );
}

/* ---------- Plan header (welcome + key contacts) ---------- */
function PlanHeaderEditor({ plan, canEdit, onSaved }: { plan: any; canEdit: boolean; onSaved: () => void }) {
  const [welcome, setWelcome] = useState(plan.welcome_message ?? "");
  const [position, setPosition] = useState(plan.intern_position ?? "");
  const [senior, setSenior] = useState(plan.senior_name ?? "");
  const [supervisor, setSupervisor] = useState(plan.supervisor_name ?? "");
  const [contact, setContact] = useState(plan.point_of_contact ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(plan.assignee_id ?? "");

  const staffQ = useQuery({
    enabled: canEdit,
    queryKey: ["assignable-staff"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,full_name,job_title").order("full_name")).data ?? [],
  });
  const assigneeName = (staffQ.data ?? []).find((s) => s.id === plan.assignee_id)?.full_name;

  useEffect(() => {
    setWelcome(plan.welcome_message ?? "");
    setPosition(plan.intern_position ?? "");
    setSenior(plan.senior_name ?? "");
    setSupervisor(plan.supervisor_name ?? "");
    setContact(plan.point_of_contact ?? "");
    setAssigneeId(plan.assignee_id ?? "");
  }, [plan.id]);

  const save = async () => {
    const { error } = await supabase.from("onboarding_plans").update({
      welcome_message: welcome,
      intern_position: position || null,
      senior_name: senior || null,
      supervisor_name: supervisor || null,
      point_of_contact: contact || null,
      assignee_id: assigneeId || null,
    } as never).eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  };

  if (!canEdit) {
    return (
      <div className="mt-4 space-y-3 text-sm">
        <p className="italic text-muted-foreground">{welcome}</p>
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          {position && <div><span className="text-muted-foreground">Position:</span> {position}</div>}
          {senior && <div><span className="text-muted-foreground">Senior:</span> {senior}</div>}
          {supervisor && <div><span className="text-muted-foreground">Supervisor:</span> {supervisor}</div>}
          {contact && <div><span className="text-muted-foreground">Point of contact:</span> {contact}</div>}
          {assigneeName && <div><span className="text-muted-foreground">Assigned to:</span> {assigneeName}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Welcome message</Label>
        <Textarea rows={2} value={welcome} onChange={(e) => setWelcome(e.target.value)} maxLength={500} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Position" v={position} setV={setPosition} />
        <Field label="Senior" v={senior} setV={setSenior} />
        <Field label="Supervisor" v={supervisor} setV={setSupervisor} />
        <Field label="Point of contact" v={contact} setV={setContact} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Assigned staff (can view this plan)</Label>
          <Select
            value={assigneeId || "__none__"}
            onValueChange={(v) => setAssigneeId(v === "__none__" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="No assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No assignee</SelectItem>
              {(staffQ.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}{s.job_title ? ` · ${s.job_title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" onClick={save}><Save className="h-3.5 w-3.5 mr-1" /> Save header</Button>
    </div>
  );
}
function Field({ label, v, setV }: { label: string; v: string; setV: (s: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => setV(e.target.value)} maxLength={120} />
    </div>
  );
}

/* ---------- Sections ---------- */
function SectionsBlock({ sections, planId, canEdit, onChange }: { sections: any[]; planId: string; canEdit: boolean; onChange: () => void }) {
  const addSection = async () => {
    const { error } = await supabase.from("onboarding_sections").insert({
      plan_id: planId, title: "New section", body: "", order_index: sections.length,
    });
    if (error) return toast.error(error.message);
    onChange();
  };
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Plan</h2>
        {canEdit && <Button size="sm" variant="outline" onClick={addSection}><Plus className="h-3.5 w-3.5 mr-1" /> Add section</Button>}
      </div>
      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sections yet.</p>
      ) : (
        <div className="space-y-4">
          {sections.map((s) => (
            <SectionRow key={s.id} section={s} canEdit={canEdit} onChange={onChange} />
          ))}
        </div>
      )}
    </Card>
  );
}
function SectionRow({ section, canEdit, onChange }: { section: any; canEdit: boolean; onChange: () => void }) {
  const [title, setTitle] = useState(section.title);
  const [body, setBody] = useState(section.body);
  const [dirty, setDirty] = useState(false);

  const save = async () => {
    const { error } = await supabase.from("onboarding_sections").update({ title, body }).eq("id", section.id);
    if (error) return toast.error(error.message);
    setDirty(false);
    onChange();
  };
  const remove = async () => {
    if (!confirm("Delete this section?")) return;
    await supabase.from("onboarding_sections").delete().eq("id", section.id);
    onChange();
  };

  if (!canEdit) {
    return (
      <div className="border-l-2 border-primary/30 pl-4">
        <h3 className="font-medium">{section.title}</h3>
        <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans mt-1">{section.body}</pre>
      </div>
    );
  }
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex gap-2 items-start">
        <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} maxLength={120} className="font-medium" />
        <Button variant="ghost" size="icon" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      <Textarea rows={4} value={body} onChange={(e) => { setBody(e.target.value); setDirty(true); }} maxLength={4000} />
      {dirty && <Button size="sm" onClick={save}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>}
    </div>
  );
}

/* ---------- Evaluations ---------- */
function EvaluationsBlock({ rows, planId, canEdit, onChange }: { rows: any[]; planId: string; canEdit: boolean; onChange: () => void }) {
  const add = async () => {
    await supabase.from("onboarding_evaluations").insert({ plan_id: planId, area: "New area", order_index: rows.length });
    onChange();
  };
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Performance review</h2>
          <p className="text-xs text-muted-foreground">Rate 1–5 (1 = Needs Improvement, 5 = Excellent)</p>
        </div>
        {canEdit && <Button size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" /> Add area</Button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left py-2 font-medium">Area</th>
              <th className="px-2 font-medium w-16">30d</th>
              <th className="px-2 font-medium w-16">60d</th>
              <th className="px-2 font-medium w-16">90d</th>
              <th className="text-left px-2 font-medium">Comments</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <EvalRow key={r.id} row={r} canEdit={canEdit} onChange={onChange} />)}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function EvalRow({ row, canEdit, onChange }: { row: any; canEdit: boolean; onChange: () => void }) {
  const [area, setArea] = useState(row.area);
  const [desc, setDesc] = useState(row.description ?? "");
  const [r30, setR30] = useState(row.rating_30 ?? "");
  const [r60, setR60] = useState(row.rating_60 ?? "");
  const [r90, setR90] = useState(row.rating_90 ?? "");
  const [comment, setComment] = useState(row.comment ?? "");
  const save = async (patch: any) => {
    const { error } = await supabase.from("onboarding_evaluations").update(patch as never).eq("id", row.id);
    if (error) toast.error(error.message);
    else onChange();
  };
  const num = (v: string) => v === "" ? null : Math.max(0, Math.min(5, Number(v)));
  return (
    <tr className="border-b align-top">
      <td className="py-2 pr-2">
        {canEdit ? (
          <div className="space-y-1">
            <Input value={area} onChange={(e) => setArea(e.target.value)} onBlur={() => save({ area })} className="h-8" maxLength={80} />
            <Input value={desc} placeholder="Description" onChange={(e) => setDesc(e.target.value)} onBlur={() => save({ description: desc })} className="h-7 text-xs" maxLength={200} />
          </div>
        ) : (
          <div>
            <div className="font-medium">{row.area}</div>
            {row.description && <div className="text-xs text-muted-foreground">{row.description}</div>}
          </div>
        )}
      </td>
      {([
        [r30, setR30, "rating_30"], [r60, setR60, "rating_60"], [r90, setR90, "rating_90"],
      ] as const).map(([v, set, key]) => (
        <td key={key} className="px-1">
          <Input
            type="number" min={0} max={5} step={0.5}
            value={v as any} disabled={!canEdit}
            onChange={(e) => set(e.target.value)}
            onBlur={() => save({ [key]: num(String(v)) })}
            className="h-8 w-14 text-center"
          />
        </td>
      ))}
      <td className="px-2">
        <Textarea
          rows={1} value={comment} disabled={!canEdit}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => save({ comment })}
          maxLength={500}
          className="text-xs min-h-8"
        />
      </td>
      {canEdit && (
        <td className="pl-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
            await supabase.from("onboarding_evaluations").delete().eq("id", row.id); onChange();
          }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </td>
      )}
    </tr>
  );
}

/* ---------- Expectations ---------- */
function ExpectationsBlock({ rows, planId, canEdit, onChange }: { rows: any[]; planId: string; canEdit: boolean; onChange: () => void }) {
  const add = async () => {
    await supabase.from("onboarding_expectations").insert({ plan_id: planId, area: "New expectation", order_index: rows.length });
    onChange();
  };
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Professional expectations</h2>
        {canEdit && <Button size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>}
      </div>
      <div className="space-y-3">
        {rows.map((r) => <ExpectRow key={r.id} row={r} canEdit={canEdit} onChange={onChange} />)}
      </div>
    </Card>
  );
}
function ExpectRow({ row, canEdit, onChange }: { row: any; canEdit: boolean; onChange: () => void }) {
  const [area, setArea] = useState(row.area);
  const [v30, setV30] = useState(row.value_30 ?? "");
  const [v60, setV60] = useState(row.value_60 ?? "");
  const [v90, setV90] = useState(row.value_90 ?? "");
  const save = (patch: any) =>
    supabase.from("onboarding_expectations").update(patch as never).eq("id", row.id).then(({ error }) => error ? toast.error(error.message) : onChange());
  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        {canEdit ? (
          <Input value={area} onChange={(e) => setArea(e.target.value)} onBlur={() => save({ area })} className="h-8 font-medium" maxLength={120} />
        ) : (
          <div className="font-medium text-sm flex-1">{row.area}</div>
        )}
        {canEdit && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
            await supabase.from("onboarding_expectations").delete().eq("id", row.id); onChange();
          }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([[v30, setV30, "value_30", "30d"], [v60, setV60, "value_60", "60d"], [v90, setV90, "value_90", "90d"]] as const).map(
          ([v, set, key, lbl]) => (
            <div key={key} className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{lbl}</Label>
              <Input
                value={v} disabled={!canEdit}
                onChange={(e) => set(e.target.value)}
                onBlur={() => save({ [key]: v || null })}
                placeholder="—" className="h-8 text-xs"
                maxLength={120}
              />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* ---------- Reflections ---------- */
function ReflectionsBlock({
  rows, planId, canEdit, canAnswer, onChange,
}: { rows: any[]; planId: string; canEdit: boolean; canAnswer: boolean; onChange: () => void }) {
  const add = async (cp: number) => {
    const idx = rows.filter((r) => r.checkpoint === cp).length;
    await supabase.from("onboarding_reflections").insert({ plan_id: planId, checkpoint: cp, question: "New question", order_index: idx });
    onChange();
  };
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Self-reflection</h2>
        <p className="text-xs text-muted-foreground">The intern fills these in at each checkpoint.</p>
      </div>
      <div className="space-y-5">
        {CHECKPOINTS.map((cp) => (
          <div key={cp}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Badge variant="secondary">{cp} days</Badge>
              </h3>
              {canEdit && <Button size="sm" variant="ghost" onClick={() => add(cp)}><Plus className="h-3.5 w-3.5 mr-1" /> Add question</Button>}
            </div>
            <div className="space-y-2">
              {rows.filter((r) => r.checkpoint === cp).map((r) => (
                <ReflectRow key={r.id} row={r} canEdit={canEdit} canAnswer={canAnswer} onChange={onChange} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
function ReflectRow({ row, canEdit, canAnswer, onChange }: { row: any; canEdit: boolean; canAnswer: boolean; onChange: () => void }) {
  const [q, setQ] = useState(row.question);
  const [a, setA] = useState(row.answer ?? "");
  return (
    <div className="border rounded-md p-3 space-y-2">
      {canEdit ? (
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() =>
            supabase.from("onboarding_reflections").update({ question: q }).eq("id", row.id).then(() => onChange())
          } maxLength={300} className="h-8 text-sm font-medium" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
            await supabase.from("onboarding_reflections").delete().eq("id", row.id); onChange();
          }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      ) : (
        <p className="text-sm font-medium">{row.question}</p>
      )}
      <Textarea
        rows={2} value={a} disabled={!canAnswer}
        onChange={(e) => setA(e.target.value)}
        onBlur={() =>
          supabase.from("onboarding_reflections").update({ answer: a }).eq("id", row.id).then(({ error }) => {
            if (error) toast.error(error.message); else onChange();
          })
        }
        placeholder={canAnswer ? "Your reflection…" : "—"}
        maxLength={2000} className="text-sm"
      />
    </div>
  );
}

/* ---------- Progress ---------- */
function ProgressBlock({ rows, planId, canEdit, onChange }: { rows: any[]; planId: string; canEdit: boolean; onChange: () => void }) {
  const ensureRow = async (cp: number) => {
    const exists = rows.find((r) => r.checkpoint === cp);
    if (exists) return exists;
    const { data } = await supabase.from("onboarding_progress").insert({ plan_id: planId, checkpoint: cp, status: "pending" }).select("*").single();
    onChange();
    return data;
  };
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold mb-4">Overall progress & next steps</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        {CHECKPOINTS.map((cp) => {
          const row = rows.find((r) => r.checkpoint === cp);
          return <ProgressCard key={cp} cp={cp} row={row} canEdit={canEdit} ensureRow={() => ensureRow(cp)} onChange={onChange} />;
        })}
      </div>
    </Card>
  );
}
function ProgressCard({ cp, row, canEdit, ensureRow, onChange }: { cp: number; row: any; canEdit: boolean; ensureRow: () => Promise<any>; onChange: () => void }) {
  const [status, setStatus] = useState<string>(row?.status ?? "pending");
  const [note, setNote] = useState<string>(row?.note ?? "");
  useEffect(() => { setStatus(row?.status ?? "pending"); setNote(row?.note ?? ""); }, [row?.id]);
  const update = async (patch: any) => {
    const r = row ?? await ensureRow();
    if (!r) return;
    const { error } = await supabase.from("onboarding_progress").update(patch as never).eq("id", r.id);
    if (error) toast.error(error.message); else onChange();
  };
  const statusVariant = status === "completed" ? "default" : status === "in_progress" ? "secondary" : "outline";
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{cp} days</span>
        <Badge variant={statusVariant as any} className="text-[10px] capitalize">{status.replace("_", " ")}</Badge>
      </div>
      <Select value={status} disabled={!canEdit} onValueChange={(v) => { setStatus(v); update({ status: v }); }}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      <Textarea
        rows={3} value={note} disabled={!canEdit}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => update({ note: note || null })}
        placeholder="Notes / next steps" className="text-xs"
        maxLength={1000}
      />
    </div>
  );
}

function HistoryBlock({ profileId, canEdit }: { profileId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const historyQ = useQuery({
    queryKey: ["plan-history", profileId],
    queryFn: async () =>
      (await supabase
        .from("onboarding_history")
        .select("*")
        .eq("profile_id", profileId)
        .order("completed_at", { ascending: false })).data ?? [],
  });

  const rows = historyQ.data ?? [];

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">Onboarding history</h2>
          <p className="text-xs text-muted-foreground">
            Each time onboarding is marked complete, a snapshot of the review is saved here.
          </p>
        </div>
        <Badge variant="secondary">{rows.length} {rows.length === 1 ? "review" : "reviews"}</Badge>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
          No completed reviews yet.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((h: any) => {
            const open = openId === h.id;
            const snap = h.snapshot ?? {};
            return (
              <div key={h.id} className="border border-border rounded-md">
                <button
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => setOpenId(open ? null : h.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {new Date(h.completed_at).toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{h.summary ?? "Onboarding completed"}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{open ? "Hide" : "View"}</Badge>
                  {canEdit && (
                    <Trash2
                      className="h-4 w-4 text-destructive opacity-60 hover:opacity-100"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("Delete this history entry?")) return;
                        await supabase.from("onboarding_history").delete().eq("id", h.id);
                        toast.success("Deleted");
                        qc.invalidateQueries({ queryKey: ["plan-history", profileId] });
                      }}
                    />
                  )}
                </button>
                {open && (
                  <div className="border-t border-border p-4 space-y-4 bg-muted/20">
                    {Array.isArray(snap.evaluations) && snap.evaluations.length > 0 && (
                      <SnapshotTable
                        title="Evaluations"
                        headers={["Area", "30d", "60d", "90d", "Comment"]}
                        rows={snap.evaluations.map((e: any) => [
                          e.area,
                          e.rating_30 ?? "—",
                          e.rating_60 ?? "—",
                          e.rating_90 ?? "—",
                          e.comment ?? "—",
                        ])}
                      />
                    )}
                    {Array.isArray(snap.expectations) && snap.expectations.length > 0 && (
                      <SnapshotTable
                        title="Professional expectations"
                        headers={["Area", "30 days", "60 days", "90 days"]}
                        rows={snap.expectations.map((e: any) => [
                          e.area, e.value_30 ?? "—", e.value_60 ?? "—", e.value_90 ?? "—",
                        ])}
                      />
                    )}
                    {Array.isArray(snap.reflections) && snap.reflections.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                          Self-reflection
                        </div>
                        <div className="space-y-2">
                          {snap.reflections.map((r: any) => (
                            <div key={r.id} className="text-sm">
                              <div className="font-medium">
                                {r.checkpoint}d · {r.question}
                              </div>
                              <div className="text-muted-foreground whitespace-pre-wrap">
                                {r.answer || "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(snap.progress) && snap.progress.length > 0 && (
                      <SnapshotTable
                        title="Progress checkpoints"
                        headers={["Checkpoint", "Status", "Note"]}
                        rows={snap.progress.map((p: any) => [
                          `${p.checkpoint} days`, p.status ?? "—", p.note ?? "—",
                        ])}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SnapshotTable({
  title, headers, rows,
}: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left font-medium px-3 py-2 text-xs text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-2 align-top whitespace-pre-wrap">{String(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
