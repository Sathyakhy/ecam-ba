import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingRoute,
});

const isNewHire = (start: string | null | undefined) => {
  if (!start) return true;
  const ms = Date.now() - new Date(start).getTime();
  return ms < 1000 * 60 * 60 * 24 * 30 * 3;
};

function tenureDays(start: string | null | undefined) {
  if (!start) return null;
  const days = Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
  return days;
}

function OnboardingRoute() {
  const location = useLocation();
  const isListRoute = location.pathname.replace(/\/+$/, "") === "/onboarding";

  return isListRoute ? <OnboardingPage /> : <Outlet />;
}

function OnboardingPage() {
  const { isAdmin, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const staffQ = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,full_name,username,avatar_url,start_date,job_title,department").order("full_name")).data ?? [],
  });

  const plansQ = useQuery({
    queryKey: ["onboarding-plans"],
    queryFn: async () => (await supabase.from("onboarding_plans").select("id,profile_id,assignee_id")).data ?? [],
  });

  const newHires = useMemo(
    () => (staffQ.data ?? []).filter((s) => isNewHire(s.start_date)),
    [staffQ.data],
  );
  const planByProfile = useMemo(() => {
    const m = new Map<string, string>();
    (plansQ.data ?? []).forEach((p) => m.set(p.profile_id, p.id));
    return m;
  }, [plansQ.data]);

  // Non-admins only see their own card or cards where they have access to the plan.
  const visibleHires = useMemo(() => {
    if (isAdmin) return newHires;
    return newHires.filter((s) => s.id === profile?.id || planByProfile.has(s.id));
  }, [newHires, planByProfile, isAdmin, profile?.id]);

  const createPlan = async (profileId: string, fullName: string, jobTitle: string | null) => {
    const { data: plan, error } = await supabase
      .from("onboarding_plans")
      .insert({
        profile_id: profileId,
        welcome_message: `Welcome to the team, ${fullName}!`,
        intern_position: jobTitle ?? "",
      })
      .select("id")
      .single();
    if (error || !plan) return toast.error(error?.message ?? "Failed to create plan");

    // Seed default sections
    const sections = [
      {
        title: "Welcome & Orientation",
        body: "- Familiarize yourself with the company and your department.\n- Complete onboarding assessments and share with your point of contact.",
      },
      {
        title: "Setup with Tools",
        body: "List the tools the new hire will use:\n- Email (Outlook)\n- Documents (Microsoft Office)\n- Communication (Telegram, WhatsApp, Microsoft Teams)\n- Storage (OneDrive)",
      },
      {
        title: "Internship / Onboarding Goals",
        body: "- Gain an understanding of our business, services, and clients.\n- Learn about projects, tools, and workflows.\n- Develop familiarity with how the department operates.",
      },
      {
        title: "How You Contribute",
        body: "- Learn project coordination by shadowing your senior.\n- Support implementation and documentation.\n- Help troubleshoot issues under supervision.\n- Collaborate with mentors and the team.",
      },
      {
        title: "Expected Outcomes",
        body: "- Exposure to enterprise systems and project workflows.\n- Skills in documentation, testing, and support.\n- Stronger communication and collaboration in a professional environment.",
      },
    ].map((s, i) => ({ ...s, plan_id: plan.id, order_index: i }));
    await supabase.from("onboarding_sections").insert(sections);

    // Seed evaluations
    const evals = [
      ["Documentation Skills", "Clarity, accuracy, consistency."],
      ["Technical Support", "Ability to assist in troubleshooting/testing."],
      ["Coordination", "Understanding workflows, task tracking."],
      ["Communication", "Professional emails, reporting, teamwork."],
      ["Collaboration", "Working with mentors and colleagues."],
      ["Initiative", "Willingness to learn, propose improvements."],
    ].map(([area, description], i) => ({
      plan_id: plan.id, area, description, order_index: i,
    }));
    await supabase.from("onboarding_evaluations").insert(evals);

    // Seed expectations
    const expectations = [
      "Attendance & Punctuality",
      "Adaptability & Learning",
      "Confidentiality & Awareness",
      "Workplace Conduct",
    ].map((area, i) => ({ plan_id: plan.id, area, order_index: i }));
    await supabase.from("onboarding_expectations").insert(expectations);

    // Seed reflections (4 questions × 3 checkpoints)
    const questions = [
      "What have I learned so far?",
      "What challenges did I face, and how did I overcome them?",
      "What strengths have I discovered in myself?",
      "What skills do I want to improve next?",
    ];
    const reflections = ([30, 60, 90] as const).flatMap((cp) =>
      questions.map((question, i) => ({ plan_id: plan.id, checkpoint: cp, question, order_index: i })),
    );
    await supabase.from("onboarding_reflections").insert(reflections);

    // Seed progress checkpoints
    const progress = [
      { checkpoint: 30, note: "Orientation complete, basic tasks observed/documented." },
      { checkpoint: 60, note: "Independent contribution to small tasks/projects." },
      { checkpoint: 90, note: "Demonstrated growth, presented reflection or project, ready for review." },
    ].map((p, i) => ({ ...p, plan_id: plan.id, order_index: i }));
    await supabase.from("onboarding_progress").insert(progress);

    toast.success("Plan created");
    qc.invalidateQueries({ queryKey: ["onboarding-plans"] });
  };

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Structured onboarding plans for new staff (first 3 months)."
      />

      {visibleHires.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No onboarding plans you can view right now.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleHires.map((s) => {
            const planId = planByProfile.get(s.id);
            const days = tenureDays(s.start_date);
            const initials = s.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
            return (
              <Card key={s.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.full_name} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.job_title ?? "—"}{s.department ? ` · ${s.department}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {days != null ? `Day ${days + 1}` : "No start date"}
                  </Badge>
                  {planId ? (
                    <Badge className="text-[10px]">Plan ready</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">No plan yet</Badge>
                  )}
                </div>
                {planId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-auto"
                    onClick={() => navigate({ to: "/onboarding/$profileId", params: { profileId: s.id } })}
                  >
                    Open plan <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                ) : isAdmin ? (
                  <Button size="sm" className="mt-auto" onClick={() => createPlan(s.id, s.full_name, s.job_title)}>
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Create plan from template
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground mt-auto">Awaiting admin to create plan.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
