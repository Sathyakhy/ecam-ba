import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, FileText, Video, Link as LinkIcon, ExternalLink, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/learning")({
  component: LearningPage,
});

const ICON: Record<string, typeof FileText> = { document: FileText, video: Video, link: LinkIcon };

function LearningPage() {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();

  const materials = useQuery({
    queryKey: ["materials"],
    queryFn: async () => (await supabase.from("training_materials").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const myAssignments = useQuery({
    queryKey: ["my-assignments", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => (await supabase.from("training_assignments").select("*").eq("profile_id", profile!.id)).data ?? [],
  });
  const articles = useQuery({
    queryKey: ["kb"],
    queryFn: async () => (await supabase.from("knowledge_articles").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const staff = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name").order("full_name")).data ?? [],
  });

  const markComplete = async (assignmentId: string) => {
    const { error } = await supabase.from("training_assignments").update({
      status: "completed", completed_at: new Date().toISOString(),
    }).eq("id", assignmentId);
    if (error) return toast.error(error.message);
    toast.success("Marked complete");
    qc.invalidateQueries({ queryKey: ["my-assignments"] });
  };

  return (
    <div>
      <PageHeader
        title="Learning & knowledge"
        description="Training materials, assigned learning, and the department knowledge base."
        actions={isAdmin ? <NewMaterialDialog onCreated={() => qc.invalidateQueries({ queryKey: ["materials"] })} /> : undefined}
      />

      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="my">Assigned to me</TabsTrigger>
          <TabsTrigger value="kb">Knowledge base</TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {materials.data?.map((m) => {
              const Icon = ICON[m.material_type] ?? FileText;
              return (
                <Card key={m.id} className="p-4 flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm">{m.title}</h3>
                      {m.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
                    </div>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                        await supabase.from("training_materials").delete().eq("id", m.id);
                        qc.invalidateQueries({ queryKey: ["materials"] });
                      }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">{m.material_type}</Badge>
                    <div className="flex gap-2">
                      {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Open</a>}
                      {isAdmin && <AssignDialog materialId={m.id} staff={staff.data ?? []} />}
                    </div>
                  </div>
                </Card>
              );
            })}
            {materials.data?.length === 0 && (
              <Card className="p-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No training materials yet.</Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="my" className="mt-4">
          <Card>
            {myAssignments.data?.length ? (
              <ul className="divide-y divide-border">
                {myAssignments.data.map((a) => {
                  const m = materials.data?.find((x) => x.id === a.material_id);
                  return (
                    <li key={a.id} className="p-4 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{m?.title ?? "Material"}</p>
                        <p className="text-xs text-muted-foreground">
                          Assigned {new Date(a.assigned_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={a.status === "completed" ? "default" : "secondary"}>{a.status}</Badge>
                      {a.status !== "completed" && (
                        <Button size="sm" variant="outline" onClick={() => markComplete(a.id)}>Mark complete</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-10 text-center text-sm text-muted-foreground">No training assigned to you yet.</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="kb" className="mt-4">
          <div className="flex justify-end mb-3">
            {isAdmin && <NewArticleDialog onCreated={() => qc.invalidateQueries({ queryKey: ["kb"] })} />}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {articles.data?.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {a.category && <Badge variant="outline" className="mb-2 text-xs">{a.category}</Badge>}
                    <h3 className="font-medium">{a.title}</h3>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                      await supabase.from("knowledge_articles").delete().eq("id", a.id);
                      qc.invalidateQueries({ queryKey: ["kb"] });
                    }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-6">{a.content}</p>
              </Card>
            ))}
            {articles.data?.length === 0 && (
              <Card className="p-10 text-center text-sm text-muted-foreground md:col-span-2">No knowledge articles yet.</Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewMaterialDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("document");
  const [url, setUrl] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add material</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New training material</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("training_materials").insert({
            title, description: desc || null, material_type: type, url: url || null,
          });
          if (error) return toast.error(error.message);
          toast.success("Added");
          setOpen(false); setTitle(""); setDesc(""); setUrl(""); setType("document");
          onCreated();
        }} className="space-y-4">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={1000} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
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
          <DialogFooter><Button type="submit">Create</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ materialId, staff }: { materialId: string; staff: { id: string; full_name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pid, setPid] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="text-xs h-7">Assign</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign training</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("training_assignments").insert({ material_id: materialId, profile_id: pid });
          if (error) return toast.error(error.message);
          toast.success("Assigned"); setOpen(false); setPid("");
        }} className="space-y-4">
          <div className="space-y-2">
            <Label>Staff member</Label>
            <Select value={pid} onValueChange={setPid}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button type="submit">Assign</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewArticleDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-1" /> New article</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New knowledge article</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("knowledge_articles").insert({
            title, category: category || null, content,
          });
          if (error) return toast.error(error.message);
          toast.success("Published"); setOpen(false); setTitle(""); setCategory(""); setContent("");
          onCreated();
        }} className="space-y-4">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. SOP" maxLength={60} /></div>
          <div className="space-y-2"><Label>Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={8} maxLength={10000} /></div>
          <DialogFooter><Button type="submit">Publish</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
