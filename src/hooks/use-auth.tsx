import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/auth.functions";

interface ProfileRow {
  id: string;
  username: string;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  status: string;
  avatar_url: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: ProfileRow | null;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      queryClient.invalidateQueries();
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const profileQuery = useQuery({
    queryKey: ["my-profile", session?.user?.id],
    queryFn: async () => {
      try {
        if (!session?.access_token) {
          return { profile: null, roles: [], isAdmin: false };
        }

        return await fetchProfile({
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch (err) {
        // Stale/expired session — clear it so the user lands on /login cleanly.
        if (err instanceof Error && /unauthorized/i.test(err.message)) {
          await supabase.auth.signOut();
          return { profile: null, roles: [], isAdmin: false };
        }
        throw err;
      }
    },
    enabled: !!session?.user && !!session?.access_token,
    retry: false,
  });

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading: loading || (!!session && profileQuery.isLoading),
    profile: (profileQuery.data?.profile as ProfileRow | null) ?? null,
    isAdmin: !!profileQuery.data?.isAdmin,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refresh: () => profileQuery.refetch(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
