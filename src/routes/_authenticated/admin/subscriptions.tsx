import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrudTable, type Row } from "@/components/admin/Crud";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({ component: AdminSubscriptions });

function AdminSubscriptions() {
  const { t, pick, fmtDate } = useI18n();
  const queryClient = useQueryClient();
  const { data: customers } = useAdminTable("profiles", "id, full_name, phone", "created_at");
  const { data: packages } = useAdminTable("packages", "id, title_en, title_ar", "sort_order");
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["admin", "subscription-requests"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("subscription_requests").select("*, packages(title_en,title_ar,washes_count,duration_days)").eq("status", "pending").order("requested_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  const customerOptions = (customers ?? []).map((c) => ({ value: String(c.id), label: String(c.full_name ?? c.phone ?? c.id) }));
  const packageOptions = (packages ?? []).map((p) => ({ value: String(p.id), label: pick(String(p.title_en), String(p.title_ar)) }));
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] }); queryClient.invalidateQueries({ queryKey: ["admin", "subscription-requests"] }); queryClient.invalidateQueries({ queryKey: ["admin", "washes"] }); };

  const cancelRequest = async (r: any) => { const { error } = await (supabase as any).from("subscription_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", r.id).eq("status", "pending"); if (error) return toast.error(error.message); await (supabase as any).from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("request_id", r.id); toast.success("تم إلغاء الاشتراك ونقله للأرشيف"); refresh(); };
  const addWash = async (row: Row) => { const used = Number(row["used_washes"] ?? 0); const { error } = await supabase.from("washes").insert({ customer_id: String(row["customer_id"]), subscription_id: String(row["id"]) }); if (error) return void toast.error(error.message); const { error: updateError } = await supabase.from("subscriptions").update({ used_washes: used + 1 }).eq("id", String(row["id"])); if (updateError) return void toast.error(updateError.message); toast.success(t("saved")); refresh(); };
  const removeWash = async (row: Row) => { const used = Number(row["used_washes"] ?? 0); if (used <= 0) return; const { error } = await supabase.from("subscriptions").update({ used_washes: used - 1 }).eq("id", String(row["id"])); if (error) return void toast.error(error.message); toast.success(t("saved")); refresh(); };

  return <div className="space-y-6">
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold"><span className="size-2.5 animate-pulse rounded-full bg-amber-500" />طلبات الاشتراكات المعلقة</h2><p className="mt-1 text-sm text-muted-foreground">أي عميل يطلب اشتراكًا يظهر هنا فورًا. تأكيد الدفع والتفعيل يتم يدويًا من صفحة المدفوعات فقط.</p></div><Badge variant="secondary">{requests.length} معلق</Badge></div>
      <div className="mt-4 space-y-3">
        {requestsLoading && <p className="text-sm text-muted-foreground">جاري تحميل طلبات الاشتراك...</p>}
        {!requestsLoading && requests.length === 0 && <p className="text-sm text-muted-foreground">لا توجد طلبات اشتراك معلقة.</p>}
        {requests.map((r: any) => { const pkg = r.packages as any; const customer = customerOptions.find(c => c.value === String(r.customer_id)); const payment = r.payment_method === "cash" ? "كاش" : r.payment_method === "smart_wallet" ? "محفظة" : r.payment_method === "instapay" ? "InstaPay" : r.payment_method === "bank_transfer" ? "تحويل بنكي" : r.payment_method; return <article key={r.id} className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-bold">{customer?.label ?? r.customer_id}</div><div className="mt-1 text-sm">{pkg ? pick(pkg.title_en, pkg.title_ar) : "باقة"} · {pkg?.washes_count ?? "—"} غسلات · {pkg?.duration_days ?? "—"} يوم</div><div className="mt-1 text-xs text-muted-foreground">طلب: {r.requested_at ? `${fmtDate(r.requested_at)} · ${new Date(r.requested_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "—"}</div></div><div className="flex flex-wrap gap-2"><Badge>{payment}</Badge><Badge variant="secondary">الدفع: {r.payment_status === "paid" ? "مدفوع" : "معلق"}</Badge></div></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><div>المبلغ: <b>{Number(r.amount ?? 0).toFixed(2)} جنيه</b></div><div>أول غسلة: <b>{r.first_wash_date ? `${r.first_wash_date} ${r.first_wash_time ?? ""}` : Array.isArray(r.requested_washes) && r.requested_washes[0] ? `${r.requested_washes[0].date ?? "—"} ${r.requested_washes[0].time ?? ""}` : "—"}</b></div><div>الحالة: <b>معلق</b></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">تأكيد الدفع والتفعيل يتم من صفحة المدفوعات</span><Button variant="outline" onClick={() => void cancelRequest(r)}><XCircle className="me-2 size-4"/>إلغاء</Button></div></article>; })}
      </div>
    </section>

    <CrudTable table="subscriptions" title={t("a_subscriptions")} description="الاشتراكات المعلقة والمفعلة فقط. الاشتراك الملغى ينتقل إلى الأرشيف." select="*, packages(title_en,title_ar)" columns={[{key:"customer_id",label:t("customer"),render:(r)=>customerOptions.find((c)=>c.value===String(r["customer_id"]))?.label??"—"},{key:"package_id",label:t("package"),render:(r)=>packageOptions.find((p)=>p.value===String(r["package_id"]))?.label??"—"},{key:"used_washes",label:t("used_washes"),render:(r)=>`${String(r["used_washes"]??0)} / ${String(r["total_washes"]??0)}`},{key:"start_date",label:t("start_date"),render:(r)=>fmtDate(String(r["start_date"]))},{key:"end_date",label:t("end_date"),render:(r)=>fmtDate(String(r["end_date"]))},{key:"created_at",label:"تاريخ ووقت المعاملة",render:(r)=>r["created_at"]?`${fmtDate(String(r["created_at"]))} · ${new Date(String(r["created_at"])).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:"—"},{key:"status",label:t("status"),render:(r)=><Badge variant={r["status"]==="active"?"default":"secondary"}>{r["status"]==="active"?t("active"):t("pending")}</Badge>}]} fields={[{name:"customer_id",label:t("customer"),type:"select",options:customerOptions},{name:"package_id",label:t("package"),type:"select",options:packageOptions},{name:"total_washes",label:t("total_washes"),type:"number",defaultValue:4},{name:"used_washes",label:t("used_washes"),type:"number",defaultValue:0},{name:"start_date",label:t("start_date"),type:"date"},{name:"end_date",label:t("end_date"),type:"date"},{name:"status",label:t("status"),type:"select",defaultValue:"active",options:[{value:"active",label:t("active")},{value:"pending",label:t("pending")},{value:"expired",label:t("expired")},{value:"cancelled",label:t("cancelled")}] }]} rowFilter={(row)=>String(row["status"]??"")!=="cancelled"} rowActions={(row)=><><Button variant="outline" size="sm" onClick={()=>void addWash(row)}><Plus className="me-1 size-3.5"/>{t("add_wash")}</Button><Button variant="ghost" size="icon" onClick={()=>void removeWash(row)} aria-label={t("remove_wash")}><Minus className="size-4"/></Button></>}/>
  </div>;
}