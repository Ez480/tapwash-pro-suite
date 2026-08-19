import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: async () => { const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).single(); if (error) throw error; return data; } });
}
export function usePage(slug: string) { return useQuery({ queryKey: ["page", slug], queryFn: async () => { const { data, error } = await supabase.from("site_pages").select("*").eq("slug", slug).maybeSingle(); if (error) throw error; return data; } }); }
export function usePages() { return useQuery({ queryKey: ["pages"], queryFn: async () => { const { data, error } = await supabase.from("site_pages").select("*").order("slug"); if (error) throw error; return data ?? []; } }); }
export function usePackages() { return useQuery({ queryKey: ["packages"], queryFn: async () => { const { data, error } = await supabase.from("packages").select("*").order("sort_order", { ascending: true }); if (error) throw error; return data ?? []; } }); }
export function useOffers() { return useQuery({ queryKey: ["offers"], queryFn: async () => { const { data, error } = await supabase.from("offers").select("*").order("created_at", { ascending: false }); if (error) throw error; return data ?? []; } }); }
export function useProfile(userId?: string | null) { return useQuery({ queryKey: ["profile", userId], enabled: !!userId, queryFn: async () => { const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(); if (error) throw error; return data; } }); }
export function useMySubscription(userId?: string | null) { return useQuery({ queryKey: ["my-subscription", userId], enabled: !!userId, queryFn: async () => { const { data, error } = await supabase.from("subscriptions").select("*, packages(*)").eq("customer_id", userId!).order("start_date", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data; } }); }
export function useMyWashes(userId?: string | null) { return useQuery({ queryKey: ["my-washes", userId], enabled: !!userId, queryFn: async () => { const { data, error } = await supabase.from("washes").select("*").eq("customer_id", userId!).order("washed_at", { ascending: false }).limit(20); if (error) throw error; return data ?? []; } }); }
export function useMyCards(userId?: string | null) { return useQuery({ queryKey: ["my-cards", userId], enabled: !!userId, queryFn: async () => { const { data, error } = await supabase.from("nfc_cards").select("*").eq("customer_id", userId!); if (error) throw error; return data ?? []; } }); }
export function useMyNotifications(userId?: string | null) { return useQuery({ queryKey: ["my-notifications", userId], enabled: !!userId, queryFn: async () => { const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(10); if (error) throw error; return data ?? []; } }); }

/** Employee dashboard data. Resolves the employee by the authenticated user's id first, then by email. */
export function useMyEmployee(userId?: string | null) {
  return useQuery({
    queryKey: ["my-employee", userId],
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      if (!userId) return null;

      const fields = "id,user_id,employee_id,national_id,card_number,job_title,branch,full_name,email,phone,status,created_at,updated_at";

      // Primary lookup: exact authenticated user id.
      const byUser = await supabase.from("employees").select(fields).eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (byUser.error) {
        console.error("Employee lookup by user_id failed:", byUser.error);
        throw byUser.error;
      }
      if (byUser.data) return byUser.data;

      // Recovery lookup: the employee email must match the authenticated account email.
      // This repairs legacy/stale user_id links without exposing other employee rows.
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const email = authData.user?.email?.trim().toLowerCase();
      if (!email) return null;

      const byEmail = await supabase.from("employees").select(fields).eq("email", email).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (byEmail.error) {
        console.error("Employee lookup by email failed:", byEmail.error);
        throw byEmail.error;
      }
      if (byEmail.data) return byEmail.data;

      return null;
    },
  });
}

export function useAdminTable<T extends string>(table: T, select = "*", orderBy = "created_at") {
  return useQuery({ queryKey: ["admin", table], staleTime: 0, refetchOnWindowFocus: true, refetchOnReconnect: true, queryFn: async () => { const { data, error } = await supabase.from(table as any).select(select).order(orderBy, { ascending: false }); if (error) throw error; return (data ?? []) as any[]; } });
}
