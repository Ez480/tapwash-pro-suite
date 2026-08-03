import { createFileRoute } from "@tanstack/react-router";

import { CrudTable } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: AdminNotifications,
});

function AdminNotifications() {
  const { t, fmtDate } = useI18n();
  const { data: customers } = useAdminTable("profiles", "id, full_name, phone", "created_at");
  const customerOptions = [
    { value: "", label: t("broadcast") },
    ...(customers ?? []).map((c) => ({
      value: String(c.id),
      label: `${String(c.full_name ?? "-")} (${String(c.phone ?? "-")})`,
    })),
  ];

  return (
    <CrudTable
      table="notifications"
      title={t("a_notifications")}
      columns={[
        { key: "id", label: "ID" },
        { key: "title", label: t("title") },
        { key: "message", label: t("message") },
        {
          key: "customer_id",
          label: t("customer"),
          render: (r) =>
            r["customer_id"]
              ? (customerOptions.find((c) => c.value === String(r["customer_id"]))?.label ?? "—")
              : t("broadcast"),
        },
        {
          key: "created_at",
          label: "Created",
          render: (r) => fmtDate(String(r["created_at"])),
        },
      ]}
      fields={[
        { name: "title", label: t("title") },
        { name: "message", label: t("message"), type: "textarea" },
        { name: "customer_id", label: t("customer"), type: "select", options: customerOptions },
      ]}
    />
  );
}