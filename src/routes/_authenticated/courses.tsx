import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, BookOpen, Trash2, Pencil, Award } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";
import { updateAppSettings } from "@/lib/settings.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const { profile, isAdmin, canEdit } = useAuth();
  const canManage = isAdmin || canEdit("learning");
  const qc = useQueryClient();

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await supabase.from("courses").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const myAssignments = useQuery({
    queryKey: ["my-course-assignments", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () =>
      (await supabase
        .from("course_assignments")
        .select("*, course:courses(*)")
        .eq("profile_id", profile!.id)
        .order("assigned_at", { ascending: false })).data ?? [],
  });

  const myCerts = useQuery({
    queryKey: ["my-certs", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const a = (await supabase.from("course_assignments").select("id").eq("profile_id", profile!.id)).data ?? [];
      if (!a.length) return [];
      return (await supabase.from("course_certificates").select("*").in("assignment_id", a.map((x) => x.id))).data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Structured training with lessons, quizzes and certificates."
        actions={canManage ? <NewCourseDialog onCreated={() => qc.invalidateQueries({ queryKey: ["courses"] })} /> : undefined}
      />

      <Tabs defaultValue="my">
        <TabsList>
          <TabsTrigger value="my">My courses</TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          {canManage && <TabsTrigger value="manage">Manage</TabsTrigger>}
        </TabsList>

        <TabsContent value="my" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {myAssignments.data?.map((a: any) => {
              const cert = myCerts.data?.find((c) => c.assignment_id === a.id);
              return (
                <Card key={a.id} className="p-4 flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm">{a.course?.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{a.course?.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Badge variant={a.status === "completed" ? "default" : a.status === "in_progress" ? "secondary" : "outline"}>
                      {a.status}
                    </Badge>
                    {a.due_date && <span className="text-xs text-muted-foreground">Due {new Date(a.due_date).toLocaleDateString()}</span>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button asChild size="sm" className="flex-1">
                      <Link to="/courses/$courseId" params={{ courseId: a.course_id }}>
                        {a.status === "completed" ? "Review" : "Continue"}
                      </Link>
                    </Button>
                    {cert && (
                      <Badge variant="secondary" className="gap-1"><Award className="h-3 w-3" /> Earned</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
            {myAssignments.data?.length === 0 && (
              <Card className="p-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                No courses assigned yet.
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="catalog" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {courses.data?.filter((c) => c.published).map((c) => (
              <Card key={c.id} className="p-4">
                <h3 className="font-medium">{c.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{c.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">Pass {c.passing_score}%</Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/courses/$courseId" params={{ courseId: c.id }}>View</Link>
                  </Button>
                </div>
              </Card>
            ))}
            {courses.data?.filter((c) => c.published).length === 0 && (
              <Card className="p-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                No published courses yet.
              </Card>
            )}
          </div>
        </TabsContent>

        {canManage && (
          <TabsContent value="manage" className="mt-4 space-y-4">
            <DefaultCertificateBgCard />
            <Card>
              {courses.data?.length ? (
                <ul className="divide-y divide-border">
                  {courses.data.map((c) => (
                    <li key={c.id} className="p-4 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{c.title}</p>
                          <Badge variant={c.published ? "default" : "secondary"} className="text-xs">
                            {c.published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Pass {c.passing_score}% • Updated {new Date(c.updated_at).toLocaleDateString()}</p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/courses/$courseId" params={{ courseId: c.id }}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm(`Delete "${c.title}"? This removes all lessons, quizzes, assignments and certificates.`)) return;
                          const { error } = await supabase.from("courses").delete().eq("id", c.id);
                          if (error) return toast.error(error.message);
                          toast.success("Course deleted");
                          qc.invalidateQueries({ queryKey: ["courses"] });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-10 text-center text-sm text-muted-foreground">No courses yet. Create one to get started.</p>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function NewCourseDialog({ onCreated }: { onCreated: () => void }) {
  const { profile } = useAuth();
  const settings = useAppSettings();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [passing, setPassing] = useState(70);
  const [published, setPublished] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New course</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New course</DialogTitle></DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.from("courses").insert({
              title, description: desc || null, passing_score: passing, published, created_by: profile?.id,
              certificate_bg_url: settings.default_certificate_bg_url ?? null,
            });
            if (error) return toast.error(error.message);
            toast.success("Course created");
            setOpen(false); setTitle(""); setDesc(""); setPassing(70); setPublished(false);
            onCreated();
          }}
          className="space-y-4"
        >
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={1000} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Passing score (%)</Label>
              <Input type="number" min={1} max={100} value={passing} onChange={(e) => setPassing(Number(e.target.value))} />
            </div>
            <div className="space-y-2 flex flex-col">
              <Label>Published</Label>
              <div className="flex items-center gap-2 h-9"><Switch checked={published} onCheckedChange={setPublished} /><span className="text-xs text-muted-foreground">Visible in catalog</span></div>
            </div>
          </div>
          {settings.default_certificate_bg_url && (
            <p className="text-xs text-muted-foreground">The default certificate background will be applied to this course.</p>
          )}
          <DialogFooter><Button type="submit">Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DefaultCertificateBgCard() {
  const settings = useAppSettings();
  const qc = useQueryClient();
  const updateFn = useServerFn(updateAppSettings);
  const [uploading, setUploading] = useState(false);

  const save = async (newUrl: string | null) => {
    await updateFn({
      data: {
        app_name: settings.app_name,
        tagline: settings.tagline,
        hero_title: settings.hero_title,
        hero_description: settings.hero_description,
        logo_url: settings.logo_url,
        default_certificate_bg_url: newUrl,
      },
    });
    qc.invalidateQueries({ queryKey: ["app-settings"] });
  };

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="font-medium text-sm">Default certificate background</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Used as the template for every new course until you replace it. Existing courses keep whatever background they already have.
        </p>
      </div>
      {settings.default_certificate_bg_url ? (
        <div className="rounded-md overflow-hidden border bg-muted">
          <img src={settings.default_certificate_bg_url} alt="Default certificate background" className="w-full h-44 object-cover" />
        </div>
      ) : (
        <div className="h-44 rounded-md border border-dashed flex items-center justify-center text-xs text-muted-foreground">
          No default background uploaded
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
            setUploading(true);
            try {
              const ext = file.name.split(".").pop() || "png";
              const path = `certificates/default-${Date.now()}.${ext}`;
              const { error: upErr } = await supabase.storage.from("branding").upload(path, file, { upsert: true, contentType: file.type });
              if (upErr) throw upErr;
              const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
              await save(pub.publicUrl);
              toast.success("Default background saved");
            } catch (err: any) {
              toast.error(err.message ?? "Upload failed");
            } finally {
              setUploading(false);
            }
          }}
        />
        {settings.default_certificate_bg_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await save(null);
              toast.success("Default background cleared");
            }}
          >
            Remove
          </Button>
        )}
      </div>
    </Card>
  );
}
