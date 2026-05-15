import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/announcements")({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const items = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Important updates from the department."
        actions={isAdmin ? <NewDialog createdBy={profile?.id ?? ""} onCreated={() => qc.invalidateQueries({ queryKey: ["announcements"] })} /> : undefined}
      />
      <div className="space-y-3">
        {items.data?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Megaphone className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{a.title}</h3>
                  <span className="text-xs text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{a.content}</p>
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                  await supabase.from("announcements").delete().eq("id", a.id);
                  qc.invalidateQueries({ queryKey: ["announcements"] });
                }}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          </Card>
        ))}
        {items.data?.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">No announcements yet.</Card>
        )}
      </div>
    </div>
  );
}

function NewDialog({ createdBy, onCreated }: { createdBy: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New announcement</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.from("announcements").insert({ title, content, created_by: createdBy || null });
          if (error) return toast.error(error.message);
          toast.success("Posted"); setOpen(false); setTitle(""); setContent(""); onCreated();
        }} className="space-y-4">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Content</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} required maxLength={4000} /></div>
          <DialogFooter><Button type="submit">Post</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
