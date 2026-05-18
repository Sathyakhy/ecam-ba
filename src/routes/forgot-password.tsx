import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/auth.functions";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const send = useServerFn(requestPasswordReset);
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await send({ data: { username: username.trim() } });
      toast.success("If that account exists, a code has been emailed.");
      navigate({ to: "/reset-password", search: { username: username.trim() } });
    } catch {
      toast.error("Could not send reset code");
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
        <h2 className="text-2xl font-semibold tracking-tight mt-4">Reset password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your username. We'll email a 6-digit verification code to the
          address on file. You'll use it on the next step to set a new password.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={64}
              autoComplete="username"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Sending…" : "Send verification code"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Already have a code? <Link to="/reset-password" search={{ username: "" }} className="underline">Enter it here</Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
