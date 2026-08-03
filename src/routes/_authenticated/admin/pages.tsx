import { createFileRoute } from "@tanstack/react-router";

import { CrudTable } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/pages")({
  component: AdminPages,
});

function AdminPages() {
  const { t, pick, fmtDate } = useI18n();

  return (
    <CrudTable
      table="site_pages"
      title={t("a_pages")}
      orderBy="slug"
      canCreate={false}
      canDelete={false}
      columns={[
        { key: "id", label: "ID" },
        { key: "slug", label: t("slug") },
        {
          key: "title_en",
          label: t("title"),
          render: (r) => pick(String(r["title_en"]), String(r["title_ar"])),
        },
        { key: "title_ar", label: t("title_ar") },
        {
          key: "created_at",
          label: "Created",
          render: (r) => fmtDate(String(r["created_at"])),
        },
      ]}
      fields={[
        { name: "title_en", label: t("title_en") },
        { name: "title_ar", label: t("title_ar") },
        { name: "subtitle_en", label: t("subtitle_en") },
        { name: "subtitle_ar", label: t("subtitle_ar") },
        { name: "content_en", label: t("content_en"), type: "textarea" },
        { name: "content_ar", label: t("content_ar"), type: "textarea" },
      ]}
    />
  );
}