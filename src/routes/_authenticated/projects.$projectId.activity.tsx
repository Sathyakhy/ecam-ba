import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, X, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/hooks/use-project";
import { STATUS_META, metaEntries } from "@/lib/project-meta";

export const Route = createFileRoute("/_authenticated/projects/$projectId/activity")({
  component: ActivityPage,
});

function ActivityPage() {
  const { projectId } = Route.useParams();
  const { staff, canManage, isMember, profile } = useProject(projectId);
  const qc = useQueryClient();

  const activity = useQuery({
    queryKey: ["project-activity", projectId],
    queryFn: async () => (await supabase.from("project_activity").select("*").eq("project_id", projectId)
      .order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const updates = useQuery({
    queryKey: ["project-updates", projectId],
    queryFn: async () => (await supabase.from("project_status_updates").select("*").eq("project_id", projectId)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState<string | undefined>();
  const [actorId, setActorId] = useState<string | undefined>();

  const entityTypes = useMemo(() => Array.from(new Set((activity.data ?? []).map((a) => a.entity_type))), [activity.data]);
  const actors = useMemo(() => {
    const ids = Array.from(new Set((activity.data ?? []).map((a) => a.actor_id).filter(Boolean) as string[]));
    return ids.map((id) => ({ id, name: staff.data?.find((s) => s.id === id)?.full_name ?? "Unknown" }));
  }, [activity.data, staff.data]);

  const filteredActivity = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (activity.data ?? []).filter((a) => {
      if (entityType && a.entity_type !== entityType) return false;
      if (actorId && a.actor_id !== actorId) return false;
      if (q) {
        const summary = (a.summary ?? "").toLowerCase();
        const actor = (staff.data?.find((s) => s.id === a.actor_id)?.full_name ?? "").toLowerCase();
        if (!summary.includes(q) && !actor.includes(q)) return false;
      }
      return true;
    });
  }, [activity.data, query, entityType, actorId, staff.data]);

  const hasFilters = !!(query || entityType || actorId);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4" /> Status update</h2>
        {(isMember || canManage) && (
          <NewStatusUpdate
            projectId={projectId}
            authorId={profile?.id ?? ""}
            onPosted={() => {
              qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
              qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
            }}
          />
        )}
        <div className="space-y-2 mt-4">
          {(updates.data ?? []).slice(0, 5).map((u) => {
            const a = staff.data?.find((s) => s.id === u.author_id);
            const canDelete = u.author_id === profile?.id || canManage;
            return (
              <div key={u.id} className="flex items-start gap-2 text-xs border-l-2 border-primary/30 pl-2">
                <Avatar className="h-6 w-6">
                  {a?.avatar_url && <AvatarImage src={a.avatar_url} />}
                  <AvatarFallback className="text-[10px]">{(a?.full_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a?.full_name ?? "?"}</span>
                    {u.status && <Badge variant="outline" className="text-[10px]">{STATUS_META[u.status]?.label ?? u.status}</Badge>}
                    <span className="text-muted-foreground ml-auto">{new Date(u.created_at).toLocaleString()}</span>
                    {canDelete && (
                      <button className="text-destructive" onClick={async () => {
                        await supabase.from("project_status_updates").delete().eq("id", u.id);
                        qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
                      }}><Trash2 className="h-3 w-3" /></button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap">{u.body}</p>
                </div>
              </div>
            );
          })}
          {(updates.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No status updates yet.</p>
          )}
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Activity log</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search activity…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-7" />
          </div>
          <Select value={entityType} onValueChange={(v) => setEntityType(v || undefined)}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              {entityTypes.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actorId} onValueChange={(v) => setActorId(v || undefined)}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All actors" /></SelectTrigger>
            <SelectContent>
              {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setEntityType(undefined); setActorId(undefined); }}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        <Card className="p-4">
          {filteredActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No activity matches.</p>
          ) : (
            <ul className="space-y-2.5">
              {filteredActivity.map((a) => {
                const actor = staff.data?.find((s) => s.id === a.actor_id);
                return (
                  <li key={a.id} className="flex items-start gap-2 text-xs">
                    <Avatar className="h-6 w-6">
                      {actor?.avatar_url && <AvatarImage src={actor.avatar_url} />}
                      <AvatarFallback className="text-[10px]">{(actor?.full_name ?? "?").slice(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p>
                        <span className="font-medium">{actor?.full_name ?? "System"}</span>
                        <span className="text-muted-foreground"> {a.action.replace(/_/g," ")} </span>
                        <Badge variant="outline" className="text-[9px]">{a.entity_type}</Badge>
                      </p>
                      {a.summary && <p className="text-muted-foreground mt-0.5">{a.summary}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function NewStatusUpdate({ projectId, authorId, onPosted }: { projectId: string; authorId: string; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!body.trim() || !authorId) return;
      setSubmitting(true);
      const { error } = await supabase.from("project_status_updates").insert({
        project_id: projectId, author_id: authorId, body, status: status ?? null,
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      setBody(""); setStatus(undefined);
      onPosted();
    }} className="space-y-2">
      <Textarea placeholder="Post a status update…" value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={2000} />
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Status (optional)" /></SelectTrigger>
          <SelectContent>
            {metaEntries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" className="ml-auto" disabled={submitting || !body.trim()}>Post</Button>
      </div>
    </form>
  );
}
