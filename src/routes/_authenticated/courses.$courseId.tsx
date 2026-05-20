import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, Circle, ExternalLink, Award,
  FileText, Video, Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { openCertificate } from "@/lib/certificate";
import { useAppSettings } from "@/hooks/use-app-settings";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  component: CourseDetailPage,
});

const ICON: Record<string, typeof FileText> = { document: FileText, video: Video, link: LinkIcon };

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const { profile, isAdmin, canEdit } = useAuth();
  const settings = useAppSettings();
  const canManage = isAdmin || canEdit("learning");
  const qc = useQueryClient();

  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => (await supabase.from("courses").select("*").eq("id", courseId).maybeSingle()).data,
  });

  const lessons = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: async () =>
      (await supabase.from("course_lessons").select("*").eq("course_id", courseId).order("order_index")).data ?? [],
  });

  const questions = useQuery({
    queryKey: ["course-questions", courseId],
    queryFn: async () =>
      (await supabase
        .from("course_quiz_questions")
        .select("*, options:course_quiz_options(*)")
        .eq("course_id", courseId)
        .order("order_index")).data ?? [],
  });

  const assignment = useQuery({
    queryKey: ["my-assignment", courseId, profile?.id],
    enabled: !!profile?.id,
    queryFn: async () =>
      (await supabase
        .from("course_assignments")
        .select("*")
        .eq("course_id", courseId)
        .eq("profile_id", profile!.id)
        .maybeSingle()).data,
  });

  const progress = useQuery({
    queryKey: ["lesson-progress", assignment.data?.id],
    enabled: !!assignment.data?.id,
    queryFn: async () =>
      (await supabase.from("course_lesson_progress").select("*").eq("assignment_id", assignment.data!.id)).data ?? [],
  });

  const attempts = useQuery({
    queryKey: ["quiz-attempts", assignment.data?.id],
    enabled: !!assignment.data?.id,
    queryFn: async () =>
      (await supabase
        .from("course_quiz_attempts")
        .select("*")
        .eq("assignment_id", assignment.data!.id)
        .order("attempted_at", { ascending: false })).data ?? [],
  });

  const certificate = useQuery({
    queryKey: ["certificate", assignment.data?.id],
    enabled: !!assignment.data?.id,
    queryFn: async () =>
      (await supabase.from("course_certificates").select("*").eq("assignment_id", assignment.data!.id).maybeSingle()).data,
  });

  const completedCount = progress.data?.length ?? 0;
  const totalLessons = lessons.data?.length ?? 0;
  const lessonPct = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;
  const bestScore = attempts.data?.length
    ? Math.max(...attempts.data.map((a) => Math.round((a.score / Math.max(a.total, 1)) * 100)))
    : 0;
  const passed = attempts.data?.some((a) => a.passed) ?? false;

  if (course.isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!course.data) return <div className="p-10 text-center text-muted-foreground">Course not found.</div>;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/courses"><ArrowLeft className="h-4 w-4 mr-1" /> Back to courses</Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{course.data.title}</h1>
            {course.data.description && <p className="text-muted-foreground mt-1 max-w-2xl">{course.data.description}</p>}
            <div className="flex gap-2 mt-2">
              <Badge variant={course.data.published ? "default" : "secondary"}>{course.data.published ? "Published" : "Draft"}</Badge>
              <Badge variant="outline">Pass {course.data.passing_score}%</Badge>
              {assignment.data && <Badge variant="outline">Assigned to you</Badge>}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue={assignment.data ? "learn" : "lessons"}>
        <TabsList>
          <TabsTrigger value="learn" disabled={!assignment.data && !canManage}>Learn</TabsTrigger>
          <TabsTrigger value="lessons">Lessons</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
          {canManage && <TabsTrigger value="assign">Assignments</TabsTrigger>}
          {canManage && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="learn" className="mt-4">
          {!assignment.data ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              You are not assigned to this course yet.
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Your progress</p>
                    <p className="text-xs text-muted-foreground">{completedCount} of {totalLessons} lessons • Best quiz: {bestScore}%</p>
                  </div>
                  {certificate.data ? (
                    <Button
                      onClick={() => openCertificate({
                        recipientName: profile?.full_name ?? "Learner",
                        courseTitle: course.data!.title,
                        issuedAt: certificate.data!.issued_at,
                        certificateNo: certificate.data!.certificate_no,
                        organization: settings.app_name,
                        backgroundUrl: course.data!.certificate_bg_url ?? settings.default_certificate_bg_url ?? null,
                      })}
                    >
                      <Award className="h-4 w-4 mr-1" /> View certificate
                    </Button>
                  ) : passed ? (
                    <Button
                      onClick={async () => {
                        const certNo = `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
                        const { data, error } = await supabase
                          .from("course_certificates")
                          .insert({ assignment_id: assignment.data!.id, certificate_no: certNo })
                          .select()
                          .single();
                        if (error) return toast.error(error.message);
                        await supabase.from("course_assignments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", assignment.data!.id);
                        toast.success("Certificate issued");
                        qc.invalidateQueries({ queryKey: ["certificate", assignment.data!.id] });
                        qc.invalidateQueries({ queryKey: ["my-assignment", courseId, profile?.id] });
                        openCertificate({
                          recipientName: profile?.full_name ?? "Learner",
                          courseTitle: course.data!.title,
                          issuedAt: data.issued_at,
                          certificateNo: data.certificate_no,
                          organization: settings.app_name,
                          backgroundUrl: course.data!.certificate_bg_url ?? settings.default_certificate_bg_url ?? null,
                        });
                      }}
                    >
                      <Award className="h-4 w-4 mr-1" /> Generate certificate
                    </Button>
                  ) : null}
                </div>
                <Progress className="mt-3" value={lessonPct} />
              </Card>

              <Card>
                <ul className="divide-y divide-border">
                  {lessons.data?.map((l) => {
                    const done = progress.data?.some((p) => p.lesson_id === l.id);
                    const Icon = ICON[l.material_type] ?? FileText;
                    return (
                      <li key={l.id} className="p-4 flex items-start gap-3">
                        <button
                          className="mt-0.5"
                          onClick={async () => {
                            if (done) {
                              await supabase.from("course_lesson_progress").delete().eq("assignment_id", assignment.data!.id).eq("lesson_id", l.id);
                            } else {
                              await supabase.from("course_lesson_progress").insert({ assignment_id: assignment.data!.id, lesson_id: l.id });
                              if (assignment.data!.status === "assigned") {
                                await supabase.from("course_assignments").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", assignment.data!.id);
                                qc.invalidateQueries({ queryKey: ["my-assignment", courseId, profile?.id] });
                              }
                            }
                            qc.invalidateQueries({ queryKey: ["lesson-progress", assignment.data!.id] });
                          }}
                        >
                          {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <p className="font-medium text-sm">{l.title}</p>
                          </div>
                          {l.content && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{l.content}</p>}
                          {l.url && (
                            <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                              <ExternalLink className="h-3 w-3" /> Open material
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {lessons.data?.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No lessons yet.</li>}
                </ul>
              </Card>

              {lessonPct === 100 && questions.data && questions.data.length > 0 && (
                <QuizCard
                  questions={questions.data}
                  assignmentId={assignment.data.id}
                  passingScore={course.data.passing_score}
                  onSubmitted={() => {
                    qc.invalidateQueries({ queryKey: ["quiz-attempts", assignment.data!.id] });
                  }}
                />
              )}

              {attempts.data && attempts.data.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-medium text-sm mb-2">Quiz attempts</h3>
                  <ul className="text-sm divide-y divide-border">
                    {attempts.data.map((a) => (
                      <li key={a.id} className="py-2 flex items-center justify-between">
                        <span>{new Date(a.attempted_at).toLocaleString()}</span>
                        <Badge variant={a.passed ? "default" : "destructive"}>
                          {Math.round((a.score / Math.max(a.total, 1)) * 100)}% • {a.passed ? "Passed" : "Failed"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lessons" className="mt-4 space-y-4">
          {canManage && <LessonEditor courseId={courseId} onChanged={() => qc.invalidateQueries({ queryKey: ["course-lessons", courseId] })} />}
          <Card>
            <ul className="divide-y divide-border">
              {lessons.data?.map((l, i) => {
                const Icon = ICON[l.material_type] ?? FileText;
                return (
                  <li key={l.id} className="p-4 flex items-start gap-3">
                    <span className="text-xs text-muted-foreground mt-1 w-6">{i + 1}.</span>
                    <Icon className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{l.title}</p>
                      {l.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{l.content}</p>}
                      {l.url && <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{l.url}</a>}
                    </div>
                    {canManage && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        await supabase.from("course_lessons").delete().eq("id", l.id);
                        qc.invalidateQueries({ queryKey: ["course-lessons", courseId] });
                      }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    )}
                  </li>
                );
              })}
              {lessons.data?.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No lessons.</li>}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="quiz" className="mt-4 space-y-4">
          {canManage && <QuestionEditor courseId={courseId} onChanged={() => qc.invalidateQueries({ queryKey: ["course-questions", courseId] })} />}
          <div className="space-y-3">
            {questions.data?.map((q: any, i: number) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{i + 1}. {q.question}</p>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                      await supabase.from("course_quiz_questions").delete().eq("id", q.id);
                      qc.invalidateQueries({ queryKey: ["course-questions", courseId] });
                    }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {(q.options ?? []).sort((a: any, b: any) => a.order_index - b.order_index).map((o: any) => (
                    <li key={o.id} className={`flex items-center gap-2 ${o.is_correct && canManage ? "text-primary font-medium" : ""}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {o.label}
                      {canManage && o.is_correct && <Badge variant="outline" className="text-xs">correct</Badge>}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
            {questions.data?.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No quiz questions yet.</Card>}
          </div>
        </TabsContent>

        {canManage && (
          <TabsContent value="assign" className="mt-4">
            <AssignmentsPanel courseId={courseId} />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="settings" className="mt-4">
            <CourseSettings course={course.data} onSaved={() => qc.invalidateQueries({ queryKey: ["course", courseId] })} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function LessonEditor({ courseId, onChanged }: { courseId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("document");
  const [url, setUrl] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add lesson</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New lesson</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { count } = await supabase.from("course_lessons").select("*", { count: "exact", head: true }).eq("course_id", courseId);
          const { error } = await supabase.from("course_lessons").insert({
            course_id: courseId, title, content: content || null, material_type: type, url: url || null, order_index: count ?? 0,
          });
          if (error) return toast.error(error.message);
          toast.success("Lesson added"); setOpen(false); setTitle(""); setContent(""); setUrl(""); setType("document");
          onChanged();
        }} className="space-y-3">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Content / instructions</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={5000} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>URL</Label><Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" maxLength={500} /></div>
          </div>
          <DialogFooter><Button type="submit">Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuestionEditor({ courseId, onChanged }: { courseId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<{ label: string; is_correct: boolean }[]>([
    { label: "", is_correct: true }, { label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false },
  ]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add question</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New quiz question</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const cleaned = options.filter((o) => o.label.trim().length > 0);
          if (cleaned.length < 2) return toast.error("At least 2 options required");
          if (!cleaned.some((o) => o.is_correct)) return toast.error("Mark at least one correct answer");
          const { count } = await supabase.from("course_quiz_questions").select("*", { count: "exact", head: true }).eq("course_id", courseId);
          const { data: q, error } = await supabase
            .from("course_quiz_questions")
            .insert({ course_id: courseId, question, order_index: count ?? 0 })
            .select().single();
          if (error || !q) return toast.error(error?.message ?? "Failed");
          const { error: oErr } = await supabase.from("course_quiz_options").insert(
            cleaned.map((o, i) => ({ question_id: q.id, label: o.label, is_correct: o.is_correct, order_index: i })),
          );
          if (oErr) return toast.error(oErr.message);
          toast.success("Question added");
          setOpen(false); setQuestion("");
          setOptions([{ label: "", is_correct: true }, { label: "", is_correct: false }, { label: "", is_correct: false }, { label: "", is_correct: false }]);
          onChanged();
        }} className="space-y-3">
          <div className="space-y-2"><Label>Question</Label><Textarea value={question} onChange={(e) => setQuestion(e.target.value)} required rows={2} maxLength={500} /></div>
          <div className="space-y-2">
            <Label>Options (check correct answers)</Label>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Checkbox checked={o.is_correct} onCheckedChange={(v) => {
                  const next = [...options]; next[i].is_correct = !!v; setOptions(next);
                }} />
                <Input
                  value={o.label}
                  onChange={(e) => { const next = [...options]; next[i].label = e.target.value; setOptions(next); }}
                  placeholder={`Option ${i + 1}`}
                  maxLength={300}
                />
              </div>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => setOptions([...options, { label: "", is_correct: false }])}>
              <Plus className="h-3 w-3 mr-1" /> Add option
            </Button>
          </div>
          <DialogFooter><Button type="submit">Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuizCard({
  questions, assignmentId, passingScore, onSubmitted,
}: { questions: any[]; assignmentId: string; passingScore: number; onSubmitted: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);

  const toggle = (qid: string, oid: string, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[qid] ?? [];
      if (!multi) return { ...prev, [qid]: [oid] };
      return { ...prev, [qid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
    });
  };

  return (
    <Card className="p-4">
      <h3 className="font-medium mb-1">Final quiz</h3>
      <p className="text-xs text-muted-foreground mb-4">Score {passingScore}% or higher to earn your certificate.</p>
      <div className="space-y-4">
        {questions.map((q, i) => {
          const opts = (q.options ?? []).slice().sort((a: any, b: any) => a.order_index - b.order_index);
          const correctCount = opts.filter((o: any) => o.is_correct).length;
          const multi = correctCount > 1;
          return (
            <div key={q.id}>
              <p className="font-medium text-sm">{i + 1}. {q.question} {multi && <span className="text-xs text-muted-foreground">(select all that apply)</span>}</p>
              <div className="mt-2 space-y-1">
                {opts.map((o: any) => {
                  const checked = (answers[q.id] ?? []).includes(o.id);
                  return (
                    <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={() => toggle(q.id, o.id, multi)} />
                      <span>{o.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {result && (
        <div className={`mt-4 p-3 rounded-md text-sm ${result.passed ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
          You scored {Math.round((result.score / Math.max(result.total, 1)) * 100)}% ({result.score}/{result.total}).{" "}
          {result.passed ? "You passed! Generate your certificate above." : "Try again to reach the passing score."}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            let score = 0;
            for (const q of questions) {
              const opts = q.options ?? [];
              const correctIds = opts.filter((o: any) => o.is_correct).map((o: any) => o.id).sort();
              const chosen = (answers[q.id] ?? []).slice().sort();
              if (correctIds.length === chosen.length && correctIds.every((id: string, i: number) => id === chosen[i])) {
                score += 1;
              }
            }
            const total = questions.length;
            const pct = Math.round((score / Math.max(total, 1)) * 100);
            const passed = pct >= passingScore;
            const { error } = await supabase.from("course_quiz_attempts").insert({
              assignment_id: assignmentId, score, total, passed, answers,
            });
            setSubmitting(false);
            if (error) return toast.error(error.message);
            setResult({ score, total, passed });
            toast[passed ? "success" : "error"](`Scored ${pct}%`);
            onSubmitted();
          }}
        >Submit quiz</Button>
      </div>
    </Card>
  );
}

function AssignmentsPanel({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [staffId, setStaffId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const staff = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name").order("full_name")).data ?? [],
  });

  // No FK defined between course_assignments.profile_id and profiles — manual join below.
  const assignmentsFallback = useQuery({
    queryKey: ["course-assignments-fallback", courseId, staff.data?.length],
    enabled: !!staff.data,
    queryFn: async () => {
      const rows = (await supabase.from("course_assignments").select("*").eq("course_id", courseId).order("assigned_at", { ascending: false })).data ?? [];
      const ids = rows.map((r) => r.id);
      const certs = ids.length ? (await supabase.from("course_certificates").select("*").in("assignment_id", ids)).data ?? [] : [];
      return rows.map((r) => ({
        ...r,
        profile: staff.data?.find((s) => s.id === r.profile_id),
        certificate: certs.find((c) => c.assignment_id === r.id),
      }));
    },
  });

  const list = assignmentsFallback.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-medium text-sm mb-3">Assign to employee</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!staffId) return;
            const { error } = await supabase.from("course_assignments").insert({
              course_id: courseId, profile_id: staffId, due_date: dueDate || null,
              assigned_by: (await supabase.auth.getUser()).data.user?.id,
            });
            if (error) return toast.error(error.message);
            toast.success("Assigned");
            setStaffId(""); setDueDate("");
            qc.invalidateQueries({ queryKey: ["course-assignments-fallback", courseId] });
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label>Staff</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>{staff.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button type="submit">Assign</Button>
        </form>
      </Card>

      <Card>
        {list.length ? (
          <ul className="divide-y divide-border">
            {list.map((a: any) => (
              <li key={a.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{a.profile?.full_name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    Assigned {new Date(a.assigned_at).toLocaleDateString()}
                    {a.due_date && ` • Due ${new Date(a.due_date).toLocaleDateString()}`}
                    {a.completed_at && ` • Completed ${new Date(a.completed_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Badge variant={a.status === "completed" ? "default" : a.status === "in_progress" ? "secondary" : "outline"}>{a.status}</Badge>
                {a.certificate && <Badge variant="secondary" className="gap-1"><Award className="h-3 w-3" /> {a.certificate.certificate_no}</Badge>}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                  if (!confirm("Remove this assignment?")) return;
                  const { error } = await supabase.from("course_assignments").delete().eq("id", a.id);
                  if (error) return toast.error(error.message);
                  qc.invalidateQueries({ queryKey: ["course-assignments-fallback", courseId] });
                }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">No assignments yet.</p>
        )}
      </Card>
    </div>
  );
}

function CourseSettings({ course, onSaved }: { course: any; onSaved: () => void }) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [passing, setPassing] = useState<number>(course.passing_score);
  const [published, setPublished] = useState<boolean>(course.published);
  const [autoAssign, setAutoAssign] = useState<boolean>(!!course.auto_assign_new_joiners);
  return (
    <Card className="p-4 space-y-3 max-w-xl">
      <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></div>
      <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={1000} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Passing score (%)</Label>
          <Input type="number" min={1} max={100} value={passing} onChange={(e) => setPassing(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Published</Label>
          <div className="flex items-center gap-2 h-9"><Switch checked={published} onCheckedChange={setPublished} /></div>
        </div>
      </div>
      <div className="space-y-1 rounded-md border p-3">
        <div className="flex items-center justify-between gap-3">
          <Label className="cursor-pointer">Auto-assign to new joiners</Label>
          <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
        </div>
        <p className="text-xs text-muted-foreground">
          When enabled, any newly created staff profile will be automatically assigned this course (only if published).
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={async () => {
          const { error } = await supabase.from("courses").update({
            title, description: description || null, passing_score: passing, published,
            auto_assign_new_joiners: autoAssign,
          }).eq("id", course.id);
          if (error) return toast.error(error.message);
          toast.success("Saved"); onSaved();
        }}>Save</Button>
      </div>
    </Card>
  );
}
