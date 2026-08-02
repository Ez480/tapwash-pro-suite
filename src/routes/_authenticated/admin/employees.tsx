import { createFileRoute } from "@tanstack/react-router";

import { CrudTable } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  component: AdminEmployees,
});

function AdminEmployees() {
  const { t } = useI18n();

  return (
    <CrudTable
      table="employees"
      title={t("a_employees")}
      columns={[
        { key: "full_name", label: t("full_name") },
        { key: "phone", label: t("phone") },
        { key: "job_title", label: t("job_title") },
        { key: "branch", label: t("branch") },
        { key: "status", label: t("status") },
      ]}
      fields={[
        { name: "full_name", label: t("full_name") },
        { name: "phone", label: t("phone") },
        { name: "job_title", label: t("job_title") },
        { name: "branch", label: t("branch") },
        {
          name: "status",
          label: t("status"),
          type: "select",
          defaultValue: "active",
          options: [
            { value: "active", label: t("active") },
            { value: "inactive", label: t("inactive") },
          ],
        },
      ]}
    />
  );
}
