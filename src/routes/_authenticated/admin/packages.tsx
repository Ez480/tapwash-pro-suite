import { createFileRoute } from "@tanstack/react-router";

import { CrudTable } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/packages")({
  component: AdminPackages,
});

function AdminPackages() {
  const { t, pick, fmtMoney } = useI18n();

  return (
    <CrudTable
      table="packages"
      title={t("a_packages")}
      orderBy="sort_order"
      columns={[
        { key: "title_en", label: t("title"), render: (r) => pick(String(r["title_en"]), String(r["title_ar"])) },
        { key: "price", label: t("price"), render: (r) => fmtMoney(Number(r["price"] ?? 0)) },
        { key: "washes_count", label: t("washes_count") },
        { key: "duration_days", label: t("duration_days") },
        { key: "sort_order", label: t("sort_order") },
      ]}
      fields={[
        { name: "title_en", label: t("title_en") },
        { name: "title_ar", label: t("title_ar") },
        { name: "description_en", label: t("desc_en"), type: "textarea" },
        { name: "description_ar", label: t("desc_ar"), type: "textarea" },
        { name: "price", label: t("price"), type: "number", defaultValue: 0 },
        { name: "washes_count", label: t("washes_count"), type: "number", defaultValue: 4 },
        { name: "duration_days", label: t("duration_days"), type: "number", defaultValue: 30 },
        { name: "features_en", label: t("features_en"), type: "list" },
        { name: "features_ar", label: t("features_ar"), type: "list" },
        { name: "sort_order", label: t("sort_order"), type: "number", defaultValue: 0 },
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
