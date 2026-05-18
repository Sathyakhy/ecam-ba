import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Building } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_by: string | null;
};

function CustomersPage() {
  const { profile, isAdmin } = useAuth();
  const qc = useQueryClient();

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage internal or external stakeholders projects are delivered for."
        actions={
          <CustomerDialog
            ownerId={profile?.id ?? ""}
            onSaved={() => qc.invalidateQueries({ queryKey: ["customers"] })}
            trigger={<Button><Plus className="h-4 w-4 mr-1" /> New customer</Button>}
          />
        }
      />

      {customers.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (customers.data ?? []).length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Building className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm">No customers yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(customers.data ?? []).map((c) => {
            const canEdit = isAdmin || c.created_by === profile?.id;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    {c.contact_email && <p className="text-xs text-muted-foreground truncate">{c.contact_email}</p>}
                    {c.contact_phone && <p className="text-xs text-muted-foreground truncate">{c.contact_phone}</p>}
                  </div>
                  {canEdit && (
                    <CustomerDialog
                      customer={c}
                      ownerId={profile?.id ?? ""}
                      onSaved={() => qc.invalidateQueries({ queryKey: ["customers"] })}
                      trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>}
                    />
                  )}
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                      if (!confirm(`Delete customer "${c.name}"?`)) return;
                      const { error } = await supabase.from("customers").delete().eq("id", c.id);
                      if (error) return toast.error(error.message);
                      qc.invalidateQueries({ queryKey: ["customers"] });
                    }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  )}
                </div>
                {c.notes && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{c.notes}</p>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomerDialog({ customer, ownerId, onSaved, trigger }: {
  customer?: Customer;
  ownerId: string;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.contact_email ?? "");
  const [phone, setPhone] = useState(customer?.contact_phone ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{customer ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const payload = { name, contact_email: email || null, contact_phone: phone || null, notes: notes || null };
          const { error } = customer
            ? await supabase.from("customers").update(payload).eq("id", customer.id)
            : await supabase.from("customers").insert({ ...payload, created_by: ownerId });
          if (error) return toast.error(error.message);
          toast.success(customer ? "Saved" : "Customer created");
          setOpen(false);
          onSaved();
        }} className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} /></div>
          <DialogFooter><Button type="submit">{customer ? "Save" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
