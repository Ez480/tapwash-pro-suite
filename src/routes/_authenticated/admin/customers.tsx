import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { CrudTable, type Row } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const { t, fmtDate } = useI18n();
  const { data: subscriptions } = useAdminTable(
    "subscriptions",
    "*, packages(title_en,title_ar)",
    "created_at",
  );

  return (
    <CrudTable
      table="profiles"
      title={t("a_customers")}
      orderBy="created_at"
      canCreate={false}
      columns={[
        { key: "full_name", label: t("full_name") },
        { key: "phone", label: t("phone") },
        {
          key: "status",
          label: t("status"),
          render: (r: Row) => (
            <Badge variant={r["status"] === "active" ? "default" : "destructive"}>
              {r["status"] === "active" ? t("active") : t("suspended")}
            </Badge>
          ),
        },
        {
          key: "created_at",
          label: t("activation_date"),
          render: (r) => fmtDate(String(r["created_at"])),
        },
        {
          key: "subscription",
          label: t("subscription_status"),
          render: (r: Row) => {
            const sub = subscriptions?.find((s) => s.customer_id === r["id"]);

            return sub ? (
              <Badge variant={sub.status === "active" ? "default" : "destructive"}>
                {sub.status}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          },
        },
      ]}
      fields={[
        { name: "full_name", label: t("full_name") },
        { name: "phone", label: t("phone") },
        { name: "avatar_url", label: t("avatar_url") },
        {
          name: "status",
          label: t("status"),
          type: "select",
          options: [
            { value: "active", label: t("active") },
            { value: "suspended", label: t("suspended") },
          ],
        },
        {
          name: "language",
          label: t("language"),
          type: "select",
          options: [
            { value: "ar", label: "العربية" },
            { value: "en", label: "English" },
          ],
        },
      ]}
    />
  );
}