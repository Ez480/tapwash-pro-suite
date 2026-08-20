import { createFileRoute } from "@tanstack/react-router";
import { Archive, Search, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/archive")({ component: AdminArchive });

function AdminArchive() {
  const { pick } = useI18n();
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (requestedDate = date) => {
    setLoading(true);
    try {
      const q = search.trim();
      const requests = [
        supabase.from("employee_tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("booking_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("payments").select("*").order("created_at", { ascending: false }),
      ];

      const [{ data: t }, { data: b }, { data: p }] = await Promise.all(requests);
      let all = [
        ...(t ?? []).map(x => ({ ...x, _type: "order", _ref: x.serial_number || x.id })),
        ...(b ?? []).map(x => ({ ...x, _type: "booking", _ref: x.id })),
        ...(p ?? []).map(x => ({ ...x, _type: "payment", _ref: x.order_id || x.id })),
      ];

      // Date is an optional filter now. Search works independently of the date.
      if (requestedDate) {
        const start = new Date(`${requestedDate}T00:00:00.000Z`).getTime();
        const end = new Date(`${requestedDate}T23:59:59.999Z`).getTime();
        all = all.filter(x => {
          const created = x.created_at ? new Date(x.created_at).getTime() : NaN;
          return Number.isFinite(created) && created >= start && created <= end;
        });
      }

      if (q) {
        const normalized = q.toLowerCase();
        all = all.filter(x => {
          const searchable = [
            x._ref, x.serial_number, x.id, x.order_id,
            x.customer_name, x.name, x.customer_phone, x.phone,
            x.customer_email, x.email, x.employee_id,
            x.employee_name, x.assigned_employee_id, x.assigned_employee_name,
            x.status, x.payment_status, x.title,
          ].filter(v => v !== null && v !== undefined).join(" ").toLowerCase();
          return searchable.includes(normalized);
        });
      }

      all.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setRows(all);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => rows, [rows]);
  const orders = filtered.filter(x => x._type === "order");
  const others = filtered.filter(x => x._type !== "order");

  return <div className="space-y-6">
    <div className="flex items-center gap-2">
      <Archive className="size-6 text-primary" />
      <div>
        <h1 className="text-2xl font-bold">{pick("Archive & search", "الأرشيف والبحث")}</h1>
        <p className="text-sm text-muted-foreground">{pick("Search by order number, customer name, phone or employee without selecting a date.", "ابحث برقم الأوردر أو اسم العميل أو رقمه أو الموظف بدون الحاجة لاختيار تاريخ.")}</p>
      </div>
    </div>

    <div className="panel p-5">
      <div className="grid gap-3 md:grid-cols-[auto_1fr_auto]">
        <div className="relative">
          <CalendarDays className="absolute start-3 top-3 size-4 text-muted-foreground" />
          <Input type="date" className="ps-9" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="relative">
          <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void load(); }} placeholder={pick("Search by order number, customer, phone or employee", "ابحث برقم الأوردر أو اسم العميل أو رقم العميل أو الموظف")} />
        </div>
        <Button onClick={() => void load()} disabled={loading}>{loading ? pick("Loading...", "جاري البحث...") : pick("Search", "بحث")}</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{pick("Date is optional. Leave it empty to search the entire archive.", "التاريخ اختياري. اتركه فارغًا للبحث في الأرشيف بالكامل.")}</p>
    </div>

    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{date || pick("All archive", "كل الأرشيف")}</h2>
        <span className="text-sm text-muted-foreground">{filtered.length} {pick("records", "سجل")}</span>
      </div>

      {orders.map(x => <article key={`order-${x.id}`} className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-bold">🚗 #{x.serial_number || x.id}</h3><p className="text-sm text-muted-foreground">{x.title || pick("Order", "أوردر")}</p></div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs">{x.status || "—"}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border p-3"><small className="text-muted-foreground">اسم العميل</small><p className="font-semibold">{x.customer_name || "—"}</p></div>
          <div className="rounded-xl border p-3"><small className="text-muted-foreground">رقم التليفون</small><p className="font-semibold">{x.customer_phone || "—"}</p></div>
          <div className="rounded-xl border p-3"><small className="text-muted-foreground">نوع الباقة</small><p className="font-semibold">{x.package_name || x.offer_name || x.wash_type || "—"}</p></div>
          <div className="rounded-xl border p-3"><small className="text-muted-foreground">المتبقي من الباقة</small><p className="font-semibold">{x.remaining_washes != null ? `${x.remaining_washes} غسلة` : "—"}</p></div>
          <div className="rounded-xl border p-3 sm:col-span-2"><small className="text-muted-foreground">الموظف المكلف</small><p className="font-semibold">{x.employee_name || x.assigned_employee_name || x.employee_full_name || "—"}</p><p className="text-xs text-muted-foreground mt-1">Employee ID: {x.employee_id || x.assigned_employee_id || "—"}</p></div>
          <div className="rounded-xl border p-3 sm:col-span-2"><small className="text-muted-foreground">ملاحظات</small><p>{x.notes || "—"}</p></div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{x.created_at ? new Date(x.created_at).toLocaleString() : ""}</div>
      </article>)}

      {others.map(x => <div key={`${x._type}-${x.id}`} className="rounded-xl border border-border p-3"><b>{x._type === "booking" ? "📋" : "💳"} #{x._ref}</b><span className="ms-2 text-sm text-muted-foreground">{x.customer_name || x.name || x.customer_phone || x.phone || x.email || x.amount || "—"}</span><span className="float-end text-sm text-muted-foreground">{x.status || "—"}</span></div>)}
      {!filtered.length && <p className="text-sm text-muted-foreground">{pick("No records found.", "لا توجد نتائج مطابقة للبحث.")}</p>}
    </section>
  </div>;
}
