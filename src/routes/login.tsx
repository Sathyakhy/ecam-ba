import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { useAppSettings } from "@/hooks/use-app-settings";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { resolveUsernameToEmail } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const resolve = useServerFn(resolveUsernameToEmail);
  const settings = useAppSettings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    try {
      const { email } = await resolve({ data: { username: username.trim() } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background relative">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <div className="hidden lg:flex relative bg-gradient-to-br from-primary to-[oklch(0.42_0.18_265)] text-primary-foreground p-12">
        <div className="flex flex-col justify-between w-full">
          <div className="flex items-center gap-2 font-semibold">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={settings.app_name} className="h-7 w-7 rounded object-cover" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
            {settings.app_name}
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight leading-tight whitespace-pre-line">
              {settings.hero_title}
            </h1>
            <p className="mt-4 text-primary-foreground/80 max-w-md">
              {settings.hero_description}
            </p>
          </div>
          <p className="text-xs text-primary-foreground/60">Internal use only · Authorized personnel</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md p-8 border-border/60 shadow-sm">
          <div className="lg:hidden flex items-center gap-2 font-semibold mb-6">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={settings.app_name} className="h-6 w-6 rounded object-cover" />
            ) : (
              <Building2 className="h-5 w-5 text-primary" />
            )}
            {settings.app_name}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Use your department username and password.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={64}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={128}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-6">
            Accounts are created by your department admin. Contact them if you
            don't have access.
          </p>
        </Card>
      </div>
    </div>
  );
}
