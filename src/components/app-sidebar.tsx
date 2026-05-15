import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  UserPlus,
  GraduationCap,
  Users,
  CheckSquare,
  Megaphone,
  ShieldCheck,
  Building2,
  Settings,
  LogOut,
  UserCircle,
  Network,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAppSettings } from "@/hooks/use-app-settings";

const main = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Onboarding", url: "/onboarding", icon: UserPlus },
  { title: "Learning", url: "/learning", icon: GraduationCap },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Staff", url: "/staff", icon: Users },
  { title: "Org chart", url: "/org-chart", icon: Network },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "My profile", url: "/profile", icon: UserCircle },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { profile, isAdmin, signOut } = useAuth();
  const settings = useAppSettings();
  const initials = (profile?.full_name ?? profile?.username ?? "U")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={settings.app_name}
              className="h-8 w-auto max-w-[140px] object-contain shrink-0 [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.85))_drop-shadow(0_0_12px_rgba(255,255,255,0.5))]"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
          )}
          <div className="flex flex-col text-sm group-data-[collapsible=icon]:hidden">
            <span className="font-semibold leading-none">{settings.app_name}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{settings.tagline}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path.startsWith("/admin")}>
                    <Link to="/admin">
                      <ShieldCheck className="h-4 w-4" />
                      <span>User management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path.startsWith("/settings")}>
                    <Link to="/settings">
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar className="h-8 w-8">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
            <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col text-xs min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="font-medium truncate">{profile?.full_name ?? "—"}</span>
            <span className="text-muted-foreground truncate">
              {isAdmin ? "Admin" : "Staff"} · @{profile?.username}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 group-data-[collapsible=icon]:hidden"
            onClick={() => signOut()}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
