import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { UserPlus, Trash2, Tag, Plus, X, Mail, Phone, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/hooks/use-project";

export const Route = createFileRoute("/_authenticated/projects/$projectId/members")({
  component: MembersPage,
});

type MemberKind = "ecam" | "customer" | "vendor" | "manual";

const KIND_LABEL: Record<MemberKind, string> = {
  ecam: "eCam",
  customer: "Customer",
  vendor: "Vendor",
  manual: "Manual",
};

type MemberRecord = {
  id: string;
  project_id: string;
  profile_id: string | null;
  role: string;
  kind: MemberKind;
  name: string | null;
  email: string | null;
  phone: string | null;
  customer_id: string | null;
  customer_contact_id: string | null;
  vendor_id: string | null;
  vendor_contact_id: string | null;
};

function MembersPage() {
  const { projectId } = Route.useParams();
  const { project, members, staff, canManage } = useProject(projectId);
  const qc = useQueryClient();
  const [detail, setDetail] = useState<MemberRecord | null>(null);

  const rolesCatalog = useQuery({
    queryKey: ["project_roles_catalog"],
    queryFn: async () => (await supabase.from("project_roles_catalog").select("*").order("name")).data ?? [],
  });
  const memberRoles = useQuery({
    queryKey: ["project_member_roles", projectId],
    queryFn: async () => (await supabase.from("project_member_roles").select("*").eq("project_id", projectId)).data ?? [],
  });

  if (!project.data) return null;
  const p = project.data;
  const owner = staff.data?.find((s) => s.id === p.owner_id);
  const manager = staff.data?.find((s) => s.id === p.manager_id);

  const rows = ((members.data ?? []) as MemberRecord[]).map((m) => ({
    ...m,
    profile: m.profile_id ? staff.data?.find((s) => s.id === m.profile_id) : undefined,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Team members</h2>
        {canManage && (
          <AddMemberDialog
            projectId={projectId}
            projectCustomerId={p.customer_id ?? null}
            projectVendorId={p.vendor_id ?? null}
            existingProfileIds={[p.owner_id, p.manager_id, ...(members.data ?? []).map((m) => m.profile_id)].filter(Boolean) as string[]}
            existingCustomerContactIds={(members.data ?? []).map((m) => (m as MemberRecord).customer_contact_id).filter(Boolean) as string[]}
            existingVendorContactIds={(members.data ?? []).map((m) => (m as MemberRecord).vendor_contact_id).filter(Boolean) as string[]}
            staff={staff.data ?? []}
            onAdded={() => qc.invalidateQueries({ queryKey: ["project-members", projectId] })}
          />
        )}
      </div>

      <Card className="divide-y">
        {owner && <MemberRow profile={owner} role="Owner" />}
        {manager && manager.id !== owner?.id && <MemberRow profile={manager} role="Primary PM" />}
        {rows.map((m) => (
          <MemberRow
            key={m.id}
            profile={m.profile}
            fallbackName={m.name ?? undefined}
            fallbackEmail={m.email ?? undefined}
            kind={m.kind}
            role={m.role}
            onClick={() => setDetail(m)}
            roleSlot={
              <ProjectRoleSlot
                projectId={projectId}
                memberId={m.id}
                catalog={rolesCatalog.data ?? []}
                assigned={(memberRoles.data ?? []).filter((mr) => mr.project_member_id === m.id)}
                canManage={canManage}
                onChange={() => qc.invalidateQueries({ queryKey: ["project_member_roles", projectId] })}
              />
            }
            onRemove={canManage ? async () => {
              await supabase.from("project_members").delete().eq("id", m.id);
              qc.invalidateQueries({ queryKey: ["project-members", projectId] });
            } : undefined}
          />
        ))}
        {rows.length === 0 && !manager && (
          <p className="text-xs text-muted-foreground p-4 text-center">No additional members yet.</p>
        )}
      </Card>

      <MemberDetailDialog member={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}

function MemberRow({ profile, fallbackName, fallbackEmail, kind, role, roleSlot, onRemove, onClick }: {
  profile?: { id: string; full_name: string; avatar_url: string | null; job_title: string | null };
  fallbackName?: string;
  fallbackEmail?: string;
  kind?: MemberKind;
  role: string;
  roleSlot?: React.ReactNode;
  onRemove?: () => void | Promise<void>;
  onClick?: () => void;
}) {
  const name = profile?.full_name ?? fallbackName ?? "Unnamed";
  const subtitle = profile?.job_title ?? fallbackEmail ?? "";
  return (
    <div className="flex items-center gap-3 p-3 flex-wrap">
      <button
        type="button"
        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80"
        onClick={onClick}
        disabled={!onClick}
      >
        <Avatar className="h-9 w-9">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback>{name.slice(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </button>
      {kind && <Badge variant={kind === "ecam" ? "default" : kind === "customer" ? "secondary" : "outline"} className="text-[10px]">{KIND_LABEL[kind]}</Badge>}
      <span className="text-xs text-muted-foreground capitalize">{role}</span>
      {roleSlot}
      {onRemove && (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove()}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}
    </div>
  );
}

function MemberDetailDialog({ member, onOpenChange }: { member: MemberRecord | null; onOpenChange: (o: boolean) => void }) {
  const profile = useQuery({
    queryKey: ["profile-detail", member?.profile_id],
    queryFn: async () => member?.profile_id
      ? (await supabase.from("profiles").select("*").eq("id", member.profile_id).maybeSingle()).data
      : null,
    enabled: !!member?.profile_id,
  });
  const customer = useQuery({
    queryKey: ["customer-detail", member?.customer_id],
    queryFn: async () => member?.customer_id
      ? (await supabase.from("customers").select("*").eq("id", member.customer_id).maybeSingle()).data
      : null,
    enabled: !!member?.customer_id,
  });
  const vendor = useQuery({
    queryKey: ["vendor-detail", member?.vendor_id],
    queryFn: async () => member?.vendor_id
      ? (await supabase.from("vendors").select("*").eq("id", member.vendor_id).maybeSingle()).data
      : null,
    enabled: !!member?.vendor_id,
  });

  if (!member) return null;
  const displayName = profile.data?.full_name ?? member.name ?? "Unnamed";
  const email = profile.data?.email ?? member.email;
  const phone = profile.data?.phone ?? member.phone;
  const org = customer.data?.name ?? vendor.data?.name;

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Member details</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              {profile.data?.avatar_url && <AvatarImage src={profile.data.avatar_url} />}
              <AvatarFallback>{displayName.slice(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-base font-semibold truncate">{displayName}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant={member.kind === "ecam" ? "default" : member.kind === "customer" ? "secondary" : "outline"} className="text-[10px]">
                  {KIND_LABEL[member.kind]}
                </Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{member.role}</Badge>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {profile.data?.job_title && <p className="text-muted-foreground">{profile.data.job_title}</p>}
            {org && <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{org}</p>}
            {email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{email}</p>}
            {phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{phone}</p>}
            {profile.data?.department && <p className="text-muted-foreground text-xs">Department · {profile.data.department}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectRoleSlot({ projectId, memberId, catalog, assigned, canManage, onChange }: {
  projectId: string;
  memberId: string;
  catalog: { id: string; name: string }[];
  assigned: { id: string; role_id: string; project_member_id: string }[];
  canManage: boolean;
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<string | undefined>();
  const available = catalog.filter((c) => !assigned.some((a) => a.role_id === c.id));

  const removeRole = async (id: string) => {
    const { error } = await supabase.from("project_member_roles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };
  const addRole = async () => {
    if (!pick) return;
    const { error } = await supabase.from("project_member_roles").insert({
      project_id: projectId, project_member_id: memberId, role_id: pick,
    });
    if (error) return toast.error(error.message);
    setPick(undefined); setAdding(false); onChange();
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {assigned.map((a) => {
        const r = catalog.find((c) => c.id === a.role_id);
        if (!r) return null;
        return (
          <Badge key={a.id} variant="secondary" className="gap-1 text-[10px]">
            <Tag className="h-2.5 w-2.5" />{r.name}
            {canManage && <button type="button" onClick={() => removeRole(a.id)} className="hover:text-destructive ml-0.5"><X className="h-2.5 w-2.5" /></button>}
          </Badge>
        );
      })}
      {canManage && (adding ? (
        <div className="flex items-center gap-1">
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              {available.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={addRole}><Plus className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setAdding(false); setPick(undefined); }}><X className="h-3 w-3" /></Button>
        </div>
      ) : available.length > 0 && (
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3 mr-0.5" /> Role
        </Button>
      ))}
    </div>
  );
}

function AddMemberDialog({ projectId, projectCustomerId, projectVendorId, staff, existingProfileIds, existingCustomerContactIds, existingVendorContactIds, onAdded }: {
  projectId: string;
  projectCustomerId: string | null;
  projectVendorId: string | null;
  staff: { id: string; full_name: string }[];
  existingProfileIds: string[];
  existingCustomerContactIds: string[];
  existingVendorContactIds: string[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MemberKind>("ecam");
  const [profileId, setProfileId] = useState<string | undefined>();
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [contactId, setContactId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleName, setRoleName] = useState<string | undefined>();

  const rolesCatalog = useQuery({
    queryKey: ["project_roles_catalog"],
    queryFn: async () =>
      (await supabase.from("project_roles_catalog").select("id,name,access_level").order("name")).data ?? [],
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
      return (await (supabase.from(table) as never as { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: unknown[] | null }> } }).select("*").eq(fk, companyId)).data ?? [];
    },
    enabled: open && !!companyId && (kind === "customer" || kind === "vendor"),
  });

  // Auto-populate company from project when switching to customer/vendor
  useEffect(() => {
    if (!open) return;
    if (kind === "customer" && projectCustomerId && companyId !== projectCustomerId) {
      setCompanyId(projectCustomerId);
    } else if (kind === "vendor" && projectVendorId && companyId !== projectVendorId) {
      setCompanyId(projectVendorId);
    }
  }, [open, kind, projectCustomerId, projectVendorId]);

  const availableStaff = staff.filter((s) => !existingProfileIds.includes(s.id));
  const usedContactIds = kind === "customer" ? existingCustomerContactIds : kind === "vendor" ? existingVendorContactIds : [];
  const availableContacts = ((contacts.data ?? []) as Array<{ id: string; full_name: string; email: string | null; phone: string | null }>)
    .filter((c) => !usedContactIds.includes(c.id));


  const [ecamManual, setEcamManual] = useState(false);

  const reset = () => {
    setKind("ecam"); setProfileId(undefined); setCompanyId(undefined); setContactId(undefined);
    setName(""); setEmail(""); setPhone(""); setRoleName(undefined); setEcamManual(false);
  };

  const canSubmit = !!roleName && (
    (kind === "ecam" && !ecamManual && !!profileId) ||
    (kind === "ecam" && ecamManual && name.trim().length > 0) ||
    (kind === "manual" && name.trim().length > 0) ||
    ((kind === "customer" || kind === "vendor") && !!companyId && name.trim().length > 0)
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button size="sm"><UserPlus className="h-3.5 w-3.5 mr-1" /> Add member</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!canSubmit) return;
          const isEcamManual = kind === "ecam" && ecamManual;
          const payload: Record<string, unknown> = {
            project_id: projectId,
            role: roleName,
            kind,
            profile_id: kind === "ecam" && !ecamManual ? profileId : null,
            name: kind === "ecam" && !ecamManual ? null : name.trim(),
            email: kind === "ecam" && !ecamManual ? null : (email.trim() || null),
            phone: kind === "ecam" && !ecamManual ? null : (phone.trim() || null),
            customer_id: kind === "customer" ? companyId ?? null : null,
            customer_contact_id: kind === "customer" ? contactId ?? null : null,
            vendor_id: kind === "vendor" ? companyId ?? null : null,
            vendor_contact_id: kind === "vendor" ? contactId ?? null : null,
          };
          void isEcamManual;
          const { error } = await supabase.from("project_members").insert(payload as never);
          if (error) return toast.error(error.message);
          toast.success("Member added");
          setOpen(false); reset();
          onAdded();
        }} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => { setKind(v as MemberKind); setProfileId(undefined); setCompanyId(undefined); setContactId(undefined); setName(""); setEmail(""); setPhone(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ecam">eCam (internal staff)</SelectItem>
                <SelectItem value="customer">Customer contact</SelectItem>
                <SelectItem value="vendor">Vendor contact</SelectItem>
                <SelectItem value="manual">Manual entry</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "ecam" && (
            <div className="space-y-2">
              <Label>Staff</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {availableStaff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(kind === "customer" || kind === "vendor") && (
            <>
              <div className="space-y-2">
                <Label>{kind === "customer" ? "Customer company" : "Vendor company"}</Label>
                <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setContactId(undefined); setName(""); setEmail(""); setPhone(""); }}>
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
                    const c = (contacts.data as Array<{ id: string; full_name: string; email: string | null; phone: string | null }> | undefined)?.find((x) => x.id === v);
                    if (c) { setName(c.full_name ?? ""); setEmail(c.email ?? ""); setPhone(c.phone ?? ""); }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Pick a contact or type manually below" /></SelectTrigger>
                    <SelectContent>
                      {availableContacts.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No contacts available.</div>
                      ) : (
                        availableContacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {kind !== "ecam" && (
            <div className="space-y-2">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} /></div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Access</Label>
            <Select value={roleName} onValueChange={setRoleName}>
              <SelectTrigger><SelectValue placeholder="Select role from Project Config" /></SelectTrigger>
              <SelectContent>
                {(rolesCatalog.data ?? []).length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No roles yet. Add some in Project Config → Roles.</div>
                ) : (
                  (rolesCatalog.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name} <span className="text-muted-foreground">({r.access_level === "view" ? "View" : "Edit"})</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter><Button type="submit" disabled={!canSubmit}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
