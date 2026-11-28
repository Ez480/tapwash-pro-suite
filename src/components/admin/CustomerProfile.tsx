import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

type Row = any;
type Tab = "updates" | "cars" | "orders" | "subscription" | "archive";

const FIELD_AR: Record<string, string> = { full_name: "الاسم", phone: "الموبايل", email: "الإيميل", avatar_url: "الصورة", address_text: "العنوان", location_url: "لينك اللوكيشن", latitude: "خط العرض", longitude: "خط الطول", status: "الحالة", language: "اللغة", notes: "ملاحظات", brand: "الماركة", model: "الموديل", color: "اللون", plate_number: "رقم اللوحة" };
const FIELD_EN: Record<string, string> = { full_name: "Name", phone: "Phone", email: "Email", avatar_url: "Photo", address_text: "Address", location_url: "Location link", latitude: "Latitude", longitude: "Longitude", status: "Status", language: "Language", notes: "Notes", brand: "Brand", model: "Model", color: "Color", plate_number: "Plate" };

export function CustomerProfileDialog({ customer, onClose }: { customer: Row | null; onClose: () => void }) {
  const { pick, fmtDate } = useI18n();
  const db = supabase as any;
  const [tab, setTab] = useState<Tab>("updates");
  const [cars, setCars] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [subs, setSubs] = useState<Row[]>([]);
  const [log, setLog] = useState<Row[]>([]);
  const [logReady, setLogReady] = useState(true);
  const [loading, setLoading] = useState(false);
  const id = customer ? String(customer.id) : "";

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setTab("updates"); setLoading(true);
    void (async () => {
      const [c, t, s, l] = await Promise.all([
        db.from("cars").select("*").eq("customer_id", id),
        db.from("employee_tasks").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(50),
        db.from("subscriptions").select("*, packages(title_en,title_ar)").eq("customer_id", id).order("created_at", { ascending: false }),
        db.from("customer_change_log").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
      ]);
      if (!alive) return;
      setCars(c.data ?? []); setTasks(t.data ?? []); setSubs(s.data ?? []); setLog(l.data ?? []);
      setLogReady(!l.error);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, db]);

  const label = (k: string) => pick(FIELD_EN[k] ?? k, FIELD_AR[k] ?? k);
  const who = (role: string) => role === "admin" ? pick("Admin", "الإدارة") : role === "customer" ? pick("Customer", "العميل") : pick("System", "النظام");
  const val = (v: any) => v === null || v === undefined || v === "" ? "—" : String(v);
  const isImg = (k: string, v: any) => k === "avatar_url" && typeof v === "string" && v.length > 0;
  const describe = (e: Row) => {
    const ch = e.changes ?? {};
    if (e.entity === "car") {
      const c = e.action === "update" ? null : ch;
      if (e.action === "insert") return pick(`Car added: ${val(c?.brand)} ${val(c?.model)} · ${val(c?.plate_number)}`, `تمت إضافة سيارة: ${val(c?.brand)} ${val(c?.model)} · ${val(c?.plate_number)}`);
      if (e.action === "delete") return pick(`Car removed: ${val(c?.brand)} ${val(c?.model)} · ${val(c?.plate_number)}`, `تم حذف سيارة: ${val(c?.brand)} ${val(c?.model)} · ${val(c?.plate_number)}`);
      return pick("Car updated", "تعديل بيانات سيارة");
    }
    return pick("Profile updated", "تعديل بيانات الملف");
  };
  const details = (e: Row) => e.action === "update" ? Object.entries(e.changes ?? {}).map(([k, v]: [string, any]) => ({ k, from: v?.from, to: v?.to })) : [];
  const orders = tasks.filter((t) => !["completed", "cancelled"].includes(String(t.status ?? "").toLowerCase()));
  const archivedTasks = tasks.filter((t) => ["completed", "cancelled"].includes(String(t.status ?? "").toLowerCase()));
  const activeSubs = subs.filter((s) => String(s.status) === "active");
  const archivedSubs = subs.filter((s) => String(s.status) !== "active");
  const tabs: { id: Tab; label: string }[] = [
    { id: "updates", label: pick("Updates & edit log", "التحديثات وسجل التعديلات") },
    { id: "cars", label: `${pick("Cars", "السيارات")} (${cars.length})` },
    { id: "orders", label: pick("Orders", "الأوردرات") },
    { id: "subscription", label: pick("Subscription", "الاشتراك") },
    { id: "archive", label: pick("Archive", "الأرشيف") },
  ];
  const subRow = (s: Row) => { const pkg = s.packages as Row; return <div key={String(s.id)} className="rounded-xl border p-3 text-sm"><div className="flex items-center justify-between gap-2"><b>{pkg ? pick(pkg.title_en ?? "", pkg.title_ar ?? "") : "—"}</b><Badge variant={String(s.status) === "active" ? "default" : "outline"}>{String(s.status)}</Badge></div><div className="mt-1 text-muted-foreground">{pick("Washes", "الغسلات")}: {String(s.used_washes ?? 0)} / {String(s.total_washes ?? 0)} · {pick("Ends", "ينتهي")}: {s.end_date ? fmtDate(String(s.end_date)) : "—"}</div></div>; };
  const taskRow = (t: Row) => <div key={String(t.id)} className="rounded-xl border p-3 text-sm"><div className="flex items-center justify-between gap-2"><b>#{t.serial_number ?? String(t.id).slice(0, 8)} {t.title ?? ""}</b><Badge variant="outline">{String(t.status ?? "pending")}</Badge></div><div className="mt-1 text-muted-foreground">{t.created_at ? fmtDate(String(t.created_at)) : "—"} · {Number(t.collection_amount ?? t.amount ?? 0).toFixed(2)} EGP · {t.payment_status ?? "—"}</div></div>;
  const empty = (txt: string) => <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">{txt}</p>;

  return <Dialog open={Boolean(customer)} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      {customer ? <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {customer.avatar_url ? <img src={String(customer.avatar_url)} alt="" className="size-12 rounded-full object-cover" /> : <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">{String(customer.full_name ?? "—").trim().charAt(0) || "—"}</span>}
            <span className="min-w-0"><span className="block truncate">{customer.full_name || "—"}</span><span className="block truncate text-xs font-normal text-muted-foreground">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "—"}</span></span>
            <Badge variant={customer.status === "active" ? "default" : "destructive"}>{customer.status === "active" ? pick("Active", "نشط") : pick("Suspended", "موقوف")}</Badge>
          </DialogTitle>
          <DialogDescription>{[customer.address_text, pick("Joined", "انضم") + " " + (customer.created_at ? fmtDate(String(customer.created_at)) : "—")].filter(Boolean).join(" · ")}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 overflow-x-auto pb-1">{tabs.map((x) => <button key={x.id} type="button" onClick={() => setTab(x.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === x.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{x.label}</button>)}</div>
        {loading ? <p className="text-sm text-muted-foreground">{pick("Loading…", "جاري التحميل…")}</p> : null}
        {tab === "updates" ? <div className="space-y-3">
          {!logReady ? empty(pick("The edit log is not switched on yet. Edits will appear here once it is.", "سجل التعديلات لسه متفعلش. التعديلات هتظهر هنا أول ما يتفعل.")) : null}
          {logReady && log.length === 0 && !loading ? empty(pick("No edits recorded yet.", "مفيش تعديلات متسجلة لسه.")) : null}
          {log.map((e) => <div key={String(e.id)} className="rounded-xl border border-s-4 border-s-primary p-3 text-sm"><div className="flex items-center justify-between gap-2"><b>{describe(e)}</b><span className="text-xs text-muted-foreground">{who(String(e.actor_role))}</span></div><div className="mt-1 text-xs text-muted-foreground">{e.created_at ? new Date(e.created_at).toLocaleString() : "—"}</div>
            {details(e).map((d) => <div key={d.k} className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold">{label(d.k)}:</span>{isImg(d.k, d.to) ? <img src={String(d.to)} alt="" className="size-14 rounded-lg border object-cover" /> : <><span className="text-muted-foreground line-through">{val(d.from)}</span><span>→</span><span>{val(d.to)}</span></>}</div>)}
          </div>)}
        </div> : null}
        {tab === "cars" ? <div className="space-y-2">{cars.length === 0 && !loading ? empty(pick("No cars.", "مفيش سيارات.")) : null}{cars.map((c) => <div key={String(c.id)} className="rounded-xl border p-3 text-sm"><b>{[c.brand, c.model].filter(Boolean).join(" ") || "—"}</b><div className="mt-1 text-muted-foreground">{pick("Color", "اللون")}: {val(c.color)} · {pick("Plate", "اللوحة")}: {val(c.plate_number)}{c.notes ? ` · ${c.notes}` : ""}</div></div>)}</div> : null}
        {tab === "orders" ? <div className="space-y-2">{orders.length === 0 && !loading ? empty(pick("No open orders.", "مفيش أوردرات مفتوحة.")) : null}{orders.map(taskRow)}</div> : null}
        {tab === "subscription" ? <div className="space-y-2">{activeSubs.length === 0 && !loading ? empty(pick("No active subscription.", "مفيش اشتراك نشط.")) : null}{activeSubs.map(subRow)}</div> : null}
        {tab === "archive" ? <div className="space-y-2">{archivedSubs.length === 0 && archivedTasks.length === 0 && !loading ? empty(pick("Nothing archived for this customer.", "مفيش أرشيف للعميل ده.")) : null}{archivedSubs.map(subRow)}{archivedTasks.map(taskRow)}<Button asChild variant="outline" className="w-full"><Link to="/admin/archive">{pick("Open the full archive", "فتح الأرشيف الكامل")}</Link></Button></div> : null}
      </> : null}
    </DialogContent>
  </Dialog>;
}
