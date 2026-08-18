import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Search, Archive } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/daily")({ component: AdminDaily });

function AdminDaily() {
  const { pick, fmtDate } = useI18n();
  const [tasks, setTasks] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    const start = `${today}T00:00:00.000Z`, end = `${today}T23:59:59.999Z`;
    const [{ data: t }, { data: b }, { data: p }] = await Promise.all([
      supabase.from("employee_tasks").select("*").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
      supabase.from("booking_requests").select("*").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
      supabase.from("payments").select("*").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
    ]);
    setTasks(t ?? []); setBookings(b ?? []); setPayments(p ?? []);
  };

  useEffect(() => { void load(); const c = supabase.channel("admin-daily-live").on("postgres_changes", {event:"*",schema:"public",table:"employee_tasks"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"booking_requests"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"payments"},()=>void load()).subscribe(); return()=>{void supabase.removeChannel(c)}; }, []);

  const q = search.trim().toLowerCase();
  const match = (x: any) => !q || JSON.stringify(x).toLowerCase().includes(q);
  const filteredTasks = useMemo(() => tasks.filter(match), [tasks, q]);
  const filteredBookings = useMemo(() => bookings.filter(match), [bookings, q]);
  const filteredPayments = useMemo(() => payments.filter(match), [payments, q]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><CalendarDays className="size-6 text-primary"/><h1 className="text-2xl font-bold">{pick("Today", "طلبات اليوم")}</h1></div><p className="text-sm text-muted-foreground">{today}</p></div><Button asChild variant="outline"><a href="/admin/archive"><Archive className="me-2 size-4"/>{pick("Archive & search", "الأرشيف والبحث")}</a></Button></div>
    <div className="relative"><Search className="absolute start-3 top-3 size-4 text-muted-foreground"/><Input className="ps-9" value={search} onChange={e=>setSearch(e.target.value)} placeholder={pick("Search today's orders, bookings or payments", "ابحث في أوردرات وطلبات ومدفوعات اليوم")}/></div>
    <div className="grid gap-4 sm:grid-cols-3"><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Orders", "الأوردرات")}</p><p className="mt-2 text-3xl font-bold">{filteredTasks.length}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Booking requests", "طلبات الحجز")}</p><p className="mt-2 text-3xl font-bold">{filteredBookings.length}</p></div><div className="panel p-5"><p className="text-sm text-muted-foreground">{pick("Payments", "المدفوعات")}</p><p className="mt-2 text-3xl font-bold">{filteredPayments.length}</p></div></div>
    <section className="panel p-5"><h2 className="font-bold">{pick("Today's orders", "أوردرات اليوم")}</h2><div className="mt-4 space-y-2">{filteredTasks.map(x=><div key={x.id} className="rounded-xl border border-border p-3"><b>#{x.serial_number || x.id.slice(0,8)}</b> · {x.customer_name || "—"} · {x.title || "—"}<span className="float-end text-sm text-muted-foreground">{x.status || "pending"}</span></div>)}{!filteredTasks.length&&<p className="text-sm text-muted-foreground">{pick("No orders today", "لا توجد أوردرات اليوم")}</p>}</div></section>
    <section className="panel p-5"><h2 className="font-bold">{pick("Today's booking requests", "طلبات حجز اليوم")}</h2><div className="mt-4 space-y-2">{filteredBookings.map(x=><div key={x.id} className="rounded-xl border border-border p-3"><b>#{x.id.slice(0,8)}</b> · {x.name || x.customer_name || x.email || "—"}<span className="float-end text-sm text-muted-foreground">{x.status || "pending"}</span></div>)}{!filteredBookings.length&&<p className="text-sm text-muted-foreground">{pick("No booking requests today", "لا توجد طلبات حجز اليوم")}</p>}</div></section>
    <section className="panel p-5"><h2 className="font-bold">{pick("Today's payments", "مدفوعات اليوم")}</h2><div className="mt-4 space-y-2">{filteredPayments.map(x=><div key={x.id} className="rounded-xl border border-border p-3"><b>#{x.order_id || x.id.slice(0,8)}</b> · {x.amount ?? "—"} · {x.status || "pending"}</div>)}{!filteredPayments.length&&<p className="text-sm text-muted-foreground">{pick("No payments today", "لا توجد مدفوعات اليوم")}</p>}</div></section>
  </div>;
}
