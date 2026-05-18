import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type PMKind = "ecam" | "customer" | "vendor";

const KIND_LABEL: Record<PMKind, string> = {
  ecam: "eCam",
  customer: "Customer",
  vendor: "Vendor",
};

export function ProjectManagers({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const pms = useQuery({
    queryKey: ["project_managers", projectId],
    queryFn: async () => (await supabase.from("project_managers").select("*").eq("project_id", projectId).order("created_at")).data ?? [],
  });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-2"><UserCheck className="h-4 w-4" /> Project Managers</h2>
        {canManage && (
          <AddPMDialog projectId={projectId} onAdded={() => qc.invalidateQueries({ queryKey: ["project_managers", projectId] })} />
        )}
      </div>
      {(pms.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No project managers assigned yet.</p>
      ) : (
        <div className="divide-y">
          {(pms.data ?? []).map((pm) => (
            <div key={pm.id} className="flex items-center gap-3 py-2">
              <Badge variant={pm.kind === "ecam" ? "default" : pm.kind === "customer" ? "secondary" : "outline"} className="text-[10px]">
                {KIND_LABEL[pm.kind as PMKind]}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pm.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{[pm.email, pm.phone].filter(Boolean).join(" · ")}</p>
              </div>
              {canManage && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                  if (!confirm(`Remove ${pm.name}?`)) return;
                  const { error } = await supabase.from("project_managers").delete().eq("id", pm.id);
                  if (error) return toast.error(error.message);
                  qc.invalidateQueries({ queryKey: ["project_managers", projectId] });
                }}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AddPMDialog({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PMKind>("ecam");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileId, setProfileId] = useState<string | undefined>();
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [contactId, setContactId] = useState<string | undefined>();

  const staff = useQuery({
    queryKey: ["staff-min"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,email").order("full_name")).data ?? [],
    enabled: open && kind === "ecam",
  });
  const companies = useQuery({
    queryKey: [kind === "customer" ? "customers" : "vendors", "min"],
    queryFn: async () => (await supabase.from(kind === "customer" ? "customers" : "vendors").select("id,name").order("name")).data ?? [],
    enabled: open && (kind === "customer" || kind === "vendor"),
  });
  const contacts = useQuery({
    queryKey: [kind === "customer" ? "customer_contacts" : "vendor_contacts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const fk = kind === "customer" ? "customer_id" : "vendor_id";
      const table = kind === "customer" ? "customer_contacts" : "vendor_contacts";
      return (await supabase.from(table).select("*").eq(fk, companyId)).data ?? [];
    },
    enabled: open && !!companyId && (kind === "customer" || kind === "vendor"),
  });

  const reset = () => { setName(""); setEmail(""); setPhone(""); setProfileId(undefined); setCompanyId(undefined); setContactId(undefined); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add PM</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Project Manager</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return toast.error("Name required");
          const payload: Record<string, unknown> = {
            project_id: projectId, kind, name: name.trim(),
            email: email || null, phone: phone || null,
            profile_id: kind === "ecam" ? profileId ?? null : null,
            customer_id: kind === "customer" ? companyId ?? null : null,
            customer_contact_id: kind === "customer" ? contactId ?? null : null,
            vendor_id: kind === "vendor" ? companyId ?? null : null,
            vendor_contact_id: kind === "vendor" ? contactId ?? null : null,
          };
          const { error } = await supabase.from("project_managers").insert(payload as never);
          if (error) return toast.error(error.message);
          toast.success("Added");
          setOpen(false); reset();
          onAdded();
        }} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => { setKind(v as PMKind); reset(); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ecam">eCam (internal)</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "ecam" && (
            <div className="space-y-2">
              <Label>Internal staff (optional)</Label>
              <Select value={profileId} onValueChange={(v) => {
                setProfileId(v);
                const s = staff.data?.find((x) => x.id === v);
                if (s) { setName(s.full_name); setEmail(s.email ?? ""); }
              }}>
                <SelectTrigger><SelectValue placeholder="Pick from staff or type manually below" /></SelectTrigger>
                <SelectContent>
                  {(staff.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(kind === "customer" || kind === "vendor") && (
            <>
              <div className="space-y-2">
                <Label>{kind === "customer" ? "Customer company" : "Vendor company"}</Label>
                <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setContactId(undefined); }}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {(companies.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {companyId && (
                <div className="space-y-2">
                  <Label>Contact (optional)</Label>
                  <Select value={contactId} onValueChange={(v) => {
                    setContactId(v);
                    const c = contacts.data?.find((x) => x.id === v) as { full_name?: string; email?: string | null; phone?: string | null } | undefined;
                    if (c) { setName(c.full_name ?? ""); setEmail(c.email ?? ""); setPhone(c.phone ?? ""); }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Pick a contact or type manually" /></SelectTrigger>
                    <SelectContent>
                      {(contacts.data ?? []).map((c) => {
                        const x = c as { id: string; full_name: string };
                        return <SelectItem key={x.id} value={x.id}>{x.full_name}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} /></div>
            </div>
          </div>

          <DialogFooter><Button type="submit">Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
