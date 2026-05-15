import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading workspace…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        No profile linked to this account. Contact an admin.
      </div>
    );
  }

  // Gate: staff who haven't completed onboarding can only see their plan.
  if (!profile.onboarded && !isAdmin) {
    const target = `/onboarding/${profile.id}`;
    if (location.pathname !== target) {
      return <Navigate to="/onboarding/$profileId" params={{ profileId: profile.id }} replace />;
    }
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="h-14 flex items-center gap-3 border-b border-border px-4 sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="font-semibold text-sm">Welcome, {profile.full_name}</div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            Complete your onboarding to unlock the workspace
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b border-border px-3 sm:px-4 sticky top-0 bg-background/95 backdrop-blur z-10">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground hidden sm:block">Department workspace</div>
            <div className="ml-auto"><ThemeToggle /></div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
