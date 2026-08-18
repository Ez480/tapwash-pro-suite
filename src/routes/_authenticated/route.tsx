import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticatedMediaTools } from "@/components/app/AuthenticatedMediaTools";

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
    const isCustomer = roleNames.includes("customer") || (!isEmployee && !isAdmin);

    if (location.pathname === "/employee-tasks" && !isEmployee) {
      throw redirect({ to: isAdmin ? "/admin" : "/dashboard" });
    }

    if (isEmployee && !isAdmin && location.pathname !== "/employee-tasks") {
      throw redirect({ to: "/employee-tasks" });
    }

    if (location.pathname.startsWith("/admin") && !isAdmin) {
      throw redirect({ to: isEmployee ? "/employee-tasks" : "/dashboard" });
    }

    return { user: data.user, roles: roleNames, isCustomer };
  },
  component: () => <><Outlet /><AuthenticatedMediaTools /></>,
});
