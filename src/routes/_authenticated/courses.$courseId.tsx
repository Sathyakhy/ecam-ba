import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, Circle, ExternalLink, Award,
  FileText, Video, Link as LinkIcon, Image as ImageIcon, NotebookText, File,
  Users, BookOpen, ClipboardList, Settings as SettingsIcon, ListChecks, GripVertical, Download,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";
import { openCertificate } from "@/lib/certificate";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: (s.tab as string) || undefined }),
  component: CourseDetailPage,
});

const TYPE_ICON: Record<string, any> = {
  video: Video, pdf: FileText, image: ImageIcon, link: LinkIcon, text: NotebookText, file: File,
};

function youtubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean).pop()}`;
  } catch {}
  return null;
}

function uploadCourseMaterialWithProgress(
  path: string,
  file: File,
  token: string,
  onProgress: (value: number) => void,
) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !apiKey) throw new Error("Storage is not configured.");

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const uploadUrl = `${baseUrl}/storage/v1/object/course-materials/${encodedPath}`;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      try {
        const body = JSON.parse(xhr.responseText);
        reject(new Error(body.message || body.error || "Upload failed"));
      } catch {
        reject(new Error(xhr.responseText || "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Please check your connection and try again."));
    xhr.send(file);
  });
}

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { isAdmin, canEdit } = useAuth();
  const canManage = isAdmin || canEdit("learning");
  const currentTab = tab || (canManage ? "content" : "learn");

  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () =>
      (await supabase.from("courses").select("*, category:course_categories(id, name)").eq("id", courseId).maybeSingle()).data,
  });

  if (course.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!course.data) return <div className="p-8">Course not found. <Link to="/courses" className="underline">Back</Link></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/courses"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">{course.data.title}</h1>
          {!course.data.published && <Badge variant="outline">Draft</Badge>}
          {course.data.category?.name && <Badge variant="secondary">{course.data.category.name}</Badge>}
        </div>
        {course.data.description && <p className="text-muted-foreground">{course.data.description}</p>}
      </div>

      <Tabs
        value={currentTab}
        onValueChange={(value) => navigate({ to: "/courses/$courseId", params: { courseId }, search: { tab: value }, replace: true })}
      >
        <TabsList>
          <TabsTrigger value="learn"><BookOpen className="h-3 w-3 mr-1" />Learn</TabsTrigger>
          {canManage && <TabsTrigger value="content"><ListChecks className="h-3 w-3 mr-1" />Content</TabsTrigger>}
          {canManage && <TabsTrigger value="quiz"><ClipboardList className="h-3 w-3 mr-1" />Quiz</TabsTrigger>}
          {canManage && <TabsTrigger value="enrollments"><Users className="h-3 w-3 mr-1" />Enrollments</TabsTrigger>}
          {canManage && <TabsTrigger value="settings"><SettingsIcon className="h-3 w-3 mr-1" />Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="learn"><LearnerView course={course.data} /></TabsContent>
        {canManage && <TabsContent value="content"><ContentEditor courseId={courseId} /></TabsContent>}
        {canManage && <TabsContent value="quiz"><QuizEditor courseId={courseId} /></TabsContent>}
        {canManage && <TabsContent value="enrollments"><EnrollmentsTab courseId={courseId} /></TabsContent>}
        {canManage && <TabsContent value="settings"><CourseSettings course={course.data} /></TabsContent>}
      </Tabs>
    </div>
  );
}

/* ============================================================
 * LEARNER VIEW
 * ============================================================ */
function LearnerView({ course }: { course: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const enrollment = useQuery({
    queryKey: ["enrollment", course.id, profile?.id],
    enabled: !!profile?.id,
    queryFn: async () =>
      (await supabase.from("course_enrollments").select("*").eq("course_id", course.id).eq("profile_id", profile!.id).maybeSingle()).data,
  });

  const modules = useQuery({
    queryKey: ["course-content", course.id],
    queryFn: async () => {
      const { data: mods } = await supabase.from("course_modules").select("*").eq("course_id", course.id).order("order_index");
      if (!mods?.length) return [];
      const { data: lessons } = await supabase.from("course_lessons").select("*").eq("course_id", course.id).order("order_index");
      return mods.map((m) => ({ ...m, lessons: (lessons ?? []).filter((l) => l.module_id === m.id) }));
    },
  });

  const progress = useQuery({
    queryKey: ["lesson-progress", enrollment.data?.id],
    enabled: !!enrollment.data?.id,
    queryFn: async () =>
      (await supabase.from("course_lesson_progress").select("*").eq("enrollment_id", enrollment.data!.id)).data ?? [],
  });

  const attempts = useQuery({
    queryKey: ["quiz-attempts", enrollment.data?.id],
    enabled: !!enrollment.data?.id,
    queryFn: async () =>
      (await supabase.from("course_quiz_attempts").select("*").eq("enrollment_id", enrollment.data!.id).order("attempted_at", { ascending: false })).data ?? [],
  });

  const certificate = useQuery({
    queryKey: ["certificate", enrollment.data?.id],
    enabled: !!enrollment.data?.id,
    queryFn: async () =>
      (await supabase.from("course_certificates").select("*").eq("enrollment_id", enrollment.data!.id).maybeSingle()).data,
  });

  const prereqs = useQuery({
    queryKey: ["prereqs", course.id],
    queryFn: async () => (await supabase
      .from("course_prerequisites")
      .select("prerequisite_course_id, prerequisite:courses!course_prerequisites_prerequisite_course_id_fkey(id, title)")
      .eq("course_id", course.id)).data ?? [],
  });

  const prereqEnrollments = useQuery({
    queryKey: ["prereq-enrollments", profile?.id, course.id],
    enabled: !!profile?.id && (prereqs.data?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = (prereqs.data ?? []).map((p) => p.prerequisite_course_id);
      const { data } = await supabase.from("course_enrollments").select("course_id, status").eq("profile_id", profile!.id).in("course_id", ids);
      return data ?? [];
    },
  });

  const enroll = async () => {
    if (!profile?.id) return;
    const { error } = await supabase.from("course_enrollments").insert({
      course_id: course.id, profile_id: profile.id, source: "manual", status: "enrolled",
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["enrollment"] });
  };

  if (!enrollment.data) {
    return (
      <Card className="p-6 text-center">
        <p className="mb-3 text-sm text-muted-foreground">You're not enrolled in this course yet.</p>
        <Button onClick={enroll}>Enroll now</Button>
      </Card>
    );
  }

  // Check prerequisites
  const unmetPrereqs = (prereqs.data ?? []).filter((p) =>
    !(prereqEnrollments.data ?? []).some((e) => e.course_id === p.prerequisite_course_id && e.status === "completed")
  );

  if (unmetPrereqs.length > 0) {
    return (
      <Card className="p-6">
        <div className="font-semibold mb-2">Complete prerequisites first</div>
        <ul className="space-y-1">
          {unmetPrereqs.map((p: any) => (
            <li key={p.prerequisite_course_id} className="text-sm">
              <Link to="/courses/$courseId" params={{ courseId: p.prerequisite_course_id }} className="underline">
                {p.prerequisite?.title}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const completedLessonIds = new Set((progress.data ?? []).map((p) => p.lesson_id));
  const allLessons = (modules.data ?? []).flatMap((m) => m.lessons);
  const lessonsDone = allLessons.length > 0 && allLessons.every((l) => completedLessonIds.has(l.id));
  const bestAttempt = (attempts.data ?? []).reduce<any>((b, a) => (!b || a.score / a.total > b.score / b.total ? a : b), null);
  const passed = bestAttempt?.passed;

  const completionMet =
    course.completion_criteria === "all_lessons" ? lessonsDone :
    course.completion_criteria === "both" ? lessonsDone && passed :
    passed;

  const toggleLesson = async (lessonId: string) => {
    if (completedLessonIds.has(lessonId)) {
      await supabase.from("course_lesson_progress").delete().eq("enrollment_id", enrollment.data!.id).eq("lesson_id", lessonId);
    } else {
      await supabase.from("course_lesson_progress").insert({ enrollment_id: enrollment.data!.id, lesson_id: lessonId });
    }
    if (enrollment.data!.status === "enrolled") {
      await supabase.from("course_enrollments").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", enrollment.data!.id);
    }
    qc.invalidateQueries({ queryKey: ["lesson-progress"] });
    qc.invalidateQueries({ queryKey: ["enrollment"] });
  };

  const issueCert = async () => {
    if (!enrollment.data || !profile) return;
    let cert = certificate.data;
    if (!cert) {
      const certNo = `CERT-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from("course_certificates")
        .insert({ enrollment_id: enrollment.data.id, certificate_no: certNo })
        .select().single();
      if (error) return toast.error(error.message);
      cert = data;
      await supabase.from("course_enrollments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", enrollment.data.id);
      qc.invalidateQueries({ queryKey: ["certificate"] });
      qc.invalidateQueries({ queryKey: ["enrollment"] });
    }
    openCertificate({
      recipientName: profile.full_name ?? profile.username,
      courseTitle: course.title,
      issuedAt: cert!.issued_at,
      certificateNo: cert!.certificate_no,
      backgroundUrl: course.certificate_bg_url,
    });
  };

  const completedCount = allLessons.filter((l) => completedLessonIds.has(l.id)).length;
  const lessonProgress = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        {(modules.data ?? []).length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No content yet.</Card>
        ) : (
          (modules.data ?? []).map((m, i) => (
            <Card key={m.id} className="p-4 space-y-3">
              <div>
                <div className="font-semibold">{i + 1}. {m.title}</div>
                {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
              </div>
              {m.lessons.length === 0 ? (
                <p className="text-xs text-muted-foreground">No lessons.</p>
              ) : (
                m.lessons.map((l: any) => {
                  const done = completedLessonIds.has(l.id);
                  const Icon = TYPE_ICON[l.material_type] ?? FileText;
                  return (
                    <Card key={l.id} className="p-3 bg-muted/40">
                      <div className="flex items-start gap-2 mb-2">
                        <button onClick={() => toggleLesson(l.id)} className="mt-0.5">
                          {done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Icon className="h-3.5 w-3.5" /> {l.title}
                          </div>
                          <LessonMaterial lesson={l} />
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </Card>
          ))
        )}

        <QuizRunner courseId={course.id} enrollment={enrollment.data} passingScore={course.passing_score} />
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Lesson progress</div>
          <Progress value={lessonProgress} className="mb-2" />
          <div className="text-xs">{completedCount}/{allLessons.length} lessons</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Best quiz score</div>
          <div className="text-2xl font-semibold">
            {bestAttempt ? `${Math.round((bestAttempt.score / bestAttempt.total) * 100)}%` : "—"}
          </div>
          <div className="text-xs text-muted-foreground">Pass at {course.passing_score}%</div>
        </Card>
        {completionMet && (
          <Card className="p-4">
            <Button className="w-full" onClick={issueCert}>
              <Award className="h-4 w-4 mr-2" />
              {certificate.data ? "View certificate" : "Get certificate"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function LessonMaterial({ lesson }: { lesson: any }) {
  const { material_type: t, url, content, downloadable } = lesson;
  if (t === "pdf" && url) return (
    <div className="mt-2">
      <iframe src={url} className="w-full h-96 border rounded" />
      {downloadable && <a href={url} target="_blank" rel="noopener" className="text-xs underline mt-1 inline-block">Download PDF</a>}
    </div>
  );
  if (t === "image" && url) return <img src={url} alt={lesson.title} className="mt-2 max-w-full rounded border" />;
  if (t === "video" && url) {
    const embed = youtubeEmbed(url);
    return embed
      ? <iframe src={embed} className="mt-2 w-full aspect-video rounded border" allowFullScreen />
      : <video src={url} controls className="mt-2 w-full rounded border" />;
  }
  if (t === "link" && url) return (
    <a href={url} target="_blank" rel="noopener" className="text-xs underline text-primary inline-flex items-center gap-1 mt-1">
      <ExternalLink className="h-3 w-3" /> {url}
    </a>
  );
  if (t === "file" && url) return (
    <a href={url} target="_blank" rel="noopener" className="text-xs underline text-primary inline-flex items-center gap-1 mt-1">
      <Download className="h-3 w-3" /> Download
    </a>
  );
  if (t === "text" && content) return <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{content}</p>;
  return null;
}

/* ============================================================
 * QUIZ RUNNER (learner)
 * ============================================================ */
function QuizRunner({ courseId, enrollment, passingScore }: { courseId: string; enrollment: any; passingScore: number }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);

  const questions = useQuery({
    queryKey: ["quiz-q", courseId],
    queryFn: async () => {
      const { data: qs } = await supabase.from("course_quiz_questions").select("*").eq("course_id", courseId).order("order_index");
      if (!qs?.length) return [];
      const { data: opts } = await supabase.from("course_quiz_options").select("*").in("question_id", qs.map((q) => q.id)).order("order_index");
      return qs.map((q) => ({ ...q, options: (opts ?? []).filter((o) => o.question_id === q.id) }));
    },
  });

  if (!questions.data || questions.data.length === 0) return null;

  const submit = async () => {
    let score = 0;
    for (const q of questions.data!) {
      const chosenId = answers[q.id];
      const correct = q.options.find((o: any) => o.is_correct)?.id;
      if (chosenId && chosenId === correct) score++;
    }
    const total = questions.data!.length;
    const pct = Math.round((score / total) * 100);
    const passed = pct >= passingScore;
    await supabase.from("course_quiz_attempts").insert({
      enrollment_id: enrollment.id, score, total, passed, answers,
    });
    setShowResult({ score, total, passed });
    qc.invalidateQueries({ queryKey: ["quiz-attempts"] });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="font-semibold flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Final quiz</div>
      {showResult ? (
        <div className="text-center py-4">
          <div className="text-3xl font-bold">{Math.round((showResult.score / showResult.total) * 100)}%</div>
          <div className="text-sm text-muted-foreground mb-3">{showResult.score}/{showResult.total} correct</div>
          <Badge variant={showResult.passed ? "default" : "destructive"}>{showResult.passed ? "Passed" : "Failed"}</Badge>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => { setShowResult(null); setAnswers({}); }}>Try again</Button>
          </div>
        </div>
      ) : (
        <>
          {questions.data.map((q, i) => (
            <div key={q.id} className="space-y-2">
              <div className="font-medium text-sm">{i + 1}. {q.question}</div>
              <div className="space-y-1.5 pl-2">
                {q.options.map((o: any) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name={q.id} checked={answers[q.id] === o.id}
                      onChange={() => setAnswers({ ...answers, [q.id]: o.id })} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={submit} disabled={Object.keys(answers).length < questions.data.length}>Submit quiz</Button>
        </>
      )}
    </Card>
  );
}

/* ============================================================
 * CONTENT EDITOR (admin)
 * ============================================================ */
function ContentEditor({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [moduleTitle, setModuleTitle] = useState("");

  const modules = useQuery({
    queryKey: ["modules-edit", courseId],
    queryFn: async () => (await supabase.from("course_modules").select("*").eq("course_id", courseId).order("order_index")).data ?? [],
  });

  const lessons = useQuery({
    queryKey: ["lessons-edit", courseId],
    queryFn: async () => (await supabase.from("course_lessons").select("*").eq("course_id", courseId).order("order_index")).data ?? [],
  });

  const addModule = async () => {
    if (!moduleTitle.trim()) return;
    const order = (modules.data?.length ?? 0);
    const { error } = await supabase.from("course_modules").insert({ course_id: courseId, title: moduleTitle.trim(), order_index: order });
    if (error) return toast.error(error.message);
    toast.success("Module added");
    setModuleTitle("");
    qc.invalidateQueries({ queryKey: ["modules-edit"] });
    qc.invalidateQueries({ queryKey: ["course-content"] });
  };

  const removeModule = async (id: string) => {
    if (!confirm("Delete module and its lessons?")) return;
    const { error } = await supabase.from("course_modules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["modules-edit"] });
    qc.invalidateQueries({ queryKey: ["lessons-edit"] });
    qc.invalidateQueries({ queryKey: ["course-content"] });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-2">
          <Input placeholder="New module title…" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} />
          <Button onClick={addModule}><Plus className="h-4 w-4 mr-1" />Add module</Button>
        </div>
      </Card>

      {(modules.data ?? []).map((m, i) => (
        <Card key={m.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{i + 1}. {m.title}</div>
            <Button size="sm" variant="ghost" onClick={() => removeModule(m.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <LessonList
            courseId={courseId}
            moduleId={m.id}
            lessons={(lessons.data ?? []).filter((l) => l.module_id === m.id)}
          />
        </Card>
      ))}
    </div>
  );
}

function LessonList({ courseId, moduleId, lessons }: { courseId: string; moduleId: string; lessons: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const remove = async (id: string) => {
    if (!confirm("Delete lesson?")) return;
    await supabase.from("course_lessons").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lessons-edit"] });
  };

  return (
    <div className="space-y-2">
      {lessons.map((l, i) => {
        const Icon = TYPE_ICON[l.material_type] ?? FileText;
        return (
          <div key={l.id} className="flex items-center gap-2 p-2 rounded bg-muted/40">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{i + 1}. {l.title}</div>
              <div className="text-xs text-muted-foreground capitalize">{l.material_type}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(l); setOpen(true); }}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        );
      })}
      <Button size="sm" variant="outline" onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-3 w-3 mr-1" /> Add lesson
      </Button>
      <LessonDialog
        open={open}
        onOpenChange={setOpen}
        courseId={courseId}
        moduleId={moduleId}
        lesson={editing}
        nextOrder={lessons.length}
      />
    </div>
  );
}

function LessonDialog({ open, onOpenChange, courseId, moduleId, lesson, nextOrder }: {
  open: boolean; onOpenChange: (v: boolean) => void; courseId: string; moduleId: string; lesson: any | null; nextOrder: number;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [type, setType] = useState(lesson?.material_type ?? "video");
  const [url, setUrl] = useState(lesson?.url ?? "");
  const [content, setContent] = useState(lesson?.content ?? "");
  const [downloadable, setDownloadable] = useState<boolean>(lesson?.downloadable ?? false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // reset when opened
  useEffect(() => {
    if (open) {
      setTitle(lesson?.title ?? "");
      setType(lesson?.material_type ?? "video");
      setUrl(lesson?.url ?? "");
      setContent(lesson?.content ?? "");
      setDownloadable(lesson?.downloadable ?? false);
      setUploading(false);
      setUploadProgress(0);
    }
  }, [open, lesson]);

  const acceptFor = type === "pdf" ? "application/pdf" : type === "image" ? "image/*" : type === "video" ? "video/*" : "*/*";

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${courseId}/${Date.now()}-${safeName}`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again before uploading materials.");

      await uploadCourseMaterialWithProgress(path, file, token, setUploadProgress);
      const { data } = supabase.storage.from("course-materials").getPublicUrl(path);
      setUrl(data.publicUrl);
      setUploadProgress(100);
      toast.success("Uploaded");
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Title required");
    if (type === "text" && !content.trim()) return toast.error("Content required for text lesson");
    if (type !== "text" && !url.trim()) return toast.error("URL or upload required");
    const payload = {
      course_id: courseId, module_id: moduleId, title: title.trim(),
      material_type: type, url: url || null, content: content || null, downloadable,
    };
    const { error } = lesson
      ? await supabase.from("course_lessons").update(payload).eq("id", lesson.id)
      : await supabase.from("course_lessons").insert({ ...payload, order_index: nextOrder });
    if (error) return toast.error(error.message);
    toast.success(lesson ? "Lesson updated" : "Lesson added");
    qc.invalidateQueries({ queryKey: ["lessons-edit"] });
    qc.invalidateQueries({ queryKey: ["course-content"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lesson ? "Edit lesson" : "New lesson"}</DialogTitle>
          <DialogDescription>Upload a file or paste a URL for the learning material.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div>
            <Label>Material type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="file">Downloadable file</SelectItem>
                <SelectItem value="link">External link</SelectItem>
                <SelectItem value="text">Text / manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type !== "text" && (
            <>
              <div>
                <Label>URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or upload below" />
              </div>
              {type !== "link" && (
                <div>
                  <Label>Or upload</Label>
                  <Input type="file" accept={acceptFor} disabled={uploading} onChange={(e) => {
                    const f = e.target.files?.[0]; if (f) handleUpload(f);
                  }} />
                  {uploading && (
                    <div className="mt-2 space-y-1">
                      <Progress value={uploadProgress} />
                      <div className="text-xs text-muted-foreground">Uploading {uploadProgress}%</div>
                    </div>
                  )}
                </div>
              )}
              {(type === "pdf" || type === "file" || type === "video") && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={downloadable} onCheckedChange={(v) => setDownloadable(!!v)} />
                  Allow learners to download
                </label>
              )}
            </>
          )}
          {type === "text" && (
            <div>
              <Label>Content</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={save} disabled={uploading}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * QUIZ EDITOR
 * ============================================================ */
function QuizEditor({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [opts, setOpts] = useState<{ label: string; correct: boolean }[]>([
    { label: "", correct: true }, { label: "", correct: false },
  ]);

  const questions = useQuery({
    queryKey: ["quiz-edit", courseId],
    queryFn: async () => {
      const { data: qs } = await supabase.from("course_quiz_questions").select("*").eq("course_id", courseId).order("order_index");
      if (!qs?.length) return [];
      const { data: o } = await supabase.from("course_quiz_options").select("*").in("question_id", qs.map((x) => x.id)).order("order_index");
      return qs.map((q) => ({ ...q, options: (o ?? []).filter((x) => x.question_id === q.id) }));
    },
  });

  const addQuestion = async () => {
    if (!questionText.trim()) return toast.error("Question required");
    const valid = opts.filter((o) => o.label.trim());
    if (valid.length < 2) return toast.error("At least 2 options");
    if (!valid.some((o) => o.correct)) return toast.error("Mark one option correct");
    const order = questions.data?.length ?? 0;
    const { data: q, error } = await supabase
      .from("course_quiz_questions")
      .insert({ course_id: courseId, question: questionText.trim(), order_index: order })
      .select().single();
    if (error) return toast.error(error.message);
    await supabase.from("course_quiz_options").insert(
      valid.map((o, i) => ({ question_id: q.id, label: o.label.trim(), is_correct: o.correct, order_index: i }))
    );
    setOpen(false); setQuestionText(""); setOpts([{ label: "", correct: true }, { label: "", correct: false }]);
    qc.invalidateQueries({ queryKey: ["quiz-edit"] });
  };

  const removeQuestion = async (id: string) => {
    if (!confirm("Delete question?")) return;
    await supabase.from("course_quiz_questions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["quiz-edit"] });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Add question</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New question</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Question</Label><Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} /></div>
              <Label>Options (mark the correct one)</Label>
              {opts.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={o.correct} onChange={() => setOpts(opts.map((x, j) => ({ ...x, correct: i === j })))} />
                  <Input value={o.label} onChange={(e) => setOpts(opts.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder={`Option ${i + 1}`} />
                  {opts.length > 2 && <Button size="sm" variant="ghost" onClick={() => setOpts(opts.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setOpts([...opts, { label: "", correct: false }])}>
                <Plus className="h-3 w-3 mr-1" />Add option
              </Button>
            </div>
            <DialogFooter><Button onClick={addQuestion}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="divide-y">
        {(questions.data ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No questions yet.</div>
        ) : (
          (questions.data ?? []).map((q, i) => (
            <div key={q.id} className="p-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="font-medium text-sm">{i + 1}. {q.question}</div>
                <ul className="mt-1.5 text-xs space-y-0.5">
                  {q.options.map((o: any) => (
                    <li key={o.id} className={o.is_correct ? "text-emerald-700 font-medium" : "text-muted-foreground"}>
                      {o.is_correct ? "✓" : "○"} {o.label}
                    </li>
                  ))}
                </ul>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeQuestion(q.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

/* ============================================================
 * ENROLLMENTS TAB
 * ============================================================ */
function EnrollmentsTab({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [profileId, setProfileId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const enrollments = useQuery({
    queryKey: ["course-enrollments", courseId],
    queryFn: async () => (await supabase
      .from("course_enrollments")
      .select("*, profile:profiles(id, full_name, email, department), course_quiz_attempts(score, total, passed, attempted_at)")
      .eq("course_id", courseId)
      .order("enrolled_at", { ascending: false })).data ?? [],
  });

  const profiles = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, department").order("full_name")).data ?? [],
  });

  const groups = useQuery({
    queryKey: ["learning-groups-list"],
    queryFn: async () => (await supabase.from("learning_groups").select("*, members:learning_group_members(profile_id)")).data ?? [],
  });

  const assignOne = async () => {
    if (!profileId) return;
    const { error } = await supabase.from("course_enrollments").insert({
      course_id: courseId, profile_id: profileId, source: "manual",
      due_date: dueDate || null, status: "enrolled",
    });
    if (error) return toast.error(error.message);
    setProfileId("");
    qc.invalidateQueries({ queryKey: ["course-enrollments"] });
  };

  const assignGroup = async () => {
    if (!groupId) return;
    const grp = groups.data?.find((g) => g.id === groupId);
    if (!grp?.members?.length) return toast.error("Group is empty");
    const rows = grp.members.map((m: any) => ({
      course_id: courseId, profile_id: m.profile_id, source: "group",
      due_date: dueDate || null, status: "enrolled",
    }));
    const { error } = await supabase.from("course_enrollments").upsert(rows, { onConflict: "course_id,profile_id", ignoreDuplicates: true });
    if (error) return toast.error(error.message);
    setGroupId("");
    qc.invalidateQueries({ queryKey: ["course-enrollments"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Remove enrollment?")) return;
    await supabase.from("course_enrollments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["course-enrollments"] });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Assign learners</div>
        <div className="grid gap-2 md:grid-cols-3">
          <Select value={profileId} onValueChange={setProfileId}>
            <SelectTrigger><SelectValue placeholder="Pick a person…" /></SelectTrigger>
            <SelectContent>
              {(profiles.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="Due date (optional)" />
          <Button onClick={assignOne}>Assign individual</Button>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger><SelectValue placeholder="Pick a group…" /></SelectTrigger>
            <SelectContent>
              {(groups.data ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.name} ({g.members?.length ?? 0})</SelectItem>)}
            </SelectContent>
          </Select>
          <div />
          <Button variant="outline" onClick={assignGroup}>Assign whole group</Button>
        </div>
      </Card>

      <Card className="divide-y">
        {(enrollments.data ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No enrollments yet.</div>
        ) : (
          (enrollments.data ?? []).map((e) => {
            const best = (e.course_quiz_attempts ?? []).reduce<any>((b: any, a: any) => (!b || a.score / a.total > b.score / b.total ? a : b), null);
            const pct = best ? Math.round((best.score / best.total) * 100) : null;
            return (
              <div key={e.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{e.profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground">{e.profile?.email} · {e.profile?.department ?? "—"}</div>
                </div>
                <Badge variant="outline" className="capitalize">{e.source}</Badge>
                <Badge variant={e.status === "completed" ? "default" : "secondary"} className="capitalize">{e.status.replace("_", " ")}</Badge>
                <div className="text-xs text-muted-foreground w-16 text-right">{pct !== null ? `${pct}%` : "—"}</div>
                {e.due_date && <div className="text-xs text-muted-foreground">Due {new Date(e.due_date).toLocaleDateString()}</div>}
                <Button size="sm" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

/* ============================================================
 * COURSE SETTINGS (admin)
 * ============================================================ */
function CourseSettings({ course }: { course: any }) {
  const qc = useQueryClient();
  const settings = useAppSettings();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [passingScore, setPassingScore] = useState<number>(course.passing_score);
  const [completionCriteria, setCompletionCriteria] = useState<string>(course.completion_criteria);
  const [categoryId, setCategoryId] = useState<string>(course.category_id ?? "none");
  const [autoAssign, setAutoAssign] = useState<boolean>(course.auto_assign_new_joiners);
  const [bgUrl, setBgUrl] = useState<string | null>(course.certificate_bg_url);
  const [uploading, setUploading] = useState(false);

  const categories = useQuery({
    queryKey: ["course-categories"],
    queryFn: async () => (await supabase.from("course_categories").select("*").order("order_index")).data ?? [],
  });

  const allCourses = useQuery({
    queryKey: ["all-courses-for-prereqs"],
    queryFn: async () => (await supabase.from("courses").select("id, title").neq("id", course.id)).data ?? [],
  });

  const prereqs = useQuery({
    queryKey: ["course-prereqs", course.id],
    queryFn: async () => (await supabase.from("course_prerequisites").select("*").eq("course_id", course.id)).data ?? [],
  });

  const save = async () => {
    const { error } = await supabase.from("courses").update({
      title, description: description || null,
      passing_score: passingScore,
      completion_criteria: completionCriteria,
      category_id: categoryId === "none" ? null : categoryId,
      auto_assign_new_joiners: autoAssign,
      certificate_bg_url: bgUrl,
    }).eq("id", course.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["course", course.id] });
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  const onBgUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `cert-bg/${course.id}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      setBgUrl(data.publicUrl);
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const addPrereq = async (preId: string) => {
    const { error } = await supabase.from("course_prerequisites").insert({ course_id: course.id, prerequisite_course_id: preId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["course-prereqs"] });
  };

  const removePrereq = async (preId: string) => {
    await supabase.from("course_prerequisites").delete().eq("course_id", course.id).eq("prerequisite_course_id", preId);
    qc.invalidateQueries({ queryKey: ["course-prereqs"] });
  };

  const prereqIds = new Set((prereqs.data ?? []).map((p) => p.prerequisite_course_id));

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-4 space-y-3">
        <div className="font-semibold">Details</div>
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Passing score (%)</Label>
            <Input type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} />
          </div>
          <div>
            <Label>Completion criteria</Label>
            <Select value={completionCriteria} onValueChange={setCompletionCriteria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pass_quiz">Pass the quiz</SelectItem>
                <SelectItem value="all_lessons">Complete all lessons</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
              Auto-assign to new joiners
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold">Prerequisites</div>
        <div className="flex flex-wrap gap-1">
          {(prereqs.data ?? []).map((p) => {
            const c = (allCourses.data ?? []).find((x) => x.id === p.prerequisite_course_id);
            return (
              <Badge key={p.prerequisite_course_id} variant="secondary" className="cursor-pointer" onClick={() => removePrereq(p.prerequisite_course_id)}>
                {c?.title ?? p.prerequisite_course_id} ✕
              </Badge>
            );
          })}
        </div>
        <Select value="" onValueChange={addPrereq}>
          <SelectTrigger className="max-w-sm"><SelectValue placeholder="Add prerequisite…" /></SelectTrigger>
          <SelectContent>
            {(allCourses.data ?? []).filter((c) => !prereqIds.has(c.id)).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Certificate background</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openCertificate({
                recipientName: "[ Recipient Name ]",
                courseTitle: title || course.title || "[ Course Title ]",
                issuedAt: new Date(),
                certificateNo: "PREVIEW-0000",
                organization: settings.app_name,
                backgroundUrl: bgUrl ?? settings.default_certificate_bg_url,
              })
            }
          >
            <Award className="h-4 w-4 mr-2" /> Preview certificate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Defaults to the system-wide image. Upload a course-specific one to override.
        </p>
        {bgUrl && <img src={bgUrl} alt="bg" className="max-h-32 border rounded" />}
        <div className="flex gap-2">
          <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => {
            const f = e.target.files?.[0]; if (f) onBgUpload(f);
          }} />
          {bgUrl && <Button variant="outline" onClick={() => setBgUrl(settings.default_certificate_bg_url ?? null)}>Reset to default</Button>}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>Save changes</Button>
      </div>
    </div>
  );
}
