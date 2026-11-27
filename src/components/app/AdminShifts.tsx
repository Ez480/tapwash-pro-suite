import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatNumber, formatTime } from "@/lib/format";

function cairoDay() { return new Intl.DateTimeFormat("en-CA", { numberingSystem: "latn", timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function dayBounds(date: string) { return { start: new Date(`${date}T00:00:00+03:00`).toISOString(), end: new Date(`${date}T23:59:59.999+03:00`).toISOString() }; }

type Row = { userId: string; name: string; shift: any | null; orders: number; collection: number; cash: number; electronic: number };

export function AdminShifts() {
  const { pick } = useI18n();
  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [shiftError, setShiftError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    const { start, end } = dayBounds(cairoDay());
    const [emp, sh, tk] = await Promise.all([
      (supabase as any).rpc("admin_list_employees"),
      (supabase as any).from("employee_shifts").select("*").gte("started_at", start).lte("started_at", end).order("started_at", { ascending: false }),
      (supabase as any).from("employee_tasks").select("id,employee_id,status,payment_method,collection_amount,amount,created_at,scheduled_at").or(`and(scheduled_at.gte.${start},scheduled_at.lte.${end}),and(scheduled_at.is.null,created_at.gte.${start},created_at.lte.${end})`),
    ]);
    setEmployees((emp.data ?? []).filter((e: any) => e.user_id && e.status !== "inactive"));
    setShiftError(!!sh.error);
    setShifts(sh.data ?? []);
    setTasks(tk.data ?? []);
  };
  const scheduleReload = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { timer.current = null; void load(); }, 250); };
  useEffect(() => {
    void load();
    const channel = supabase.channel(`admin-shifts-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_shifts" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks" }, scheduleReload)
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(tick); if (timer.current) clearTimeout(timer.current); void supabase.removeChannel(channel); };
  }, []);

  const rows: Row[] = useMemo(() => employees.map((e: any) => {
    const mine = tasks.filter((t: any) => t.employee_id === e.user_id);
    const done = mine.filter((t: any) => t.status === "completed");
    return {
      userId: e.user_id, name: e.full_name || e.email || "—",
      shift: shifts.find((s: any) => s.employee_id === e.user_id && !s.ended_at) ?? null,
      orders: mine.length,
      collection: done.reduce((sum: number, t: any) => sum + Number(t.collection_amount ?? t.amount ?? 0), 0),
      cash: mine.filter((t: any) => t.payment_method === "cash").length,
      electronic: mine.filter((t: any) => t.payment_method && t.payment_method !== "cash").length,
    };
  }), [employees, shifts, tasks]);

  const startFor = async (userId: string) => {
    setBusy(userId);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("employee_shifts").insert({ employee_id: userId, started_by: auth.user?.id ?? null });
    setBusy(null);
    if (error) return void toast.error(error.message);
    void load();
  };
  const endFor = async (shift: any) => {
    setBusy(shift.employee_id);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("employee_shifts").update({ ended_at: new Date().toISOString(), ended_by: auth.user?.id ?? null }).eq("id", shift.id);
    setBusy(null);
    if (error) return void toast.error(error.message);
    void load();
  };
  const duration = (iso: string) => { const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)); return `${Math.floor(m / 60)}${pick("h", "س")} ${m % 60}${pick("m", "د")}`; };
  const running = rows.filter(r => r.shift).length;

  return <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-lg font-bold">{pick("Employee shifts today", "شفتات الموظفين اليوم")}</h3>
      {!shiftError && <span className="text-xs text-muted-foreground">{pick(`${running} running of ${rows.length}`, `${running} شغال من ${rows.length}`)}</span>}
    </div>
    {shiftError ? <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{pick("Shifts are not enabled yet (the shifts table has not been created).", "الشفتات لسه متفعلتش (جدول الشفتات لسه متعملش).")}</p>
      : rows.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">{pick("No employees", "لا يوجد موظفين")}</p>
      : <div className="grid gap-3 md:grid-cols-2">{rows.map(r => <div key={r.userId} className="rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0"><p className="flex items-center gap-2 font-bold"><span className={`inline-block size-2 rounded-full ${r.shift ? "bg-green-500" : "bg-slate-400"}`} /><span className="truncate">{r.name}</span></p><p className="text-xs text-muted-foreground">{r.shift ? `${pick("Running since", "شغال منذ")} ${formatTime(r.shift.started_at)} · ${duration(r.shift.started_at)}` : pick("No running shift", "مفيش شفت شغال")}</p></div>
          {r.shift ? <Button size="sm" variant="outline" disabled={busy === r.userId} onClick={() => void endFor(r.shift)}>{pick("End shift", "إنهاء الشفت")}</Button> : <Button size="sm" disabled={busy === r.userId} onClick={() => void startFor(r.userId)}>{pick("Start shift", "بدء الشفت")}</Button>}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[[pick("Collection", "التحصيل"), formatNumber(r.collection)], [pick("Orders", "الأوردرات"), formatNumber(r.orders)], [pick("Cash", "كاش"), formatNumber(r.cash)], [pick("Card / online", "فيزا/إلكتروني"), formatNumber(r.electronic)]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-muted/50 px-1 py-2"><p className="text-base font-bold tabular-nums">{value}</p><p className="text-[10px] text-muted-foreground">{label}</p></div>)}
        </div>
      </div>)}</div>}
  </section>;
}
