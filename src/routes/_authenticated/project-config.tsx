import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Users, Tag, Package, Building, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/project-config")({
  component: ProjectConfigPage,
});

function ProjectConfigPage() {
  return (
    <div>
      <PageHeader
        title="Project Config"
        description="Manage the roles, products, customers and vendors used across all projects."
      />
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles"><Tag className="h-3.5 w-3.5 mr-1" /> Roles</TabsTrigger>
          <TabsTrigger value="products"><Package className="h-3.5 w-3.5 mr-1" /> Products</TabsTrigger>
          <TabsTrigger value="customers"><Building className="h-3.5 w-3.5 mr-1" /> Customers</TabsTrigger>
          <TabsTrigger value="vendors"><Truck className="h-3.5 w-3.5 mr-1" /> Vendors</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="mt-4"><RolesTab /></TabsContent>
        <TabsContent value="products" className="mt-4"><ProductsTab /></TabsContent>
        <TabsContent value="customers" className="mt-4"><CompaniesTab kind="customer" /></TabsContent>
        <TabsContent value="vendors" className="mt-4"><CompaniesTab kind="vendor" /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Roles ---------------- */

function RolesTab() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const roles = useQuery({
    queryKey: ["project_roles_catalog"],
    queryFn: async () => (await supabase.from("project_roles_catalog").select("*").order("name")).data ?? [],
  });

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <RoleDialog onSaved={() => qc.invalidateQueries({ queryKey: ["project_roles_catalog"] })}
            trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> New role</Button>} />
        </div>
      )}
      {(roles.data ?? []).length === 0 ? (
        <Card className="p-10 text-center border-dashed text-sm text-muted-foreground">No project roles yet.</Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(roles.data ?? []).map((r) => (
            <Card key={r.id} className="p-3 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{r.name}</p>
                {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
              </div>
              {isAdmin && (
                <>
                  <RoleDialog role={r} onSaved={() => qc.invalidateQueries({ queryKey: ["project_roles_catalog"] })}
                    trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                    if (!confirm(`Delete role "${r.name}"?`)) return;
                    const { error } = await supabase.from("project_roles_catalog").delete().eq("id", r.id);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: ["project_roles_catalog"] });
                  }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleDialog({ role, onSaved, trigger }: {
  role?: { id: string; name: string; description: string | null };
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role?.name ?? "");
  const [desc, setDesc] = useState(role?.description ?? "");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{role ? "Edit role" : "New role"}</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const payload = { name, description: desc || null };
          const { error } = role
            ? await supabase.from("project_roles_catalog").update(payload).eq("id", role.id)
            : await supabase.from("project_roles_catalog").insert(payload);
          if (error) return toast.error(error.message);
          toast.success("Saved");
          setOpen(false);
          onSaved();
        }} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={500} /></div>
          <DialogFooter><Button type="submit">{role ? "Save" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Products ---------------- */

function ProductsTab() {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const products = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });
  const vendors = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => (await supabase.from("vendors").select("id,name").order("name")).data ?? [],
  });
  const vendorMap = new Map((vendors.data ?? []).map((v) => [v.id, v.name]));
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ProductDialog ownerId={profile?.id ?? ""} vendors={vendors.data ?? []}
          onSaved={() => qc.invalidateQueries({ queryKey: ["products"] })}
          trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> New product</Button>} />
      </div>
      {(products.data ?? []).length === 0 ? (
        <Card className="p-10 text-center border-dashed text-sm text-muted-foreground">No products yet.</Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(products.data ?? []).map((p) => {
            const canEdit = isAdmin || p.created_by === profile?.id;
            const vendorName = p.vendor_id ? vendorMap.get(p.vendor_id) : null;
            return (
              <Card key={p.id} className="p-3 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  {p.code && <p className="text-[11px] text-muted-foreground">{p.code}</p>}
                  {vendorName && <p className="text-[11px] text-muted-foreground mt-0.5"><Truck className="inline h-3 w-3 mr-1" />{vendorName}</p>}
                  {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                </div>
                {canEdit && (
                  <ProductDialog product={p} ownerId={profile?.id ?? ""} vendors={vendors.data ?? []}
                    onSaved={() => qc.invalidateQueries({ queryKey: ["products"] })}
                    trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                )}
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                    if (!confirm(`Delete product "${p.name}"?`)) return;
                    const { error } = await supabase.from("products").delete().eq("id", p.id);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: ["products"] });
                  }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductDialog({ product, ownerId, vendors, onSaved, trigger }: {
  product?: { id: string; name: string; code: string | null; description: string | null; vendor_id?: string | null };
  ownerId: string;
  vendors: { id: string; name: string }[];
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product?.name ?? "");
  const [code, setCode] = useState(product?.code ?? "");
  const [desc, setDesc] = useState(product?.description ?? "");
  const [vendorId, setVendorId] = useState<string>(product?.vendor_id ?? "");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const payload = { name, code: code || null, description: desc || null };
          const { error } = product
            ? await supabase.from("products").update(payload).eq("id", product.id)
            : await supabase.from("products").insert({ ...payload, created_by: ownerId });
          if (error) return toast.error(error.message);
          toast.success("Saved");
          setOpen(false);
          onSaved();
        }} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Code / SKU</Label><Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={60} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={2000} /></div>
          <DialogFooter><Button type="submit">{product ? "Save" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Customers & Vendors (companies + contacts) ---------------- */

type Kind = "customer" | "vendor";
type Company = { id: string; name: string; contact_email: string | null; contact_phone: string | null; notes: string | null; created_by: string | null };

function CompaniesTab({ kind }: { kind: Kind }) {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const table = kind === "customer" ? "customers" : "vendors";
  const key = [table];

  const companies = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CompanyDialog kind={kind} ownerId={profile?.id ?? ""}
          onSaved={() => qc.invalidateQueries({ queryKey: key })}
          trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> New {kind}</Button>} />
      </div>
      {(companies.data ?? []).length === 0 ? (
        <Card className="p-10 text-center border-dashed text-sm text-muted-foreground">No {kind}s yet.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(companies.data ?? []).map((c) => {
            const canEdit = isAdmin || c.created_by === profile?.id;
            return (
              <Card key={c.id} className="p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    {c.contact_email && <p className="text-xs text-muted-foreground truncate">{c.contact_email}</p>}
                    {c.contact_phone && <p className="text-xs text-muted-foreground truncate">{c.contact_phone}</p>}
                  </div>
                  {canEdit && (
                    <CompanyDialog kind={kind} company={c} ownerId={profile?.id ?? ""}
                      onSaved={() => qc.invalidateQueries({ queryKey: key })}
                      trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                  )}
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                      if (!confirm(`Delete ${kind} "${c.name}"?`)) return;
                      const { error } = await supabase.from(table).delete().eq("id", c.id);
                      if (error) return toast.error(error.message);
                      qc.invalidateQueries({ queryKey: key });
                    }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  )}
                </div>
                <ContactsDialog kind={kind} company={c} canEdit={!!canEdit} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompanyDialog({ kind, company, ownerId, onSaved, trigger }: {
  kind: Kind;
  company?: Company;
  ownerId: string;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(company?.name ?? "");
  const [email, setEmail] = useState(company?.contact_email ?? "");
  const [phone, setPhone] = useState(company?.contact_phone ?? "");
  const [notes, setNotes] = useState(company?.notes ?? "");
  const table = kind === "customer" ? "customers" : "vendors";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{company ? `Edit ${kind}` : `New ${kind}`}</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const payload = { name, contact_email: email || null, contact_phone: phone || null, notes: notes || null };
          const { error } = company
            ? await supabase.from(table).update(payload).eq("id", company.id)
            : await supabase.from(table).insert({ ...payload, created_by: ownerId });
          if (error) return toast.error(error.message);
          toast.success("Saved");
          setOpen(false);
          onSaved();
        }} className="space-y-4">
          <div className="space-y-2"><Label>Company name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} /></div>
          <DialogFooter><Button type="submit">{company ? "Save" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Contact = { id: string; full_name: string; job_title: string | null; email: string | null; phone: string | null };

function ContactsDialog({ kind, company, canEdit }: { kind: Kind; company: Company; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const table = kind === "customer" ? "customer_contacts" : "vendor_contacts";
  const fkCol = kind === "customer" ? "customer_id" : "vendor_id";
  const key = [table, company.id];

  const contacts = useQuery({
    queryKey: key,
    queryFn: async () => (await (supabase.from(table) as never as { select: (s: string) => { eq: (c: string, v: string) => { order: (col: string) => Promise<{ data: Contact[] | null }> } } }).select("*").eq(fkCol, company.id).order("full_name")).data as Contact[] ?? [],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Users className="h-3.5 w-3.5 mr-1" /> Staff contacts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{company.name} — staff</DialogTitle></DialogHeader>
        {canEdit && (
          <ContactForm kind={kind} companyId={company.id} onSaved={() => qc.invalidateQueries({ queryKey: key })} />
        )}
        <div className="divide-y border-t mt-2">
          {(contacts.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No contacts yet.</p>
          ) : (
            (contacts.data ?? []).map((c) => (
              <div key={c.id} className="flex items-start gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.full_name}</p>
                  {c.job_title && <p className="text-[11px] text-muted-foreground">{c.job_title}</p>}
                  <p className="text-[11px] text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                </div>
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                    if (!confirm(`Delete ${c.full_name}?`)) return;
                    const { error } = await supabase.from(table).delete().eq("id", c.id);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: key });
                  }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactForm({ kind, companyId, onSaved }: { kind: Kind; companyId: string; onSaved: () => void }) {
  const table = kind === "customer" ? "customer_contacts" : "vendor_contacts";
  const fkCol = kind === "customer" ? "customer_id" : "vendor_id";
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (!name.trim()) return;
      const { error } = await supabase.from(table).insert({
        [fkCol]: companyId, full_name: name, job_title: title || null, email: email || null, phone: phone || null,
      } as never);
      if (error) return toast.error(error.message);
      setName(""); setTitle(""); setEmail(""); setPhone("");
      onSaved();
    }} className="grid grid-cols-2 gap-2 text-sm">
      <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      <Input placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
      <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />
      <div className="col-span-2 flex justify-end">
        <Button type="submit" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Add contact</Button>
      </div>
    </form>
  );
}
