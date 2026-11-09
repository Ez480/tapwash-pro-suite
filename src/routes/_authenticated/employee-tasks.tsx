import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeDashboard } from "@/features/dashboards/employee/EmployeeDashboard";

export const Route = createFileRoute("/_authenticated/employee-tasks")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const roleNames = (roleRows ?? []).map((row) => String(row.role));
    if (!roleNames.includes("employee")) throw redirect({ to: roleNames.includes("admin") ? "/admin" : "/dashboard" });
  },
  component: EmployeeDashboard,
});
