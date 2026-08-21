import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { CrudTable, type Row } from "@/components/admin/Crud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPayments,
});

function AdminPayments() {
  const { t, fmtMoney, fmtDate, pick } = useI18n();
  const queryClient = useQueryClient();
  const { data: customers } = useAdminTable("profiles", "id, full_name, phone", "created_at");
  const { data: subscriptions } = useAdminTable(
    "subscriptions",
    "id, customer_id, package_id, status, start_date, end_date, total_washes, used_washes, request_id",
    "created_at",
  );
  const { data: packages } = useAdminTable("packages", "id, title_en, title_ar", "sort_order");
  const { data: bookingRequests = [], refetch: refetchBookingRequests } = useAdminTable(
    "booking_requests",
    "id, customer_name, customer_phone, customer_email, amount, payment_method, payment_status, status, scheduled_at, created_at",
    "created_at",
  );

  const customerOptions = (customers ?? []).map((c) => ({
    value: String(c.id),
    label: String(c.full_name ?? c.phone ?? c.id),
  }));

  const subscriptionOptions = (subscriptions ?? []).map((s) => ({
    value: String(s.id),
    label: `${customerOptions.find((c) => c.value === String(s.customer_id))?.label ?? s.customer_id} — ${String(s.id).slice(0, 8)}`,
  }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    void refetchBookingRequests();
  };

  const manualPaymentMethod = (method: unknown) => {
    const value = String(method ?? "");
    if (value === "smart_wallet") return pick("Smart Wallet", "محفظة");
    if (value === "instapay") return "InstaPay";
    if (value === "bank_transfer") return pick("Bank transfer", "تحويل بنكي");
    return value || "—";
  };

  const confirmManualPayment = async (request: Row) => {
    const id = String(request["id"] ?? "");
    if (!id || String(request["payment_status"] ?? "") !== "awaiting_proof") return;
    if (!window.confirm(pick("Confirm this manual payment?", "تأكيد استلام الدفع اليدوي؟"))) return;

    const { error } = await (supabase as any)
      .from("booking_requests")
      .update({ payment_status: "paid" })
      .eq("id", id)
      .eq("payment_status", "awaiting_proof");

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(pick("Payment confirmed", "تم تأكيد الدفع"));
    refresh();
  };

  const rejectManualPayment = async (request: Row) => {
    const id = String(request["id"] ?? "");
    if (!id || String(request["payment_status"] ?? "") !== "awaiting_proof") return;
    if (!window.confirm(pick("Reject this manual payment?", "رفض الدفع اليدوي؟"))) return;

    const { error } = await (supabase as any)
      .from("booking_requests")
      .update({ payment_status: "rejected" })
      .eq("id", id)
      .eq("payment_status", "awaiting_proof");

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(pick("Payment rejected", "تم رفض الدفع"));
    refresh();
  };

  const confirmSubscriptionPayment = async (row: Row) => {
    const paymentId = String(row["id"] ?? "");
    const subscriptionId = String(row["subscription_id"] ?? "");
    const customerId = String(row["customer_id"] ?? "");
    if (!paymentId || !subscriptionId || !customerId) {
      toast.error("لا يمكن تأكيد الدفع: بيانات الدفعة غير مكتملة.");
      return;
    }
    if (String(row["status"] ?? "") !== "pending") return;
    if (!window.confirm("هل تريد تأكيد استلام الدفع؟ سيتم إبقاء الاشتراك معلقًا حتى تقوم بتفعيله من الاشتراكات.")) return;

    const subscription = (subscriptions ?? []).find((s) => String(s.id) === subscriptionId);
    if (!subscription || String(subscription.customer_id) !== customerId) {
      toast.error("بيانات العميل والاشتراك غير متطابقة.");
      return;
    }

    const { error: paymentError } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", paymentId)
      .eq("status", "pending");

    if (paymentError) {
      toast.error(paymentError.message);
      return;
    }

    if (subscription.request_id) {
      const { error: requestError } = await (supabase as any)
        .from("subscription_requests")
        .update({ payment_status: "paid", updated_at: new Date().toISOString() })
        .eq("id", subscription.request_id)
        .eq("status", "pending");

      if (requestError) {
        await supabase.from("payments").update({ status: "pending", paid_at: null }).eq("id", paymentId);
        toast.error(requestError.message);
        return;
      }
    }

    toast.success("تم تأكيد الدفع. الاشتراك ما زال معلقًا لحين التفعيل.");
    refresh();
  };

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="text-lg font-bold">طلبات الدفع اليدوي</h2>
            <p className="text-sm text-muted-foreground">المحفظة وInstaPay والتحويل البنكي — تظهر هنا فور إرسال العميل للدفع وتنتظر تأكيد المدير.</p>
          </div>
          <Badge variant="secondary">{bookingRequests.filter((r: any) => r.payment_status === "awaiting_proof").length} معلقة</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b bg-muted/40 text-right"><th className="p-3">العميل</th><th className="p-3">المبلغ</th><th className="p-3">طريقة الدفع</th><th className="p-3">موعد الطلب</th><th className="p-3">حالة الدفع</th><th className="p-3">حالة الطلب</th><th className="p-3">الإجراء</th></tr></thead>
            <tbody>
              {bookingRequests.filter((r: any) => ["awaiting_proof", "paid", "rejected"].includes(String(r.payment_status))).map((r: any) => (
                <tr key={`booking-payment-${r.id}`} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3"><div className="font-semibold">{r.customer_name || "—"}</div><div className="text-xs text-muted-foreground">{r.customer_phone || r.customer_email || "—"}</div></td>
                  <td className="p-3 font-semibold">{fmtMoney(Number(r.amount ?? 0))}</td><td className="p-3">{manualPaymentMethod(r.payment_method)}</td><td className="p-3">{r.scheduled_at ? fmtDate(String(r.scheduled_at)) : "—"}</td>
                  <td className="p-3"><Badge variant={r.payment_status === "paid" ? "default" : r.payment_status === "rejected" ? "destructive" : "secondary"}>{r.payment_status === "awaiting_proof" ? "في انتظار التأكيد" : r.payment_status === "paid" ? "مدفوع" : "مرفوض"}</Badge></td>
                  <td className="p-3"><Badge variant="outline">{r.status || "—"}</Badge></td>
                  <td className="p-3">{r.payment_status === "awaiting_proof" ? <div className="flex gap-2"><Button size="sm" onClick={() => confirmManualPayment(r)}><CheckCircle2 className="me-1 size-4" />تأكيد</Button><Button size="sm" variant="destructive" onClick={() => rejectManualPayment(r)}><XCircle className="me-1 size-4" />رفض</Button></div> : <span className="text-xs text-muted-foreground">—</span>}</td>
                </tr>
              ))}
              {bookingRequests.filter((r: any) => ["awaiting_proof", "paid", "rejected"].includes(String(r.payment_status))).length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد طلبات دفع يدوية.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <CrudTable
        table="payments"
        title={t("a_payments")}
        orderBy="created_at"
        columns={[
          { key: "customer_id", label: t("customer"), render: (r) => customerOptions.find((c) => c.value === String(r["customer_id"]))?.label ?? "—" },
          { key: "subscription_id", label: "الاشتراك", render: (r) => subscriptionOptions.find((s) => s.value === String(r["subscription_id"]))?.label ?? "غير مرتبط" },
          { key: "amount", label: t("amount"), render: (r) => fmtMoney(Number(r["amount"] ?? 0)) },
          { key: "method", label: t("method") },
          { key: "reference", label: t("reference") },
          { key: "created_at", label: "تاريخ ووقت الطلب", render: (r) => fmtDate(String(r["created_at"])) },
          { key: "paid_at", label: t("paid_at"), render: (r) => r["paid_at"] ? fmtDate(String(r["paid_at"])) : "—" },
          { key: "status", label: t("status"), render: (r) => <Badge variant={String(r["status"]) === "paid" ? "default" : "secondary"}>{String(r["status"]) === "paid" ? "مدفوع" : String(r["status"] ?? "pending")}</Badge> },
        ]}
        fields={[
          { name: "customer_id", label: t("customer"), type: "select", options: customerOptions },
          { name: "subscription_id", label: "الاشتراك", type: "select", options: subscriptionOptions },
          { name: "amount", label: t("amount"), type: "number", defaultValue: 0 },
          { name: "method", label: t("method"), type: "select", defaultValue: "cash", options: [{ value: "cash", label: "Cash" }, { value: "instapay", label: "InstaPay" }, { value: "vodafone_cash", label: "Vodafone Cash" }, { value: "card", label: t("card") }] },
          { name: "reference", label: t("reference") },
          { name: "paid_at", label: t("paid_at"), type: "date" },
          { name: "status", label: t("status"), type: "select", defaultValue: "pending", options: [{ value: "paid", label: "مدفوع" }, { value: "pending", label: t("pending") }, { value: "cancelled", label: t("cancelled") }] },
        ]}
        rowActions={(row) => String(row["status"] ?? "") === "pending" && row["subscription_id"] ? <Button variant="outline" size="sm" onClick={() => confirmSubscriptionPayment(row)}><CheckCircle2 className="me-1 size-4" />تأكيد الدفع</Button> : null}
      />
    </div>
  );
}
