import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, MapPin, Send, XCircle } from "lucide-react";
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

  const assign = async (r: any, employeeId: string) => {
    const emp = employees.find((e: any) => e.id === employeeId);
    if (!emp || r.status === "rejected") return;

    try {
      let customerId: string | null = null;
      if (r.customer_email) {
        const { data: customer, error: customerError } = await (supabase as any)
          .from("customers")
          .select("id")
          .ilike("email", r.customer_email)
          .maybeSingle();

        if (customerError) {
          console.error("Customer lookup failed while assigning booking", customerError);
          return toast.error(pick("Could not find the customer record", "تعذر العثور على سجل العميل"));
        }
        customerId = customer?.id ?? null;
      }

      let packageName: string | null = null;
      let offerName: string | null = null;

      // packages/offers do not have a `name` column in the current schema.
      // Only query columns that actually exist to prevent PGRST204 errors.
      if (r.package_id) {
        const { data: pkg, error: packageError } = await (supabase as any)
          .from("packages")
          .select("title_ar,title_en")
          .eq("id", r.package_id)
          .maybeSingle();

        if (packageError) {
          console.error("Package lookup failed while assigning booking", packageError);
          return toast.error(pick("Could not load the package", "تعذر تحميل الباقة"));
        }
        packageName = pkg?.title_ar || pkg?.title_en || null;
      }

      if (r.offer_id) {
        const { data: offer, error: offerError } = await (supabase as any)
          .from("offers")
          .select("title_ar,title_en")
          .eq("id", r.offer_id)
          .maybeSingle();

        if (offerError) {
          console.error("Offer lookup failed while assigning booking", offerError);
          return toast.error(pick("Could not load the offer", "تعذر تحميل العرض"));
        }
        offerName = offer?.title_ar || offer?.title_en || null;
      }

      const userResult = await supabase.auth.getUser();
      const createdBy = userResult.data.user?.id ?? null;

      if (!createdBy) {
        return toast.error(pick("Your session has expired. Please sign in again.", "انتهت جلسة تسجيل الدخول، سجل الدخول مرة أخرى."));
      }

      const serial = `TW-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await (supabase as any).from("employee_tasks").insert({
        serial_number: serial,
        booking_request_id: r.id,
        collection_amount: Number(r.amount ?? 0),
        title: r.wash_type === "car_wash" ? "Customer booking" : "Customer booking - " + r.wash_type,
        wash_type: r.wash_type,
        employee_id: employeeId,
        customer_id: customerId,
        package_name: packageName,
        offer_name: offerName,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_email: r.customer_email,
        location_text: r.address,
        location_url: r.location_url,
        latitude: r.latitude,
        longitude: r.longitude,
        scheduled_at: r.scheduled_at,
        notes: r.notes,
        status: "pending",
        created_by: createdBy,
      });

      if (error) {
        console.error("Employee task assignment failed", error);
        return toast.error(error.message || pick("Could not assign the order", "تعذر تكليف الموظف بالأوردر"));
      }

      const { error: updateError } = await (supabase as any)
        .from("booking_requests")
        .update({ status: "assigned" })
        .eq("id", r.id);

      if (updateError) {
        console.error("Booking status update after assignment failed", updateError);
        return toast.error(updateError.message || pick("Order was assigned but status could not be updated", "تم تكليف الموظف لكن تعذر تحديث حالة الطلب"));
      }

      toast.success(pick("Order sent to employee", "تم إرسال الأوردر للموظف"));
      refetch();
    } catch (error: any) {
      console.error("Unexpected employee assignment error", error);
      toast.error(error?.message || pick("Could not assign the order", "تعذر تكليف الموظف بالأوردر"));
    }
  };

  const reject = async (r: any) => {
    if (r.status === "assigned" || r.status === "rejected") return;

    const confirmed = window.confirm(
      pick(
        "Are you sure you want to reject this booking request?",
        "هل أنت متأكد أنك تريد رفض طلب الحجز ده؟",
      ),
    );
    if (!confirmed) return;

    try {
      const { error } = await (supabase as any)
        .from("booking_requests")
        .update({ status: "rejected" })
        .eq("id", r.id)
        .in("status", ["pending", "new", "confirmed"]);

      if (error) {
        console.error("Booking rejection failed", error);
        return toast.error(error.message || pick("Could not reject the booking", "تعذر رفض طلب الحجز"));
      }

      toast.success(pick("Booking request rejected", "تم رفض طلب الحجز"));
      refetch();
    } catch (error: any) {
      console.error("Unexpected booking rejection error", error);
      toast.error(error?.message || pick("Could not reject the booking", "تعذر رفض طلب الحجز"));
    }
  };

  const payment = (r: any) =>
    r.payment_method === "cash"
      ? pick("Cash", "كاش")
      : r.payment_method === "smart_wallet"
        ? pick("Smart Wallet", "محفظة ذكية")
        : r.payment_method === "instapay"
          ? "InstaPay"
          : pick("Bank transfer", "تحويل بنكي");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{pick("Customer booking requests", "طلبات حجز العملاء")}</h1>
          <p className="text-sm text-muted-foreground">{pick("Review the requested date, customer details and payment, then send the order to an employee.", "راجع الموعد وبيانات العميل والدفع ثم ابعت الأوردر جاهز للموظف.")}</p>
        </div>
      </div>

      <div className="space-y-4">
        {requests.length === 0 && <div className="panel p-8 text-center text-muted-foreground">{pick("No booking requests yet.", "مفيش طلبات حجز حالياً.")}</div>}
        {requests.map((r: any) => (
          <div key={r.id} className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{r.customer_name} · {r.customer_phone || "—"}</h2>
                <p className="text-sm text-muted-foreground">{r.customer_email || "—"}</p>
                <p className="mt-2 font-semibold">{fmtDate(r.scheduled_at)} · {new Date(r.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div className="flex gap-2"><Badge>{r.status}</Badge><Badge variant="secondary">{payment(r)}</Badge></div>
            </div>
            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <p><b>{pick("Car", "العربية")}:</b> {[r.car_type, r.car_brand, r.car_model, r.car_color, r.plate_number].filter(Boolean).join(" · ") || "—"}</p>
              <p><b>{pick("Amount", "المبلغ")}:</b> {Number(r.amount ?? 0).toFixed(2)} EGP</p>
              <p className="flex items-center gap-1"><MapPin className="size-4" /><b>{pick("Address", "العنوان")}:</b> {r.address || "—"}</p>
              <p><b>{pick("Payment status", "حالة الدفع")}:</b> {r.payment_status}</p>
            </div>
            {r.notes && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{r.notes}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <select className="h-10 min-w-52 rounded-md border bg-background px-3" defaultValue="" onChange={e => { if (e.target.value) assign(r, e.target.value); }} disabled={r.status === "assigned" || r.status === "rejected"}>
                <option value="">{r.status === "assigned" ? pick("Already assigned", "تم التكليف") : r.status === "rejected" ? pick("Booking rejected", "تم رفض الحجز") : pick("Choose employee", "اختر الموظف")}</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.full_name || e.email}</option>)}
              </select>
              {r.status !== "assigned" && r.status !== "rejected" && (
                <Button variant="destructive" onClick={() => reject(r)}>
                  <XCircle className="me-1 size-4" />
                  {pick("Reject booking", "رفض الحجز")}
                </Button>
              )}
              {r.location_url && <Button variant="outline" onClick={() => window.open(r.location_url, "_blank", "noopener,noreferrer")}><MapPin className="me-1 size-4" />{pick("Open location", "فتح الموقع")}</Button>}
              <Button variant="outline" onClick={() => navigator.clipboard?.writeText(r.customer_phone || "")}><Send className="me-1 size-4" />{pick("Copy phone", "نسخ الرقم")}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
