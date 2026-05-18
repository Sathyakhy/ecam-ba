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
  const [username, setUsername] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await send({ data: { username: username.trim() } });
      setDone(true);
    } catch {
      toast.error("Could not send reset link");
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
        {done ? (
          <p className="mt-4 text-sm text-muted-foreground">
            If an account exists for that username, we've sent a password reset
            link to the email on file.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your username. We'll email a reset link to the address on
              file for that account.
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
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                Send reset link
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
