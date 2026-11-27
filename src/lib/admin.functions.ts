import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) throw new Error("An admin already exists");

    // First-admin recovery is intentionally fail-closed. Only the configured,
    // verified initial-admin email may claim the role when no admin exists.
    const initialAdminEmail = process.env["TAPWASH_INITIAL_ADMIN_EMAIL"]?.trim().toLowerCase();
    if (!initialAdminEmail) {
      throw new Error("First-admin setup is disabled. Configure TAPWASH_INITIAL_ADMIN_EMAIL in the server environment first.");
    }

    const { data: candidate, error: userError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userError) throw new Error(userError.message);
    const candidateEmail = candidate.user?.email?.trim().toLowerCase();
    if (!candidateEmail || candidateEmail !== initialAdminEmail || !candidate.user?.email_confirmed_at) {
      throw new Error("Only the configured, verified initial-admin email can claim the first admin role.");
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});
