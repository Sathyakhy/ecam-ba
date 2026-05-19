import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function ProjectFiles({ projectId, canUpload }: { projectId: string; canUpload: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const files = useQuery({
    queryKey: ["project-attachments", projectId],
    queryFn: async () => (await supabase.from("project_attachments").select("*").eq("project_id", projectId)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const upload = async (file: File) => {
    if (!profile?.id) return;
    setBusy(true);
    const path = `${projectId}/_project/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("project-attachments").upload(path, file);
    if (up.error) { setBusy(false); return toast.error(up.error.message); }
    const { error } = await supabase.from("project_attachments").insert({
      project_id: projectId, uploader_id: profile.id,
      file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Uploaded");
    qc.invalidateQueries({ queryKey: ["project-attachments", projectId] });
  };

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("project-attachments").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.click();
  };

  const remove = async (id: string, path: string) => {
    if (!confirm("Delete this file?")) return;
    await supabase.storage.from("project-attachments").remove([path]);
    await supabase.from("project_attachments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["project-attachments", projectId] });
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" /> Project files</h2>
        {canUpload && (
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "";
            }} />
            <Button size="sm" variant="outline" className="h-7 pointer-events-none" disabled={busy}>
              <Upload className="h-3 w-3 mr-1" />{busy ? "Uploading…" : "Upload"}
            </Button>
          </label>
        )}
      </div>
      {(files.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No project files yet.</p>
      ) : (
        <div className="space-y-1">
          {(files.data ?? []).map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5">
              <button className="flex-1 text-left truncate hover:underline" onClick={() => download(f.file_path, f.file_name)}>
                {f.file_name}
              </button>
              <span className="text-muted-foreground text-[10px]">{f.file_size ? (f.file_size / 1024).toFixed(1) + " KB" : ""}</span>
              {(f.uploader_id === profile?.id || canUpload) && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(f.id, f.file_path)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
