import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
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
  const { t, fmtMoney, fmtDate } = useI18n();
  const queryClient = useQueryClient();
  const { data: customers } = useAdminTable("profiles", "id, full_name, phone", "created_at");
  const { data: subscriptions } = useAdminTable(
    "subscriptions",
    "id, customer_id, package_id, status, start_date, end_date, total_washes, used_washes",
    "created_at",
  );
  const { data: packages } = useAdminTable("packages", "id, title_en, title_ar", "sort_order");

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
  };

  const activateSubscription = async (row: Row) => {
    const paymentId = String(row["id"] ?? "");
    const subscriptionId = String(row["subscription_id"] ?? "");
    const customerId = String(row["customer_id"] ?? "");

    if (!paymentId || !subscriptionId) {
      toast.error("لا يمكن تفعيل الاشتراك: الدفعة غير مرتبطة باشتراك.");
      return;
    }

    if (String(row["status"] ?? "") === "paid") {
      toast.success("الدفعة مؤكدة بالفعل.");
      return;
    }

    if (!window.confirm("هل أكدت استلام الدفع وتريد تفعيل اشتراك العميل الآن؟")) return;

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

    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        start_date: String(subscription.start_date || new Date().toISOString().slice(0, 10)),
        end_date: String(subscription.end_date || new Date().toISOString().slice(0, 10)),
      })
      .eq("id", subscriptionId)
      .eq("customer_id", customerId);

    if (subscriptionError) {
      await supabase
        .from("payments")
        .update({ status: "pending" })
        .eq("id", paymentId);
      toast.error(subscriptionError.message);
      return;
    }

    toast.success("تم تأكيد الدفع وتفعيل الاشتراك بنجاح.");
    refresh();
  };

  return (
    <CrudTable
      table="payments"
      title={t("a_payments")}
      orderBy="paid_at"
      columns={[
        {
          key: "customer_id",
          label: t("customer"),
          render: (r) =>
            customerOptions.find((c) => c.value === String(r["customer_id"]))?.label ?? "—",
        },
        {
          key: "subscription_id",
          label: "الاشتراك",
          render: (r) =>
            subscriptionOptions.find((s) => s.value === String(r["subscription_id"]))?.label ?? "غير مرتبط",
        },
        { key: "amount", label: t("amount"), render: (r) => fmtMoney(Number(r["amount"] ?? 0)) },
        { key: "method", label: t("method") },
        { key: "reference", label: t("reference") },
        { key: "paid_at", label: t("paid_at"), render: (r) => fmtDate(String(r["paid_at"])) },
        {
          key: "status",
          label: t("status"),
          render: (r) => (
            <Badge variant={String(r["status"]) === "paid" ? "default" : "secondary"}>
              {String(r["status"]) === "paid" ? "مدفوع" : String(r["status"] ?? "pending")}
            </Badge>
          ),
        },
      ]}
      fields={[
        { name: "customer_id", label: t("customer"), type: "select", options: customerOptions },
        { name: "subscription_id", label: "الاشتراك", type: "select", options: subscriptionOptions },
        { name: "amount", label: t("amount"), type: "number", defaultValue: 0 },
        {
          name: "method",
          label: t("method"),
          type: "select",
          defaultValue: "cash",
          options: [
            { value: "cash", label: "Cash" },
            { value: "instapay", label: "InstaPay" },
            { value: "vodafone_cash", label: "Vodafone Cash" },
            { value: "card", label: t("card") },
          ],
        },
        { name: "reference", label: t("reference") },
        { name: "paid_at", label: t("paid_at"), type: "date" },
        {
          name: "status",
          label: t("status"),
          type: "select",
          defaultValue: "pending",
          options: [
            { value: "paid", label: "مدفوع" },
            { value: "pending", label: t("pending") },
            { value: "cancelled", label: t("cancelled") },
          ],
        },
      ]}
      rowActions={(row) =>
        String(row["status"] ?? "") === "pending" ? (
          <Button variant="outline" size="sm" onClick={() => activateSubscription(row)}>
            <CheckCircle2 className="me-1 size-4" />
            تأكيد الدفع وتفعيل الاشتراك
          </Button>
        ) : null
      }
    />
  );
}
