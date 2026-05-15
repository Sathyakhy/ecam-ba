import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { setupNeeded, bootstrapFirstAdmin } from "@/lib/setup.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  const check = useServerFn(setupNeeded);
  const create = useServerFn(bootstrapFirstAdmin);
  const navigate = useNavigate();
  const status = useQuery({ queryKey: ["setup-needed"], queryFn: () => check() });

  const [form, setForm] = useState({ username: "", full_name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  if (status.isLoading) return null;
  if (status.data && !status.data.needed) return <Navigate to="/login" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await create({ data: form });
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) throw error;
      toast.success("Welcome — your admin account is ready");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5" /><span className="font-semibold">First-time setup</span></div>
        <h1 className="text-2xl font-semibold tracking-tight mt-3">Create your admin account</h1>
        <p className="text-sm text-muted-foreground mt-1">This account will manage staff, onboarding and training.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} required pattern="[a-zA-Z0-9_.\-]+" minLength={3} maxLength={32} /></div>
            <div className="space-y-2"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={120} /></div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} /></div>
          <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} maxLength={128} /></div>
          <Button type="submit" className="w-full" disabled={submitting}>Create admin & sign in</Button>
        </form>
      </Card>
    </div>
  );
}
