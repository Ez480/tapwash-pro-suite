import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, MapPin, Send, XCircle, CheckCircle2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/booking-requests")({ component: BookingRequests });

function BookingRequests() {
  const { pick, fmtDate } = useI18n();
  const { data: requests = [], refetch } = useAdminTable("booking_requests", "*", "created_at");
  const { data: profiles = [] } = useAdminTable("profiles", "*", "created_at");
  const employees = profiles.filter((p: any) => p.role === "employee" && p.status !== "suspended");

  const isOnlinePayment = (r: any) => ["smart_wallet", "instapay", "bank_transfer"].includes(String(r.payment_method ?? ""));
  const canAssign = (r: any) => !isOnlinePayment(r) || String(r.payment_status ?? "") === "paid";

  const confirmBooking = async (r: any) => {
    if (["confirmed", "assigned", "completed", "cancelled", "rejected"].includes(r.status)) return;
    try {
      const { error } = await (supabase as any).from("booking_requests").update({ status: "confirmed" }).eq("id", r.id).not("status", "in", "(completed,cancelled,rejected)");
      if (error) throw error;
      if (r.customer_id) await (supabase as any).from("notifications").insert({ user_id: r.customer_id, type: "booking_confirmed", title: "Booking confirmed", message: "Your booking has been confirmed by management", data: { booking_request_id: r.id } });
      toast.success(pick("Booking confirmed. The customer was notified.", "تم تأكيد الحجز وإبلاغ العميل.")); refetch();
    } catch (error: any) { toast.error(error?.message || pick("Could not confirm the booking", "تعذر تأكيد الحجز")); }
  };

  const assign = async (r: any, employeeId: string) => {
    const emp = employees.find((e: any) => e.id === employeeId);
    if (!emp || ["rejected", "cancelled"].includes(r.status)) return;
    if (!canAssign(r)) {
      const message = String(r.payment_status ?? "") === "rejected"
        ? pick("Assignment blocked: the payment was rejected. Review the payment and resolve it first.", "تم منع التكليف: حالة الدفع مرفوضة. راجع المدفوعات أولاً واتخذ الإجراء المناسب.")
        : pick("Assignment blocked: this online payment has not been approved yet. Confirm or reject it in Payments first.", "تم منع التكليف: الدفع الأونلاين لم يتم اعتماده بعد. يجب تأكيد الدفع أو رفضه من صفحة المدفوعات أولاً.");
      toast.error(message, { duration: 6000 });
      return;
    }
    try {
      let customerId: string | null = r.customer_id ?? null;
      if (!customerId && r.customer_email) {
        const { data: customer, error: customerError } = await (supabase as any).from("customers").select("id").ilike("email", r.customer_email).maybeSingle();
        if (customerError) return toast.error(pick("Could not find the customer record", "تعذر العثور على سجل العميل"));
        customerId = customer?.id ?? null;
      }
      let packageName: string | null = null; let offerName: string | null = null;
      if (r.package_id) {
        const { data: pkg, error } = await (supabase as any).from("packages").select("title_ar,title_en").eq("id", r.package_id).maybeSingle();
        if (error) return toast.error(pick("Could not load the package", "تعذر تحميل الباقة"));
        packageName = pkg?.title_ar || pkg?.title_en || null;
      }
      if (r.offer_id) {
        const { data: offer, error } = await (supabase as any).from("offers").select("title_ar,title_en").eq("id", r.offer_id).maybeSingle();
        if (error) return toast.error(pick("Could not load the offer", "تعذر تحميل العرض"));
        offerName = offer?.title_ar || offer?.title_en || null;
      }
      const { data: authData } = await supabase.auth.getUser();
      const createdBy = authData.user?.id ?? null;
      if (!createdBy) return toast.error(pick("Your session has expired. Please sign in again.", "انتهت جلسة تسجيل الدخول، سجل الدخول مرة أخرى."));
      const serial = `TW-${Date.now().toString(36).toUpperCase()}`;
      const amount = Number(r.amount ?? 0);
      const paymentLabel = r.payment_method === "cash" ? pick("Cash", "كاش") : r.payment_method === "smart_wallet" ? pick("Smart Wallet", "محفظة") : r.payment_method === "instapay" ? "InstaPay" : pick("Bank transfer", "تحويل بنكي");
      const orderTitle = `${r.wash_type === "car_wash" ? pick("Customer booking", "حجز عميل") : `${pick("Customer booking", "حجز عميل")} - ${r.wash_type}`} · ${amount.toFixed(2)} EGP · ${paymentLabel}`;
      const { error } = await (supabase as any).from("employee_tasks").insert({
        serial_number: serial, booking_request_id: r.id, collection_amount: amount,
        payment_method: r.payment_method ?? null, payment_status: r.payment_status ?? null,
        title: orderTitle,
        wash_type: r.wash_type, employee_id: employeeId, customer_id: customerId,
        package_name: packageName, offer_name: offerName, customer_name: r.customer_name,
        customer_phone: r.customer_phone, customer_email: r.customer_email, location_text: r.address,
        location_url: r.location_url, latitude: r.latitude, longitude: r.longitude,
        scheduled_at: r.scheduled_at, notes: r.notes, status: "pending", created_by: createdBy
      });
      if (error) return toast.error(error.message || pick("Could not assign the order", "تعذر تكليف الموظف بالأوردر"));
      const { error: updateError } = await (supabase as any).from("booking_requests").update({ status: "assigned" }).eq("id", r.id);
      if (updateError) return toast.error(updateError.message || pick("Order was assigned but status could not be updated", "تم تكليف الموظف لكن تعذر تحديث حالة الطلب"));
      toast.success(pick("Order sent to employee", "تم إرسال الأوردر للموظف")); refetch();
    } catch (error: any) { toast.error(error?.message || pick("Could not assign the order", "تعذر تكليف الموظف بالأوردر")); }
  };

  const cancelBooking = async (r: any) => {
    if (["completed", "cancelled", "rejected"].includes(r.status)) return;
    const confirmed = window.confirm(pick("Cancel this booking? The order will remain in history as cancelled.", "هل أنت متأكد من إلغاء الحجز؟ سيظل الأوردر محفوظًا في الطلبات السابقة كملغي."));
    if (!confirmed) return;
    try {
      const { error: bookingError } = await (supabase as any).from("booking_requests").update({ status: "cancelled" }).eq("id", r.id).neq("status", "completed");
      if (bookingError) throw bookingError;
      const { data: linkedTasks } = await (supabase as any).from("employee_tasks").select("id,employee_id,status").eq("booking_request_id", r.id);
      await (supabase as any).from("employee_tasks").update({ status: "cancelled", delivery_status: "cancelled" }).eq("booking_request_id", r.id).neq("status", "completed");
      for (const task of linkedTasks ?? []) if (task.employee_id && task.status !== "completed") await (supabase as any).from("notifications").insert({ user_id: task.employee_id, type: "order_cancelled", title: "Order cancelled", message: `Order ${r.customer_name || "customer booking"} was cancelled`, data: { booking_request_id: r.id, task_id: task.id } });
      if (r.customer_id) await (supabase as any).from("notifications").insert({ user_id: r.customer_id, type: "booking_cancelled", title: "Booking cancelled", message: "Your booking has been cancelled", data: { booking_request_id: r.id } });
      toast.success(pick("Booking cancelled and kept in history", "تم إلغاء الحجز والاحتفاظ به في الطلبات السابقة")); refetch();
    } catch (error: any) { toast.error(error?.message || pick("Could not cancel the booking", "تعذر إلغاء الحجز")); }
  };

  const payment = (r: any) => r.payment_method === "cash" ? pick("Cash", "كاش") : r.payment_method === "smart_wallet" ? pick("Smart Wallet", "محفظة ذكية") : r.payment_method === "instapay" ? "InstaPay" : pick("Bank transfer", "تحويل بنكي");
  const statusLabel = (status: string) => ({ confirmed: pick("Confirmed", "تم التأكيد"), assigned: pick("Assigned", "تم التكليف"), cancelled: pick("Cancelled", "ملغي"), rejected: pick("Rejected", "مرفوض") } as any)[status] ?? status;

  return <div className="space-y-6">
    <div className="flex items-center gap-3"><ClipboardCheck className="size-6 text-primary" /><div><h1 className="text-2xl font-bold">{pick("Customer booking requests", "طلبات حجز العملاء")}</h1><p className="text-sm text-muted-foreground">{pick("Confirm the booking first, then resolve online payment before assigning an employee.", "أكد الحجز أولاً، وبعدها لازم تحسم حالة الدفع الأونلاين قبل تكليف الموظف.")}</p></div></div>
    <div className="space-y-4">
      {requests.length === 0 && <div className="panel p-8 text-center text-muted-foreground">{pick("No booking requests yet.", "مفيش طلبات حجز حالياً.")}</div>}
      {requests.map((r: any) => <div key={r.id} className="panel p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{r.customer_name} · {r.customer_phone || "—"}</h2><p className="text-sm text-muted-foreground">{r.customer_email || "—"}</p><p className="mt-2 text-sm"><b>{pick("Requested on", "تاريخ ووقت الطلب")}:</b> {fmtDate(r.created_at)} · {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p><p className="mt-1 font-semibold"><b>{pick("Wash appointment", "موعد الغسيل")}:</b> {fmtDate(r.scheduled_at)} · {new Date(r.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div><div className="flex gap-2"><Badge>{statusLabel(r.status)}</Badge><Badge variant="secondary">{payment(r)}</Badge></div></div><div className="mt-4 grid gap-3 text-sm md:grid-cols-2"><p><b>{pick("Car", "العربية")}:</b> {[r.car_type, r.car_brand, r.car_model, r.car_color, r.plate_number].filter(Boolean).join(" · ") || "—"}</p><p><b>{pick("Amount", "المبلغ")}:</b> {Number(r.amount ?? 0).toFixed(2)} EGP</p><p className="flex items-center gap-1"><MapPin className="size-4" /><b>{pick("Address", "العنوان")}:</b> {r.address || "—"}</p><p><b>{pick("Payment status", "حالة الدفع")}:</b> {r.payment_status}</p></div>{r.notes && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{r.notes}</p>}{isOnlinePayment(r) && r.payment_status !== "paid" && <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-100/30 p-3 text-sm"><LockKeyhole className="size-4 shrink-0" /><span>{r.payment_status === "rejected" ? pick("Payment rejected. Employee assignment is blocked until the payment issue is resolved.", "الدفع مرفوض. تكليف الموظف متوقف لحين حل حالة الدفع.") : pick("Employee assignment is blocked until the manager confirms or rejects this payment in Payments.", "تكليف الموظف متوقف لحين تأكيد أو رفض حالة الدفع من صفحة المدفوعات.")}</span></div>}<div className="mt-5 flex flex-wrap items-center gap-2">{!["confirmed", "assigned", "rejected", "cancelled", "completed"].includes(r.status) && <Button onClick={() => confirmBooking(r)}><CheckCircle2 className="me-1 size-4" />{pick("Confirm booking", "تأكيد الطلب")}</Button>}<select className="h-10 min-w-52 rounded-md border bg-background px-3 disabled:cursor-not-allowed disabled:opacity-50" defaultValue="" onChange={e => { if (e.target.value) assign(r, e.target.value); }} disabled={r.status === "assigned" || r.status === "rejected" || r.status === "cancelled" || !canAssign(r)}><option value="">{r.status === "assigned" ? pick("Already assigned", "تم التكليف") : r.status === "cancelled" ? pick("Booking cancelled", "الحجز ملغي") : r.status === "rejected" ? pick("Booking rejected", "تم رفض الحجز") : !canAssign(r) ? pick("Resolve payment first", "احسم الدفع أولاً") : pick("Choose employee", "اختر الموظف")}</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{e.full_name || e.email}</option>)}</select>{!["assigned", "rejected", "cancelled", "completed"].includes(r.status) && <Button variant="destructive" onClick={() => cancelBooking(r)}><XCircle className="me-1 size-4" />{pick("Cancel booking", "إلغاء الحجز")}</Button>}{r.location_url && <Button variant="outline" onClick={() => window.open(r.location_url, "_blank", "noopener,noreferrer")}><MapPin className="me-1 size-4" />{pick("Open location", "فتح الموقع")}</Button>}<Button variant="outline" onClick={() => navigator.clipboard?.writeText(r.customer_phone || "")}><Send className="me-1 size-4" />{pick("Copy phone", "نسخ الرقم")}</Button></div></div>)}
    </div>
  </div>;
}
