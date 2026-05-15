import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAppSettings } from "@/lib/settings.functions";

export interface AppSettings {
  app_name: string;
  tagline: string;
  hero_title: string;
  hero_description: string;
  logo_url: string | null;
}

const FALLBACK: AppSettings = {
  app_name: "Department OS",
  tagline: "Internal workspace",
  hero_title: "Onboarding, learning, and team operations.",
  hero_description:
    "A single internal workspace to onboard new staff, run training, track tasks and keep your department coordinated.",
  logo_url: null,
};

export function useAppSettings(): AppSettings {
  const fetchFn = useServerFn(getAppSettings);
  const { data } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });
  return (data?.settings as AppSettings | undefined) ?? FALLBACK;
}
