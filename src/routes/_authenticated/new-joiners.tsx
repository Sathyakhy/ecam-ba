import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, UserPlus, GraduationCap, Briefcase, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/new-joiners")({
  component: NewJoinersPage,
});

const NEW_HIRE_DAYS = 90;

function NewJoinersPage() {
  const [q, setQ] = useState("");

  const joiners = useQuery({
    queryKey: ["new-joiners"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - NEW_HIRE_DAYS * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,username,avatar_url,start_date,job_title,department")
        .or(`start_date.gte.${cutoff},start_date.is.null`)
        .order("start_date", { ascending: false, nullsFirst: false });
      return (data ?? []).filter((p) => p.start_date); // hide null start dates
    },
  });

  const ids = (joiners.data ?? []).map((p) => p.id);

  const onboarding = useQuery({
    queryKey: ["nj-onboarding", ids],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("onboarding_tasks")
      .select("profile_id,status").in("profile_id", ids)).data ?? [],
  });

  const learning = useQuery({
    queryKey: ["nj-learning", ids],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("training_assignments")
      .select("profile_id,status,material_id").in("profile_id", ids)).data ?? [],
  });

  const memberships = useQuery({
    queryKey: ["nj-memberships", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data: ms } = await supabase.from("project_members")
        .select("profile_id,project_id").in("profile_id", ids);
      const projectIds = Array.from(new Set((ms ?? []).map((m) => m.project_id)));
      const { data: projects } = projectIds.length
        ? await supabase.from("projects").select("id,name,status").in("id", projectIds)
        : { data: [] as { id: string; name: string; status: string }[] };
      return (ms ?? []).map((m) => ({
        profile_id: m.profile_id,
        project: projects?.find((p) => p.id === m.project_id),
      })).filter((x) => x.project);
    },
  });

  const filtered = (joiners.data ?? []).filter((p) =>
    !q || p.full_name.toLowerCase().includes(q.toLowerCase()) ||
    (p.job_title ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (p.department ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="New joiners"
        description={`Unified view of staff who started in the last ${NEW_HIRE_DAYS} days — onboarding, learning, and projects.`}
      />

      <div className="mb-4">
        <Input placeholder="Search by name, title, department…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No new joiners in the last {NEW_HIRE_DAYS} days.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const obTasks = (onboarding.data ?? []).filter((t) => t.profile_id === p.id);
            const obDone = obTasks.filter((t) => t.status === "completed").length;
            const obPct = obTasks.length ? Math.round((obDone / obTasks.length) * 100) : 0;

            const lrn = (learning.data ?? []).filter((t) => t.profile_id === p.id);
            const lrnDone = lrn.filter((t) => t.status === "completed").length;
            const lrnPct = lrn.length ? Math.round((lrnDone / lrn.length) * 100) : 0;

            const projects = (memberships.data ?? [])
              .filter((m) => m.profile_id === p.id).map((m) => m.project!);

            const tenureDays = p.start_date
              ? Math.floor((Date.now() - new Date(p.start_date).getTime()) / 86400000)
              : null;

            return (
              <Card key={p.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                    <AvatarFallback>{p.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <Link to="/staff" className="text-sm font-semibold hover:underline truncate block">{p.full_name}</Link>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {p.job_title ?? "—"}{p.department && ` · ${p.department}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Started {p.start_date ? new Date(p.start_date).toLocaleDateString() : "—"}
                      {tenureDays != null && ` · day ${tenureDays}`}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <SectionRow icon={UserPlus} label="Onboarding" pct={obPct} hint={`${obDone}/${obTasks.length}`}
                    href="/onboarding/$profileId" params={{ profileId: p.id }} />
                  <SectionRow icon={GraduationCap} label="Learning" pct={lrnPct} hint={`${lrnDone}/${lrn.length}`} />
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Briefcase className="h-3 w-3" /> Projects</span>
                      <Badge variant="outline" className="text-[10px]">{projects.length}</Badge>
                    </div>
                    {projects.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground pl-4">None assigned.</p>
                    ) : (
                      <ul className="pl-4 space-y-0.5">
                        {projects.slice(0, 4).map((pr) => (
                          <li key={pr.id} className="text-xs truncate">
                            <Link to="/projects/$projectId" params={{ projectId: pr.id }} className="hover:underline">
                              {pr.name}
                            </Link>
                            <span className="text-muted-foreground ml-1">({pr.status})</span>
                          </li>
                        ))}
                        {projects.length > 4 && <li className="text-[10px] text-muted-foreground">+{projects.length - 4} more</li>}
                      </ul>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionRow({ icon: Icon, label, pct, hint, href, params }: {
  icon: typeof UserPlus; label: string; pct: number; hint: string;
  href?: "/onboarding/$profileId"; params?: { profileId: string };
}) {
  const content = (
    <div className="flex items-center justify-between text-[11px]">
      <span className="inline-flex items-center gap-1 text-muted-foreground"><Icon className="h-3 w-3" /> {label}</span>
      <span className="text-muted-foreground">{hint}{href && <ArrowRight className="inline h-3 w-3 ml-1" />}</span>
    </div>
  );
  return (
    <div>
      {href && params ? <Link to={href} params={params} className="block hover:underline">{content}</Link> : content}
      <Progress value={pct} className="h-1 mt-1" />
    </div>
  );
}
