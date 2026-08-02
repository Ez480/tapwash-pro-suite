import { createFileRoute } from "@tanstack/react-router";

import { CrudTable } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPayments,
});

function AdminPayments() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const { data: customers } = useAdminTable("profiles", "id, full_name, phone", "created_at");
  const customerOptions = (customers ?? []).map((c) => ({
    value: String(c.id),
    label: String(c.full_name ?? c.phone ?? c.id),
  }));

  return (
    <CrudTable
      table="payments"
      title={t("a_payments")}
      orderBy="paid_at"
      columns={[
        {
          key: "customer_id",
          label: t("customer"),
          render: (r) =>
            customerOptions.find((c) => c.value === String(r["customer_id"]))?.label ?? "—",
        },
        { key: "amount", label: t("amount"), render: (r) => fmtMoney(Number(r["amount"] ?? 0)) },
        { key: "method", label: t("method") },
        { key: "reference", label: t("reference") },
        { key: "paid_at", label: t("paid_at"), render: (r) => fmtDate(String(r["paid_at"])) },
        { key: "status", label: t("status") },
      ]}
      fields={[
        { name: "customer_id", label: t("customer"), type: "select", options: customerOptions },
        { name: "amount", label: t("amount"), type: "number", defaultValue: 0 },
        {
          name: "method",
          label: t("method"),
          type: "select",
          defaultValue: "cash",
          options: [
            { value: "cash", label: "Cash" },
            { value: "instapay", label: "InstaPay" },
            { value: "vodafone_cash", label: "Vodafone Cash" },
            { value: "card", label: t("card") },
          ],
        },
        { name: "reference", label: t("reference") },
        { name: "paid_at", label: t("paid_at"), type: "date" },
        {
          name: "status",
          label: t("status"),
          type: "select",
          defaultValue: "active",
          options: [
            { value: "active", label: t("active") },
            { value: "pending", label: t("pending") },
            { value: "cancelled", label: t("cancelled") },
          ],
        },
      ]}
    />
  );
}
