import { createFileRoute } from "@tanstack/react-router";

import { StatCard } from "@/components/app/Shell";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const { t, fmtDate, fmtMoney, pick } = useI18n();
  const { data: customers } = useAdminTable("profiles", "*", "created_at");
  const { data: subs } = useAdminTable("subscriptions", "*, packages(title_en,title_ar)", "created_at");
  const { data: washes } = useAdminTable("washes", "*", "washed_at");
  const { data: payments } = useAdminTable("payments", "*", "paid_at");
  const { data: cards } = useAdminTable("nfc_cards", "*", "created_at");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const washesMonth = (washes ?? []).filter(
    (w) => new Date(String(w.washed_at)) >= monthStart,
  ).length;
  const revenueMonth = (payments ?? [])
    .filter((p) => new Date(String(p.paid_at)) >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const activeSubs = (subs ?? []).filter((s) => s.status === "active").length;
  const assigned = (cards ?? []).filter((c) => c.status === "assigned").length;
  const available = (cards ?? []).filter((c) => c.status === "available").length;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard tone="ink" label={t("total_customers")} value={(customers ?? []).length} />
        <StatCard tone="primary" label={t("active_subs")} value={activeSubs} />
        <StatCard label={t("washes_month")} value={washesMonth} />
        <StatCard label={t("revenue_month")} value={fmtMoney(revenueMonth)} />
        <StatCard label={t("assigned_cards")} value={assigned} />
        <StatCard label={t("available_cards")} value={available} />
        <StatCard label={t("a_packages")} value={new Set((subs ?? []).map((s) => s.package_id)).size} />
        <StatCard label={t("total_washes")} value={(washes ?? []).length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h3 className="text-lg font-bold">{t("recent_washes")}</h3>
          <div className="mt-4 space-y-2 text-sm">
            {(washes ?? []).slice(0, 8).map((w) => (
              <div
                key={String(w.id)}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <span>{fmtDate(String(w.washed_at))}</span>
                <span className="text-muted-foreground">{String(w.branch ?? "—")}</span>
              </div>
            ))}
            {(washes ?? []).length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
          </div>
        </section>

        <section className="panel p-6">
          <h3 className="text-lg font-bold">{t("recent_payments")}</h3>
          <div className="mt-4 space-y-2 text-sm">
            {(payments ?? []).slice(0, 8).map((p) => (
              <div
                key={String(p.id)}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <span>{fmtDate(String(p.paid_at))}</span>
                <span className="font-semibold">{fmtMoney(Number(p.amount ?? 0))}</span>
              </div>
            ))}
            {(payments ?? []).length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
          </div>
        </section>
      </div>

      <section className="panel mt-6 p-6">
        <h3 className="text-lg font-bold">{t("a_subscriptions")}</h3>
        <div className="mt-4 space-y-2 text-sm">
          {(subs ?? []).slice(0, 8).map((s) => {
            const pkg = s.packages as { title_en?: string; title_ar?: string } | null;
            return (
              <div
                key={String(s.id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
              >
                <span className="font-medium">
                  {pkg ? pick(pkg.title_en ?? "", pkg.title_ar ?? "") : "—"}
                </span>
                <span className="text-muted-foreground">
                  {String(s.used_washes ?? 0)} / {String(s.total_washes ?? 0)}
                </span>
                <span className="text-muted-foreground">{fmtDate(String(s.end_date))}</span>
              </div>
            );
          })}
          {(subs ?? []).length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
        </div>
      </section>
    </div>
  );
}
