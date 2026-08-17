import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    if (rolesError) throw rolesError;

    const roleNames = (roles ?? []).map((item) => item.role as string);
    const isEmployee = roleNames.includes("employee");
    const isAdmin = roleNames.includes("admin");

    // Employees should be routed to their dedicated dashboard, but never
    // redirect /employee-tasks back to itself (which caused a redirect loop
    // and the "go back / retry" error page).
    if (isEmployee && !isAdmin && location.pathname !== "/employee-tasks") {
      throw redirect({ to: "/employee-tasks" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
