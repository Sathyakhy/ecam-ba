import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Plus, BookOpen, Trash2, Pencil, Award, Download, Users, FolderTree, BarChart3,
  GraduationCap, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";
import { updateAppSettings } from "@/lib/settings.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const { profile, isAdmin, canEdit } = useAuth();
  const canManage = isAdmin || canEdit("learning");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname !== "/courses") return <Outlet />;

  return (
    <div>
      <PageHeader
        title="Learning"
        description="Browse courses, track progress, earn certificates."
      />
      <Tabs defaultValue="my" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my">My learning</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          {canManage && <TabsTrigger value="manage">Manage</TabsTrigger>}
        </TabsList>

        <TabsContent value="my"><MyLearning /></TabsContent>
        <TabsContent value="catalog"><Catalog /></TabsContent>
        {canManage && <TabsContent value="manage"><ManagePanel /></TabsContent>}
      </Tabs>
    </div>
  );
}

/* ============================================================
 * MY LEARNING — learner dashboard
 * ============================================================ */
function MyLearning() {
  const { profile } = useAuth();

  const enrollments = useQuery({
    queryKey: ["my-enrollments", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("course_enrollments")
        .select("*, course:courses(*, category:course_categories(name))")
        .eq("profile_id", profile!.id)
        .order("enrolled_at", { ascending: false });
      return data ?? [];
    },
  });

  const certs = useQuery({
    queryKey: ["my-certs", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const ids = (enrollments.data ?? []).map((e) => e.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("course_certificates").select("*").in("enrollment_id", ids);
      return data ?? [];
    },
  });

  const items = enrollments.data ?? [];
  const active = items.filter((e) => e.status !== "completed");
  const done = items.filter((e) => e.status === "completed");

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">In progress</h3>
        {active.length === 0 ? (
          <EmptyState icon={BookOpen} message="No active courses. Check the Catalog tab." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {active.map((e) => <EnrollmentCard key={e.id} enrollment={e} />)}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          Completed <Badge variant="secondary" className="ml-1">{done.length}</Badge>
        </h3>
        {done.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completions yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {done.map((e) => (
              <EnrollmentCard
                key={e.id}
                enrollment={e}
                certificate={certs.data?.find((c) => c.enrollment_id === e.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EnrollmentCard({ enrollment, certificate }: { enrollment: any; certificate?: any }) {
  return (
    <Link to="/courses/$courseId" params={{ courseId: enrollment.course_id }} search={{}}>
      <Card className="p-4 hover:border-primary transition-colors h-full">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="font-semibold line-clamp-2">{enrollment.course?.title}</div>
          {enrollment.status === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
        {enrollment.course?.category?.name && (
          <Badge variant="outline" className="text-xs mb-2">{enrollment.course.category.name}</Badge>
        )}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{enrollment.course?.description}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{enrollment.status.replace("_", " ")}</span>
          {enrollment.due_date && <span>Due {new Date(enrollment.due_date).toLocaleDateString()}</span>}
        </div>
        {certificate && (
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-700">
            <Award className="h-3 w-3" /> Certificate issued
          </div>
        )}
      </Card>
    </Link>
  );
}

/* ============================================================
 * CATALOG — browse all published courses
 * ============================================================ */
function Catalog() {
  const { profile, isAdmin, canEdit } = useAuth();
  const canManage = isAdmin || canEdit("learning");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const categories = useQuery({
    queryKey: ["course-categories"],
    queryFn: async () => (await supabase.from("course_categories").select("*").order("order_index")).data ?? [],
  });

  const courses = useQuery({
    queryKey: ["courses-catalog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("*, category:course_categories(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const enrollments = useQuery({
    queryKey: ["my-enrollments-set", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () =>
      (await supabase.from("course_enrollments").select("course_id").eq("profile_id", profile!.id)).data ?? [],
  });

  const enrolledIds = new Set((enrollments.data ?? []).map((e) => e.course_id));

  const filtered = useMemo(() => {
    return (courses.data ?? []).filter((c) => {
      if (!canManage && !c.published) return false;
      if (categoryFilter !== "all" && c.category_id !== categoryFilter) return false;
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [courses.data, categoryFilter, search, canManage]);

  const enroll = async (courseId: string) => {
    if (!profile?.id) return;
    const { error } = await supabase.from("course_enrollments").insert({
      course_id: courseId, profile_id: profile.id, source: "manual", status: "enrolled",
    });
    if (error) return toast.error(error.message);
    toast.success("Enrolled");
    qc.invalidateQueries({ queryKey: ["my-enrollments-set"] });
    qc.invalidateQueries({ queryKey: ["my-enrollments"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} message="No courses match your filters." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold line-clamp-2">{c.title}</div>
                {!c.published && <Badge variant="outline">Draft</Badge>}
              </div>
              {c.category?.name && <Badge variant="secondary" className="text-xs mb-2 w-fit">{c.category.name}</Badge>}
              <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{c.description || "—"}</p>
              <div className="mt-3 flex gap-2">
                {enrolledIds.has(c.id) ? (
                  <Button asChild size="sm" variant="secondary" className="flex-1">
                    <Link to="/courses/$courseId" params={{ courseId: c.id }} search={{}}>Open</Link>
                  </Button>
                ) : (
                  <Button size="sm" className="flex-1" onClick={() => enroll(c.id)}>Enroll</Button>
                )}
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/courses/$courseId", params: { courseId: c.id }, search: { tab: "content" } })}
                    aria-label={`Edit ${c.title}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * MANAGE — admin tabs
 * ============================================================ */
function ManagePanel() {
  return (
    <Tabs defaultValue="courses" className="space-y-4">
      <TabsList>
        <TabsTrigger value="courses"><BookOpen className="h-3 w-3 mr-1" />Courses</TabsTrigger>
        <TabsTrigger value="categories"><FolderTree className="h-3 w-3 mr-1" />Categories</TabsTrigger>
        <TabsTrigger value="groups"><Users className="h-3 w-3 mr-1" />Groups</TabsTrigger>
        <TabsTrigger value="reports"><BarChart3 className="h-3 w-3 mr-1" />Reports</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="courses"><ManageCourses /></TabsContent>
      <TabsContent value="categories"><ManageCategories /></TabsContent>
      <TabsContent value="groups"><ManageGroups /></TabsContent>
      <TabsContent value="reports"><Reports /></TabsContent>
      <TabsContent value="settings"><DefaultCertificateBgCard /></TabsContent>
    </Tabs>
  );
}

function ManageCourses() {
  const qc = useQueryClient();
  const settings = useAppSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");

  const courses = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => (await supabase
      .from("courses")
      .select("*, category:course_categories(name), enrollments:course_enrollments(count)")
      .order("created_at", { ascending: false })).data ?? [],
  });

  const categories = useQuery({
    queryKey: ["course-categories"],
    queryFn: async () => (await supabase.from("course_categories").select("*").order("order_index")).data ?? [],
  });

  const create = async () => {
    if (!title.trim()) return toast.error("Title required");
    const { error } = await supabase.from("courses").insert({
      title: title.trim(),
      description: description.trim() || null,
      category_id: categoryId === "none" ? null : categoryId,
      certificate_bg_url: settings.default_certificate_bg_url || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Course created");
    setOpen(false); setTitle(""); setDescription(""); setCategoryId("none");
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
    qc.invalidateQueries({ queryKey: ["courses-catalog"] });
  };

  const togglePublish = async (id: string, published: boolean) => {
    await supabase.from("courses").update({ published }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this course and all data?")) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New course</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New course</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
              <div>
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {(categories.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="divide-y">
        {(courses.data ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No courses yet.</div>
        ) : (
          (courses.data ?? []).map((c) => (
            <div key={c.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <Link to="/courses/$courseId" params={{ courseId: c.id }} search={{}} className="font-medium hover:underline truncate block">
                  {c.title}
                </Link>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-0.5">
                  {c.category?.name && <span>{c.category.name}</span>}
                  <span>Pass {c.passing_score}%</span>
                  {c.auto_assign_new_joiners && <Badge variant="outline" className="text-[10px] py-0">Auto-assign</Badge>}
                  <span>{c.enrollments?.[0]?.count ?? 0} enrolled</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs">
                  <Switch checked={c.published} onCheckedChange={(v) => togglePublish(c.id, v)} />
                  <span className="text-muted-foreground">{c.published ? "Published" : "Draft"}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate({ to: "/courses/$courseId", params: { courseId: c.id }, search: { tab: "content" } })}
                >
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function ManageCategories() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const list = useQuery({
    queryKey: ["course-categories"],
    queryFn: async () => (await supabase.from("course_categories").select("*").order("order_index")).data ?? [],
  });

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("course_categories").insert({ name: name.trim(), description: desc.trim() || null });
    if (error) return toast.error(error.message);
    setName(""); setDesc("");
    qc.invalidateQueries({ queryKey: ["course-categories"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete category?")) return;
    await supabase.from("course_categories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["course-categories"] });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-2">
          <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button onClick={add}><Plus className="h-4 w-4" /></Button>
        </div>
      </Card>
      <Card className="divide-y">
        {(list.data ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No categories.</div>
        ) : (
          (list.data ?? []).map((c) => (
            <div key={c.id} className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function ManageGroups() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const groups = useQuery({
    queryKey: ["learning-groups"],
    queryFn: async () => (await supabase
      .from("learning_groups")
      .select("*, members:learning_group_members(profile_id, profile:profiles(id, full_name, email))")
      .order("created_at", { ascending: false })).data ?? [],
  });

  const profiles = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").order("full_name")).data ?? [],
  });

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("learning_groups").insert({ name: name.trim() });
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["learning-groups"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete group?")) return;
    await supabase.from("learning_groups").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["learning-groups"] });
  };

  const addMember = async (groupId: string, profileId: string) => {
    const { error } = await supabase.from("learning_group_members").insert({ group_id: groupId, profile_id: profileId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["learning-groups"] });
  };

  const removeMember = async (groupId: string, profileId: string) => {
    await supabase.from("learning_group_members").delete().eq("group_id", groupId).eq("profile_id", profileId);
    qc.invalidateQueries({ queryKey: ["learning-groups"] });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-2">
          <Input placeholder="Group name (e.g. Sales onboarding 2026)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Create</Button>
        </div>
      </Card>

      {(groups.data ?? []).map((g) => (
        <Card key={g.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{g.name}</div>
              <div className="text-xs text-muted-foreground">{g.members?.length ?? 0} members</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(g.members ?? []).map((m: any) => (
              <Badge key={m.profile_id} variant="secondary" className="cursor-pointer" onClick={() => removeMember(g.id, m.profile_id)}>
                {m.profile?.full_name ?? m.profile_id} ✕
              </Badge>
            ))}
          </div>
          <Select value="" onValueChange={(v) => addMember(g.id, v)}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Add member…" /></SelectTrigger>
            <SelectContent>
              {(profiles.data ?? [])
                .filter((p) => !g.members?.some((m: any) => m.profile_id === p.id))
                .map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
 * REPORTS
 * ============================================================ */
function Reports() {
  const courses = useQuery({
    queryKey: ["report-courses"],
    queryFn: async () => (await supabase
      .from("courses")
      .select("id, title, passing_score, enrollments:course_enrollments(id, status, profile:profiles(full_name, email), course_quiz_attempts(score, total, passed, attempted_at))")
    ).data ?? [],
  });

  const exportCsv = () => {
    const rows: string[] = ["Course,Employee,Email,Status,Best Score,Passed"];
    for (const c of (courses.data ?? [])) {
      for (const e of (c.enrollments ?? [])) {
        const attempts: any[] = e.course_quiz_attempts ?? [];
        const best = attempts.reduce<any>((b, a) => (!b || a.score > b.score ? a : b), null);
        const pct = best && best.total ? Math.round((best.score / best.total) * 100) : "";
        rows.push([
          escapeCsv(c.title),
          escapeCsv(e.profile?.full_name ?? ""),
          escapeCsv(e.profile?.email ?? ""),
          e.status,
          pct,
          best?.passed ? "Yes" : "No",
        ].join(","));
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `learning-report-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    const list = courses.data ?? [];
    return list.map((c) => {
      const enrolls = c.enrollments ?? [];
      const completed = enrolls.filter((e: any) => e.status === "completed").length;
      const total = enrolls.length;
      const scores = enrolls.flatMap((e: any) =>
        (e.course_quiz_attempts ?? []).map((a: any) => a.total ? (a.score / a.total) * 100 : 0)
      );
      const avg = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
      return { id: c.id, title: c.title, total, completed, completion: total ? Math.round((completed / total) * 100) : 0, avg };
    });
  }, [courses.data]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>
      <Card className="divide-y">
        {summary.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No data yet.</div>
        ) : (
          summary.map((s) => (
            <div key={s.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground">
                  {s.completed}/{s.total} completed · avg quiz {s.avg ?? "—"}%
                </div>
              </div>
              <Progress value={s.completion} />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function escapeCsv(s: string) {
  if (s == null) return "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* ============================================================
 * Default certificate background
 * ============================================================ */
function DefaultCertificateBgCard() {
  const settings = useAppSettings();
  const update = useServerFn(updateAppSettings);
  const [uploading, setUploading] = useState(false);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `cert-bg/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      await update({ data: { default_certificate_bg_url: data.publicUrl } });
      toast.success("Default certificate background saved");
      window.location.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  return (
    <Card className="p-4 max-w-2xl">
      <div className="font-semibold mb-1">Default certificate background</div>
      <p className="text-xs text-muted-foreground mb-3">
        Used for new courses by default. Individual courses can override.
      </p>
      {settings.default_certificate_bg_url && (
        <img src={settings.default_certificate_bg_url} alt="bg" className="max-h-32 mb-3 border rounded" />
      )}
      <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => {
        const f = e.target.files?.[0]; if (f) onUpload(f);
      }} />
    </Card>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <Card className="p-10 text-center text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </Card>
  );
}
