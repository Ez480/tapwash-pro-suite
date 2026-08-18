import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { CrudTable, type Row } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/customers")({ component: AdminCustomers });

function AdminCustomers() {
  const { t, fmtDate } = useI18n();
  return (
    <CrudTable
      table="profiles"
      title={t("a_customers")}
      orderBy="created_at"
      canCreate={false}
      columns={[
        { key: "full_name", label: t("full_name") },
        { key: "email", label: "Email / البريد الإلكتروني" },
        { key: "phone", label: t("phone") },
        { key: "status", label: t("status"), render: (r: Row) => <Badge variant={r["status"] === "active" ? "default" : "destructive"}>{r["status"] === "active" ? t("active") : t("suspended")}</Badge> },
        { key: "created_at", label: t("activation_date"), render: (r) => fmtDate(String(r["created_at"])) },
      ]}
      fields={[
        { name: "full_name", label: t("full_name") },
        { name: "phone", label: t("phone") },
        { name: "avatar_url", label: t("avatar_url") },
        { name: "status", label: t("status"), type: "select", options: [{ value: "active", label: t("active") }, { value: "suspended", label: t("suspended") }] },
        { name: "language", label: t("language"), type: "select", options: [{ value: "ar", label: "العربية" }, { value: "en", label: "English" }] },
      ]}
    />
  );
}
