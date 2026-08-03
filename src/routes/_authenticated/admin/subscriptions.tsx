import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrudTable, type Row } from "@/components/admin/Crud";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  component: AdminSubscriptions,
});

function AdminSubscriptions() {
  const { t, pick, fmtDate } = useI18n();
  const queryClient = useQueryClient();
  const { data: customers } = useAdminTable("profiles", "id, full_name, phone", "created_at");
  const { data: packages } = useAdminTable("packages", "id, title_en, title_ar", "sort_order");

  const customerOptions = (customers ?? []).map((c) => ({
    value: String(c.id),
    label: `${String(c.full_name ?? "-")} (${String(c.phone ?? "-")})`,
  }));
  const packageOptions = (packages ?? []).map((p) => ({
    value: String(p.id),
    label: pick(String(p.title_en), String(p.title_ar)),
  }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "washes"] });
  };

  const addWash = async (row: Row) => {
    const used = Number(row["used_washes"] ?? 0);
    const total = Number(row["total_washes"] ?? 0);

    if (used >= total) {
      toast.error(t("no_washes_left"));
      return;
    }

    if (row["status"] !== "active") {
      toast.error(t("subscription_not_active"));
      return;
    }

    const { error } = await supabase.from("washes").insert({
      customer_id: String(row["customer_id"]),
      subscription_id: String(row["id"]),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("subscriptions")
      .update({ used_washes: used + 1 })
      .eq("id", String(row["id"]));
    toast.success(t("saved"));
    refresh();
  };

  const removeWash = async (row: Row) => {
    const used = Number(row["used_washes"] ?? 0);
    if (used <= 0) return;
    const { error } = await supabase
      .from("subscriptions")
      .update({ used_washes: used - 1 })
      .eq("id", String(row["id"]));
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("saved"));
    refresh();
  };

  return (
    <CrudTable
      table="subscriptions"
      title={t("a_subscriptions")}
      select="*, packages(title_en,title_ar)"
      columns={[
        { key: "id", label: "ID" },
        {
          key: "customer_id",
          label: t("customer"),
          render: (r) =>
            customerOptions.find((c) => c.value === String(r["customer_id"]))?.label ?? "—",
        },
        {
          key: "package_id",
          label: t("package"),
          render: (r) =>
            packageOptions.find((p) => p.value === String(r["package_id"]))?.label ?? "—",
        },
        {
          key: "used_washes",
          label: t("used_washes"),
          render: (r) => `${String(r["used_washes"] ?? 0)} / ${String(r["total_washes"] ?? 0)}`,
        },
        { key: "start_date", label: t("start_date"), render: (r) => fmtDate(String(r["start_date"])) },
        { key: "end_date", label: t("end_date"), render: (r) => fmtDate(String(r["end_date"])) },
        {
          key: "created_at",
          label: t("created"),
          render: (r) => fmtDate(String(r["created_at"])),
        },
        {
          key: "status",
          label: t("status"),
          render: (r) => (
            <Badge variant={r["status"] === "active" ? "default" : "secondary"}>
              {r["status"] === "active"
                ? t("active")
                : r["status"] === "expired"
                  ? t("expired")
                  : r["status"] === "cancelled"
                    ? t("cancelled")
                    : t("pending")}
            </Badge>
          ),
        },
      ]}
      fields={[
        { name: "customer_id", label: t("customer"), type: "select", options: customerOptions },
        { name: "package_id", label: t("package"), type: "select", options: packageOptions },
        { name: "total_washes", label: t("total_washes"), type: "number", defaultValue: 4 },
        { name: "used_washes", label: t("used_washes"), type: "number", defaultValue: 0 },
        { name: "start_date", label: t("start_date"), type: "date" },
        { name: "end_date", label: t("end_date"), type: "date" },
        {
          name: "status",
          label: t("status"),
          type: "select",
          defaultValue: "active",
          options: [
            { value: "active", label: t("active") },
            { value: "pending", label: t("pending") },
            { value: "expired", label: t("expired") },
            { value: "cancelled", label: t("cancelled") },
          ],
        },
      ]}
      rowActions={(row) => (
        <>
          <Button variant="outline" size="sm" onClick={() => addWash(row)}>
            <Plus className="me-1 size-3.5" />
            {t("add_wash")}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => removeWash(row)} aria-label={t("remove_wash")}>
            <Minus className="size-4" />
          </Button>
        </>
      )}
    />
  );
}