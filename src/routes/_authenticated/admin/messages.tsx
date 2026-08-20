import { createFileRoute } from "@tanstack/react-router";
import { Mail, MailOpen, Phone, User, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppTopbar, AdminNav } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/messages")({ component: AdminMessages });

function AdminMessages() {
  const { pick, fmtDate } = useI18n();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("customer_messages").select("*").order("created_at", { ascending: false });
    if (!error) setMessages(data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); const channel = supabase.channel("admin-customer-messages").on("postgres_changes", { event: "*", schema: "public", table: "customer_messages" }, () => void load()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, []);
  const markRead = async (id: string) => { await supabase.from("customer_messages").update({ is_read: true }).eq("id", id); setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m)); };
  const unread = messages.filter(m => !m.is_read).length;

  return <div className="min-h-screen bg-background"><AppTopbar title={pick("Messages", "الرسائل")} /><main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6"><AdminNav items={[{ to: "/admin", label: pick("Dashboard", "الرئيسية"), icon: User }, { to: "/admin/booking-requests", label: pick("Booking requests", "طلبات الحجز"), icon: Mail }, { to: "/admin/messages", label: pick("Messages", "الرسائل"), icon: Mail }]} /><section className="panel mt-6 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold flex items-center gap-2"><Mail className="size-6 text-primary" />{pick("Customer messages", "رسائل العملاء")}{unread > 0 && <Badge variant="destructive">{unread} {pick("new", "جديد")}</Badge>}</h2><p className="mt-1 text-sm text-muted-foreground">{pick("Messages sent from the customer contact form appear here with customer details.", "كل رسائل العملاء من نموذج التواصل تظهر هنا مع بيانات العميل بالتفصيل.")}</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="me-1 size-4" />{pick("Refresh", "تحديث")}</Button></div><div className="mt-5 space-y-3">{messages.length === 0 ? <p className="text-sm text-muted-foreground">{pick("No messages yet.", "لا توجد رسائل حتى الآن.")}</p> : messages.map(m => <article key={m.id} className={`rounded-2xl border p-5 ${m.is_read ? "bg-card" : "bg-primary/5 border-primary/30"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{m.customer_name || pick("Customer", "عميل")}</h3>{!m.is_read && <Badge>{pick("New", "جديد")}</Badge>}</div><div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 sm:gap-x-6"><span><Phone className="me-1 inline size-4" />{m.customer_phone || "—"}</span><span><Mail className="me-1 inline size-4" />{m.customer_email || "—"}</span></div></div><span className="text-xs text-muted-foreground">{m.created_at ? fmtDate(m.created_at) : "—"}</span></div><div className="mt-4 rounded-xl border bg-background/70 p-4 whitespace-pre-wrap text-sm leading-7">{m.message}</div>{!m.is_read && <Button className="mt-3" size="sm" variant="outline" onClick={() => void markRead(m.id)}><MailOpen className="me-1 size-4" />{pick("Mark as read", "تحديد كمقروءة")}</Button>}</article>)}</div></section></main></div>;
}
