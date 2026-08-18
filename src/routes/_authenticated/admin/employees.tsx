import { createFileRoute } from "@tanstack/react-router";

import { CrudTable } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  component: AdminEmployees,
});

function AdminEmployees() {
  const { t, pick } = useI18n();
  const employeeIdLabel = pick("Employee ID", "رقم ID الموظف");
  const nationalIdLabel = pick("National ID", "الرقم القومي");
  const cardNumberLabel = pick("Card number", "رقم البطاقة");
  const jobTitleLabel = t("job_title");

  return (
    <CrudTable
      table="employees"
      title={t("a_employees")}
      description={pick(
        "Manage employee identity, job title and branch information.",
        "إدارة بيانات الموظفين ورقم الـID والرقم القومي ورقم البطاقة والمسمى الوظيفي والفرع."
      )}
      columns={[
        { key: "employee_id", label: employeeIdLabel },
        { key: "national_id", label: nationalIdLabel },
        { key: "card_number", label: cardNumberLabel },
        { key: "full_name", label: t("full_name") },
        { key: "phone", label: t("phone") },
        { key: "job_title", label: jobTitleLabel },
        { key: "branch", label: t("branch") },
        { key: "status", label: t("status") },
      ]}
      fields={[
        { name: "employee_id", label: employeeIdLabel, required: true },
        { name: "national_id", label: nationalIdLabel, required: true },
        { name: "card_number", label: cardNumberLabel, required: true },
        { name: "full_name", label: t("full_name"), required: true },
        { name: "phone", label: t("phone") },
        { name: "job_title", label: jobTitleLabel },
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
