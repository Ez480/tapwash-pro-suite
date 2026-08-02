import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SectionHeader } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: AdminReports,
});

const COLORS = ["#1F6FEB", "#0B1220", "#4C9AFF", "#7C3AED", "#0EA5E9", "#64748B"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(n: number) {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(monthKey(m));
  }
  return out;
}

function AdminReports() {
  const { t, pick, fmtMoney } = useI18n();
  const { data: washes } = useAdminTable("washes", "*", "washed_at");
  const { data: payments } = useAdminTable("payments", "*", "paid_at");
  const { data: subs } = useAdminTable("subscriptions", "*, packages(title_en,title_ar)", "created_at");

  const months = lastMonths(6);

  const washData = months.map((m) => ({
    month: m.slice(5),
    value: (washes ?? []).filter((w) => monthKey(new Date(String(w.washed_at))) === m).length,
  }));

  const revenueData = months.map((m) => ({
    month: m.slice(5),
    value: (payments ?? [])
      .filter((p) => monthKey(new Date(String(p.paid_at))) === m)
      .reduce((s, p) => s + Number(p.amount ?? 0), 0),
  }));

  const shareMap = new Map<string, number>();
  (subs ?? []).forEach((s) => {
    const pkg = s.packages as { title_en?: string; title_ar?: string } | null;
    const name = pkg ? pick(pkg.title_en ?? "—", pkg.title_ar ?? "—") : "—";
    shareMap.set(name, (shareMap.get(name) ?? 0) + 1);
  });
  const shareData = [...shareMap.entries()].map(([name, value]) => ({ name, value }));

  return (
    <div>
      <SectionHeader title={t("a_reports")} description={t("reports_note")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h3 className="text-lg font-bold">{t("washes_by_month")}</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={washData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#1F6FEB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-6">
          <h3 className="text-lg font-bold">{t("revenue_by_month")}</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                <Bar dataKey="value" fill="#0B1220" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-6 lg:col-span-2">
          <h3 className="text-lg font-bold">{t("packages_share")}</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={shareData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {shareData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
