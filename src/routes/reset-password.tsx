import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { resolveUsernameToEmail } from "@/lib/auth.functions";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    username: typeof s.username === "string" ? s.username : "",
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/reset-password" });
  const resolve = useServerFn(resolveUsernameToEmail);

  const [username, setUsername] = useState(search.username ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return toast.error("Enter your username");
    if (!/^\d{6}$/.test(code.trim())) return toast.error("Enter the 6-digit code from your email");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");

    setSubmitting(true);
    try {
      const { email } = await resolve({ data: { username: username.trim() } });
      const { error: vErr } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "recovery",
      });
      if (vErr) throw new Error("Invalid or expired code");

      const { error: uErr } = await supabase.auth.updateUser({ password });
      if (uErr) throw new Error(uErr.message);

      // Don't leave the user signed in — force a fresh login with new password
      await supabase.auth.signOut();
      toast.success("Password updated. Please sign in.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-8">
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to sign in
        </Link>
        <h2 className="text-2xl font-semibold tracking-tight mt-4">Set a new password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the 6-digit code from your reset email and choose a new password.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={64} autoComplete="username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Verification code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" placeholder="123456" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" type="password" minLength={8} maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
