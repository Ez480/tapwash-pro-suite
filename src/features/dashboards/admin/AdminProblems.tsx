import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

type Row = any;
type Data = { tasks: Row[]; payments: Row[]; requests: Row[]; support: Row[]; messages: Row[]; presence: Row[]; roles: Row[]; profiles: Row[] };
type Kind = "orders" | "payments" | "support" | "staff";
type Problem = { key: string; kind: Kind; title: string; sub: string; to: string; toLabel: string; urgent?: boolean };

const STUCK_MINUTES = 45;
const FAILED = ["failed", "rejected", "declined"];
const OPEN_TASK = ["pending", "accepted", "in_progress"];

export function AdminProblems() {
  const { pick } = useI18n();
  const db = supabase as any;
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<Data>({ tasks: [], payments: [], requests: [], support: [], messages: [], presence: [], roles: [], profiles: [] });

  const load = useCallback(async () => {
    setLoading(true);
    const names = ["tasks", "payments", "requests", "support", "messages", "presence", "roles", "profiles"];
    const results = await Promise.all([
      db.from("employee_tasks").select("*").order("updated_at", { ascending: false }).limit(300),
      db.from("payments").select("*").order("created_at", { ascending: false }).limit(300),
      db.from("subscription_requests").select("*").order("created_at", { ascending: false }).limit(300),
      db.from("support_messages").select("*").order("created_at", { ascending: false }).limit(2000),
      db.from("customer_messages").select("*").eq("is_read", false).order("created_at", { ascending: false }).limit(200),
      db.from("employee_presence").select("*").limit(500),
      db.from("user_roles").select("user_id").eq("role", "employee"),
      db.from("profiles").select("id,full_name").limit(2000),
    ]);
    const next: any = { tasks: [], payments: [], requests: [], support: [], messages: [], presence: [], roles: [], profiles: [] };
    const errors: string[] = [];
    results.forEach((r: any, i: number) => { next[names[i]!] = r.data ?? []; if (r.error) errors.push(String(r.error.message)); });
    setData(next);
    setError(errors.join(" | "));
    setLoading(false);
  }, [db]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const problems = useMemo<Problem[]>(() => {
    const out: Problem[] = [];
    const now = Date.now();
    const nameOf = (id: any) => (data.profiles ?? []).find((p: Row) => String(p.id) === String(id))?.full_name || "—";
    (data.tasks ?? []).forEach((task: Row) => {
      if (!OPEN_TASK.includes(String(task.status ?? "").toLowerCase())) return;
      if (task.scheduled_at && new Date(task.scheduled_at).getTime() > now) return;
      const age = Math.round((now - new Date(task.updated_at || task.created_at).getTime()) / 60000);
      if (!Number.isFinite(age) || age < STUCK_MINUTES) return;
      out.push({ key: \`o-\${task.id}\`, kind: "orders", urgent: age >= 120, title: pick(\`Order #\${task.serial_number ?? String(task.id).slice(0, 8)} stuck for \${age} min\`, \`أوردر #\${task.serial_number ?? String(task.id).slice(0, 8)} واقف من \${age} دقيقة\`), sub: \`\${pick("Customer", "العميل")}: \${task.customer_name || "—"} · \${pick("Employee", "الموظف")}: \${task.employee_id ? nameOf(task.employee_id) : pick("not assigned", "غير معيّن")}\`, to: "/admin/live-orders", toLabel: pick("Open live orders", "فتح متابعة الأوردرات") });
    });
    (data.payments ?? []).forEach((p: Row) => {
      if (!FAILED.includes(String(p.status ?? "").toLowerCase())) return;
      out.push({ key: \`p-\${p.id}\`, kind: "payments", title: pick("Failed payment", "دفع فاشل"), sub: \`\${pick("Customer", "العميل")}: \${nameOf(p.customer_id)} · \${Number(p.amount ?? 0).toFixed(2)} EGP\`, to: "/admin/payments", toLabel: pick("Open payments", "فتح المدفوعات") });
    });
    (data.requests ?? []).forEach((r: Row) => {
      if (!FAILED.includes(String(r.payment_status ?? "").toLowerCase())) return;
      out.push({ key: \`r-\${r.id}\`, kind: "payments", title: pick("Subscription payment rejected", "دفع اشتراك مرفوض"), sub: \`\${pick("Customer", "العميل")}: \${nameOf(r.customer_id)} · \${Number(r.amount ?? 0).toFixed(2)} EGP\`, to: "/admin/daily", toLabel: pick("Open today", "فتح صفحة اليوم") });
    });
    const unreadByEmployee = new Map<string, { n: number; last: string }>();
    (data.support ?? []).forEach((m: Row) => { if (m.sender_role === "employee" && !m.read_at) { const cur = unreadByEmployee.get(String(m.employee_id)); unreadByEmployee.set(String(m.employee_id), { n: (cur?.n ?? 0) + 1, last: cur?.last ?? m.created_at }); } });
    unreadByEmployee.forEach((v, id) => out.push({ key: \`s-\${id}\`, kind: "support", title: pick(\`\${v.n} unread support message(s)\`, \`\${v.n} رسالة دعم لم تُقرأ\`), sub: \`\${pick("Employee", "الموظف")}: \${nameOf(id)}\`, to: "/admin/support", toLabel: pick("Open support", "فتح الدعم") }));
    (data.messages ?? []).forEach((m: Row) => out.push({ key: \`m-\${m.id}\`, kind: "support", title: pick("Unread customer message", "رسالة عميل لم تُقرأ"), sub: \`\${m.customer_name || "—"} · \${String(m.message ?? "").slice(0, 60)}\`, to: "/admin/messages", toLabel: pick("Open messages", "فتح الرسائل") }));
    const employeeIds = (data.roles ?? []).map((r: Row) => String(r.user_id));
    employeeIds.forEach((id: string) => {
      const row = (data.presence ?? []).find((p: Row) => String(p.employee_id) === id);
      const fresh = Boolean(row?.is_online && now - new Date(row.updated_at).getTime() < 2 * 60 * 1000);
      if (fresh) return;
      const task = (data.tasks ?? []).find((t: Row) => String(t.employee_id) === id && OPEN_TASK.includes(String(t.status ?? "").toLowerCase()));
      if (!task) return;
      out.push({ key: \`e-\${id}\`, kind: "staff", title: pick("Employee offline with an open order", "موظف أوفلاين ومعه أوردر"), sub: \`\${nameOf(id)} · #\${task.serial_number ?? String(task.id).slice(0, 8)}\`, to: "/admin/employees", toLabel: pick("Open employees", "فتح الموظفين") });
    });
    return out;
  }, [data, pick]);

  const count = (k: Kind) => problems.filter((p) => p.kind === k).length;
  const shown = problems.filter((p) => filter === "all" || p.kind === filter);
  const tabs: { id: "all" | Kind; label: string }[] = [
    { id: "all", label: pick("All", "الكل") },
    { id: "orders", label: pick("Orders", "أوردرات") },
    { id: "payments", label: pick("Payments", "مدفوعات") },
    { id: "support", label: pick("Support", "دعم") },
    { id: "staff", label: pick("Staff", "موظفين") },
  ];
  const cards: { kind: Kind; label: string; color: string }[] = [
    { kind: "orders", label: pick("Stuck orders", "أوردرات واقفة"), color: "text-amber-500" },
    { kind: "payments", label: pick("Failed payments", "دفع فاشل"), color: "text-destructive" },
    { kind: "support", label: pick("Open support", "دعم مفتوح"), color: "text-primary" },
    { kind: "staff", label: pick("Offline staff with orders", "موظف أوفلاين بأوردر"), color: "text-muted-foreground" },
  ];

  return <div>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-bold">{pick("Problems", "المشاكل")}</h2><p className="mt-1 text-sm text-muted-foreground">{pick(\`Orders count as stuck after \${STUCK_MINUTES} minutes without an update. Refreshes every minute.\`, \`الأوردر يعتبر واقف بعد \${STUCK_MINUTES} دقيقة بدون تحديث. بتتحدث كل دقيقة.\`)}</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={\`me-1.5 size-4 \${loading ? "animate-spin" : ""}\`} />{pick("Refresh", "تحديث")}</Button></div>
    {error ? <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : null}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map((c) => <div key={c.kind} className="panel p-4"><div className={\`text-3xl font-bold \${c.color}\`}>{count(c.kind)}</div><div className="mt-1 text-sm text-muted-foreground">{c.label}</div></div>)}</div>
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setFilter(tab.id)} className={\`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold \${filter === tab.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}\`}>{tab.label}</button>)}</div>
    <div className="mt-4 space-y-3">
      {!loading && shown.length === 0 ? <div className="panel p-6 text-center text-sm text-muted-foreground">{pick("No problems right now.", "مفيش مشاكل دلوقتي.")}</div> : null}
      {shown.map((p) => <div key={p.key} className="panel p-4"><div className="flex items-start justify-between gap-3"><b>{p.title}</b>{p.urgent ? <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-500">{pick("Urgent", "عاجل")}</span> : null}</div><p className="mt-1 text-sm text-muted-foreground">{p.sub}</p><div className="mt-3"><Button asChild size="sm"><Link to={p.to as any}>{p.toLabel}</Link></Button></div></div>)}
    </div>
  </div>;
}
