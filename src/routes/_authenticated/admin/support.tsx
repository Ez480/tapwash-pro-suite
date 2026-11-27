import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupportChatThread } from "@/components/app/SupportChat";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/support")({ component: AdminSupportPage });
type Employee = { id: string; full_name: string; phone?: string | null };
type Message = { id: string; employee_id: string; sender_role: string; body: string; created_at: string; read_at: string | null; attachment_path?: string | null };
function AdminSupportPage() {
  const { pick, fmtDate } = useI18n();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focusDate, setFocusDate] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    const [{ data: roleRows, error: roleError }, { data: messageRows, error: messageError }] = await Promise.all([
      (supabase as any).from("user_roles").select("user_id").eq("role", "employee"),
      (supabase as any).from("support_messages").select("*").order("created_at", { ascending: false }).limit(2000),
    ]);
    if (roleError) console.warn(roleError);
    if (messageError) console.warn(messageError);
    const ids = (roleRows ?? []).map((row: any) => row.user_id);
    const { data: profiles, error: profileError } = ids.length ? await (supabase as any).from("profiles").select("id,full_name,phone").in("id", ids) : { data: [], error: null };
    if (profileError) console.warn(profileError);
    setEmployees(profiles ?? []);
    setMessages(messageRows ?? []);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    const channel = supabase.channel("admin-support-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);
  const summaries = useMemo(() => employees.map(employee => {
    const thread = messages.filter(message => message.employee_id === employee.id);
    return { ...employee, last: thread[0] ?? null, unread: thread.filter(message => message.sender_role === "employee" && !message.read_at).length };
  }).sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? "")), [employees, messages]);
  const visible = summaries.filter(employee => !query.trim() || [employee.full_name, employee.phone, employee.last?.body].some(value => String(value ?? "").toLowerCase().includes(query.trim().toLowerCase())));
  const activeEmployee = employees.find(employee => employee.id === selected) ?? null;
  return <div className="space-y-5">
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
      <div><h2 className="flex items-center gap-2 text-2xl font-bold"><MessageCircle className="size-6 text-primary" />{pick("Employee support", "دعم الموظفين")}</h2><p className="mt-1 text-sm text-muted-foreground">{pick("Private conversations with each employee.", "محادثات خاصة منفصلة مع كل موظف.")}</p></div>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`me-1 size-4 ${loading ? "animate-spin" : ""}`} />{pick("Refresh", "تحديث")}</Button>
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
      <aside className="panel min-w-0 p-3">
        <div className="relative mb-3"><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={pick("Search employees or messages", "ابحث عن موظف أو رسالة")} className="ps-9" /></div>
        <div className="max-h-[650px] space-y-2 overflow-y-auto">{visible.map(employee => <button key={employee.id} type="button" onClick={() => { setSelected(employee.id); setFocusDate(""); }} className={`w-full rounded-xl border p-3 text-start transition ${selected === employee.id ? "border-primary bg-primary/5" : "hover:bg-muted/60"}`}>
          <div className="flex items-center justify-between gap-2"><b className="truncate">{employee.full_name || pick("Employee", "موظف")}</b>{employee.unread > 0 && <Badge variant="destructive">{employee.unread}</Badge>}</div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{employee.last?.body || (employee.last?.attachment_path ? pick("Image attachment", "صورة مرفقة") : pick("No messages yet", "لا توجد رسائل"))}</p>
          {employee.last && <p className="mt-1 text-[10px] text-muted-foreground">{fmtDate(employee.last.created_at)}</p>}
        </button>)}{visible.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{pick("No employees found.", "لا يوجد موظفون مطابقون.")}</p>}</div>
      </aside>
      <div className="min-w-0 space-y-3">
        {activeEmployee ? <><div className="panel flex flex-wrap items-end justify-between gap-3 p-3"><div><label className="mb-1 block text-xs font-semibold text-muted-foreground">{pick("Open conversation by date", "فتح المحادثة بتاريخ")}</label><Input type="date" value={focusDate} onChange={event => setFocusDate(event.target.value)} /></div>{focusDate && <Button size="sm" variant="ghost" onClick={() => setFocusDate("")}>{pick("Show all messages", "عرض كل الرسائل")}</Button>}</div><SupportChatThread key={activeEmployee.id + focusDate} employeeId={activeEmployee.id} employeeName={activeEmployee.full_name} isAdmin focusDate={focusDate || null} /></> : <div className="panel flex min-h-[420px] flex-col items-center justify-center p-8 text-center text-muted-foreground"><MessageCircle className="mb-3 size-10 opacity-40" /><p>{pick("Choose an employee to open the conversation.", "اختر موظفًا لفتح المحادثة.")}</p></div>}
      </div>
    </div>
  </div>;
}
