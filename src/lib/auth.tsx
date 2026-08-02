import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(next ?? null);
      if (event === "SIGNED_OUT") queryClient.clear();
      else queryClient.invalidateQueries();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  return { session, user: session?.user ?? null, ready };
}

export function useIsAdmin(userId?: string | null) {
  return useQuery({
    queryKey: ["role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role);
    },
  });
}
