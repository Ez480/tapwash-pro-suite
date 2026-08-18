import { createFileRoute } from "@tanstack/react-router";

import { CrudTable } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/offers")({ component: AdminOffers });

function AdminOffers() {
  const { t, pick, fmtMoney, fmtDate } = useI18n();
  return <CrudTable
    table="offers"
    title={t("a_offers")}
    columns={[
      { key: "title_en", label: t("title"), render: (r) => <div className="flex items-center gap-3">{r["image_url"] ? <img src={String(r["image_url"])} alt="" className="size-12 rounded-lg object-cover" /> : null}<span>{pick(String(r["title_en"]), String(r["title_ar"]))}</span></div> },
      { key: "new_price", label: t("new_price"), render: (r) => fmtMoney(Number(r["new_price"] ?? 0)) },
      { key: "old_price", label: t("old_price"), render: (r) => fmtMoney(Number(r["old_price"] ?? 0)) },
      { key: "end_date", label: t("end_date"), render: (r) => fmtDate(r["end_date"] ? String(r["end_date"]) : null) },
      { key: "status", label: t("status") },
    ]}
    fields={[
      { name: "title_en", label: t("title_en") },
      { name: "title_ar", label: t("title_ar") },
      { name: "description_en", label: t("desc_en"), type: "textarea" },
      { name: "description_ar", label: t("desc_ar"), type: "textarea" },
      { name: "old_price", label: t("old_price"), type: "number" },
      { name: "new_price", label: t("new_price"), type: "number" },
      { name: "image_url", label: t("image_url"), type: "image" },
      { name: "start_date", label: t("start_date"), type: "date" },
      { name: "end_date", label: t("end_date"), type: "date" },
      { name: "status", label: t("status"), type: "select", defaultValue: "active", options: [{ value: "active", label: t("active") }, { value: "inactive", label: t("inactive") }] },
    ]}
  />;
}
