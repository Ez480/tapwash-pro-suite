import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    const roleNames = (roles ?? []).map((item) => item.role);
    if (!roleNames.includes("admin") && roleNames.includes("employee")) {
      throw redirect({ to: "/employee-tasks" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
