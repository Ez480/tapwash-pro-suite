import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { CrudTable } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/cards")({
  component: AdminCards,
});

function AdminCards() {
  const { t, fmtDate } = useI18n();
  const { data: customers } = useAdminTable("profiles", "id, full_name, phone", "created_at");

  const customerOptions = (customers ?? []).map((c) => ({
    value: String(c.id),
    label: `${String(c.full_name ?? "-")} (${String(c.phone ?? "-")})`,
  }));

  const typeLabel = (v: unknown) =>
    v === "card" ? t("card") : v === "sticker" ? t("sticker") : t("keychain");

  return (
    <CrudTable
      table="nfc_cards"
      title={t("a_cards")}
      columns={[
        { key: "serial_number", label: t("serial_number") },
        { key: "uid", label: t("uid") },
        { key: "card_type", label: t("card_type"), render: (r) => typeLabel(r["card_type"]) },
        {
          key: "status",
          label: t("status"),
          render: (r) => (
            <Badge variant={r["status"] === "assigned" ? "default" : "secondary"}>
              {r["status"] === "assigned"
                ? t("assigned")
                : r["status"] === "blocked"
                  ? t("blocked")
                  : t("available")}
            </Badge>
          ),
        },
        {
          key: "customer_id",
          label: t("customer"),
          render: (r) =>
            customerOptions.find((c) => c.value === String(r["customer_id"]))?.label ?? "—",
        },
        {
          key: "activation_date",
          label: t("activation_date"),
          render: (r) => fmtDate(r["activation_date"] ? String(r["activation_date"]) : null),
        },
        {
          key: "created_at",
          label: t("created"),
          render: (r) => fmtDate(String(r["created_at"])),
        },
      ]}
      fields={[
        { name: "serial_number", label: t("serial_number") },
        { name: "uid", label: t("uid") },
        {
          name: "card_type",
          label: t("card_type"),
          type: "select",
          defaultValue: "card",
          options: [
            { value: "card", label: t("card") },
            { value: "sticker", label: t("sticker") },
            { value: "keychain", label: t("keychain") },
          ],
        },
        {
          name: "status",
          label: t("status"),
          type: "select",
          defaultValue: "available",
          options: [
            { value: "available", label: t("available") },
            { value: "assigned", label: t("assigned") },
            { value: "blocked", label: t("blocked") },
          ],
        },
        { name: "customer_id", label: t("customer"), type: "select", options: customerOptions },
        { name: "activation_date", label: t("activation_date"), type: "date" },
      ]}
    />
  );
}