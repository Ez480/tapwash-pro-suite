import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Car, CheckCircle2, CreditCard, MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useOffers, usePackages, useProfile, useSession, useSettings } from "@/lib/data";

export const Route = createFileRoute("/book")({
  validateSearch: (search) => ({
    type: typeof search.type === "string" ? search.type : "package",
    id: typeof search.id === "string" ? search.id : "",
  }),
  component: BookingPage,
});

type FormState = {
  date: string; time: string; wash_type: string; full_name: string; phone: string; email: string;
  car_type: string; brand: string; model: string; color: string; plate: string; address: string;
  location_url: string; notes: string; payment_method: string;
};

const today = new Date().toISOString().slice(0, 10);
const initialForm: FormState = { date: today, time: "", wash_type: "car_wash", full_name: "", phone: "", email: "", car_type: "", brand: "", model: "", color: "", plate: "", address: "", location_url: "", notes: "", payment_method: "cash" };

function BookingPage() {
  const { pick, fmtMoney } = useI18n();
  const { type, id } = Route.useSearch();
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const { data: settings } = useSettings();
  const { data: packages } = usePackages();
  const { data: offers } = useOffers();
  const [form, setForm] = useState<FormState>(initialForm);
  const [booked, setBooked] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const item = type === "offer" ? (offers ?? []).find((x) => x.id === id) : (packages ?? []).find((x) => x.id === id);
  const price = type === "offer" ? Number(item?.new_price ?? item?.old_price ?? 0) : Number(item?.price ?? 0);
  const title = item ? pick(item.title_en, item.title_ar) : pick("Selected service", "الخدمة المختارة");
  const startTime = settings?.booking_start_time?.slice(0, 5) ?? "09:00";
  const endTime = settings?.booking_end_time?.slice(0, 5) ?? "21:00";
  const slotMinutes = Number(settings?.booking_slot_minutes ?? 60);

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, full_name: profile.full_name ?? "", phone: profile.phone ?? "", email: profile.email ?? user?.email ?? "" }));
  }, [profile, user?.email]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!form.date) return;
      setLoadingSlots(true);
      const start = new Date(`${form.date}T00:00:00`).toISOString();
      const end = new Date(`${form.date}T23:59:59`).toISOString();
      const { data, error } = await supabase.from("booking_requests").select("scheduled_at,status").gte("scheduled_at", start).lte("scheduled_at", end).neq("status", "cancelled");
      if (active) {
        if (error) toast.error(error.message);
        setBooked((data ?? []).map((x) => new Date(x.scheduled_at).toTimeString().slice(0, 5)));
        setLoadingSlots(false);
      }
    };
    load();
    return () => { active = false; };
  }, [form.date]);

  const slots = useMemo(() => {
    const result: string[] = [];
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let minutes = sh * 60 + sm;
    const end = eh * 60 + em;
    while (minutes < end) {
      result.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
      minutes += slotMinutes;
    }
    return result;
  }, [startTime, endTime, slotMinutes]);

  const update = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!user) return;
    if (!item) return toast.error(pick("The selected package or offer is unavailable.", "الباقة أو العرض المختار غير متاح حالياً."));
    if (!form.date || !form.time || !form.full_name || !form.phone || !form.car_type || !form.address) return toast.error(pick("Complete the customer, car, address and appointment details.", "اكمل بيانات العميل والسيارة والعنوان وموعد الغسيل."));
    const scheduled = new Date(`${form.date}T${form.time}:00`);
    const { data: existing } = await supabase.from("booking_requests").select("id").eq("scheduled_at", scheduled.toISOString()).neq("status", "cancelled").maybeSingle();
    if (existing) return toast.error(pick("This time was just booked. Choose another time.", "الموعد ده اتحجز للتو، اختار موعد تاني."));
    setSubmitting(true);
    let carId: string | null = null;
    const { data: car } = await supabase.from("cars").insert({ customer_id: user.id, brand: form.brand || null, model: form.model || null, color: form.color || null, plate_number: form.plate || null, notes: form.car_type }).select("id").single();
    if (car) carId = car.id;
    const payload = {
      customer_id: user.id, package_id: type === "package" ? id : null, offer_id: type === "offer" ? id : null, car_id: carId,
      wash_type: form.wash_type, scheduled_at: scheduled.toISOString(), customer_name: form.full_name, customer_phone: form.phone, customer_email: form.email || user.email,
      car_type: form.car_type, car_brand: form.brand, car_model: form.model, car_color: form.color, plate_number: form.plate, address: form.address,
      location_url: form.location_url || null, notes: form.notes || null, amount: price, payment_method: form.payment_method,
      payment_status: form.payment_method === "cash" ? "unpaid" : "awaiting_proof", status: "pending",
    };
    const { error } = await supabase.from("booking_requests").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.code === "23505" ? pick("This appointment is no longer available.", "الموعد ده لم يعد متاحاً، اختار موعد تاني.") : error.message);
    setSubmitted(true);
    if (form.payment_method !== "cash") {
      const wa = (settings?.whatsapp ?? settings?.phone ?? "").replace(/\D/g, "");
      const message = pick(`Hello TapWash, I confirmed payment for ${title}. Appointment: ${form.date} ${form.time}. Amount: ${price} EGP. I am sending the payment screenshot now.`, `مرحباً TapWash، أكدت الدفع لـ ${title}. موعد الغسيل: ${form.date} ${form.time}. المبلغ: ${price} جنيه. سأرسل سكرين التحويل الآن.`);
      if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    }
  };

  if (!user) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-2xl font-bold">{pick("Login required", "لازم تسجل دخول")}</h1><p className="mt-2 text-muted-foreground">{pick("Sign in to book an appointment.", "سجل دخولك الأول عشان تحجز موعد.")}</p><Button asChild className="mt-6"><Link to="/login">{pick("Login", "تسجيل الدخول")}</Link></Button></div>;

  if (submitted) return <div className="mx-auto max-w-2xl px-4 py-20"><div className="panel p-8 text-center"><CheckCircle2 className="mx-auto size-14 text-primary" /><h1 className="mt-4 text-2xl font-bold">{pick("Booking request sent", "تم إرسال طلب الحجز")}</h1><p className="mt-3 text-muted-foreground">{pick("Your appointment is now visible to TapWash management. Your booking will be confirmed after review.", "طلبك ظهر للمدير، وسيتم تأكيد الموعد بعد المراجعة.")}</p>{form.payment_method !== "cash" && <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"><MessageCircle className="mx-auto mb-2 size-6 text-primary" /><b>{pick("Send the payment screenshot to the WhatsApp number shown on the site.", "ابعت سكرين التحويل على رقم واتساب الموجود في الموقع.")}</b></div>}<Button asChild className="mt-6"><Link to="/dashboard">{pick("Back to dashboard", "العودة للوحة العميل")}</Link></Button></div></div>;

  return <div className="min-h-screen bg-background"><div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6"><div className="mb-8"><Badge>{type === "offer" ? pick("Offer", "عرض") : pick("Package", "باقة")}</Badge><h1 className="mt-3 text-3xl font-bold">{title}</h1><p className="mt-2 text-muted-foreground">{item && "description_en" in item ? pick(item.description_en, item.description_ar) : ""}</p><p className="mt-4 text-3xl font-extrabold text-primary">{fmtMoney(price)}</p></div>
    <div className="grid gap-6 lg:grid-cols-2"><section className="panel p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-primary" />{pick("Choose appointment", "اختار موعد الغسيل")}</h2><div className="mt-5 space-y-4"><div className="space-y-2"><Label>{pick("Date", "التاريخ")}</Label><Input type="date" min={today} value={form.date} onChange={(e) => update("date", e.target.value)} /></div><div className="space-y-2"><Label>{pick("Available time", "الوقت المتاح")}</Label><div className="grid grid-cols-3 gap-2">{loadingSlots ? <p className="col-span-3 text-sm text-muted-foreground">{pick("Loading available times...", "جاري تحميل المواعيد المتاحة...")}</p> : slots.map((slot) => { const unavailable = booked.includes(slot); return <Button key={slot} type="button" variant={form.time === slot ? "default" : "outline"} disabled={unavailable} onClick={() => update("time", slot)}>{slot}{unavailable ? " · محجوز" : ""}</Button>; })}</div></div><div className="space-y-2"><Label>{pick("Wash type", "نوع الغسيل")}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.wash_type} onChange={(e) => update("wash_type", e.target.value)}><option value="car_wash">{pick("Car wash", "غسيل سيارة")}</option><option value="interior">{pick("Interior", "داخلي")}</option><option value="exterior">{pick("Exterior", "خارجي")}</option><option value="full">{pick("Full", "كامل")}</option></select></div></div></section>
      <section className="panel p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><Car className="size-5 text-primary" />{pick("Customer & car", "بيانات العميل والسيارة")}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>{pick("Full name", "الاسم")}</Label><Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} /></div><div className="space-y-2"><Label>{pick("Contact phone", "رقم التواصل")}</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div><div className="space-y-2"><Label>{pick("Car type", "نوع العربية")}</Label><Input value={form.car_type} onChange={(e) => update("car_type", e.target.value)} placeholder="Sedan / SUV..." /></div><div className="space-y-2"><Label>{pick("Brand", "الماركة")}</Label><Input value={form.brand} onChange={(e) => update("brand", e.target.value)} /></div><div className="space-y-2"><Label>{pick("Model", "الموديل")}</Label><Input value={form.model} onChange={(e) => update("model", e.target.value)} /></div><div className="space-y-2"><Label>{pick("Color", "اللون")}</Label><Input value={form.color} onChange={(e) => update("color", e.target.value)} /></div><div className="space-y-2"><Label>{pick("Plate number", "رقم اللوحة")}</Label><Input value={form.plate} onChange={(e) => update("plate", e.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>{pick("Address", "العنوان")}</Label><div className="flex gap-2"><MapPin className="mt-2 size-5 text-primary" /><Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder={pick("Full address", "العنوان بالتفصيل")} /></div></div><div className="space-y-2 sm:col-span-2"><Label>{pick("Map link (optional)", "لينك الموقع على الخريطة (اختياري)")}</Label><Input value={form.location_url} onChange={(e) => update("location_url", e.target.value)} placeholder="https://maps.google.com/..." /></div><div className="space-y-2 sm:col-span-2"><Label>{pick("Notes", "ملاحظات")}</Label><Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} /></div></div></section>
    </div>
    <section className="panel mt-6 p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><CreditCard className="size-5 text-primary" />{pick("Payment method", "طريقة الدفع")}</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><Button type="button" variant={form.payment_method === "cash" ? "default" : "outline"} onClick={() => update("payment_method", "cash")}>{pick("Cash on service", "دفع عند الغسيل")}</Button>{settings?.smart_wallet_number && <Button type="button" variant={form.payment_method === "smart_wallet" ? "default" : "outline"} onClick={() => update("payment_method", "smart_wallet")}>{pick("Smart Wallet", "محفظة ذكية")}</Button>}{settings?.instapay_number && <Button type="button" variant={form.payment_method === "instapay" ? "default" : "outline"} onClick={() => update("payment_method", "instapay")}>{pick("InstaPay", "إنستا باي")}</Button>}{settings?.bank_account_number && <Button type="button" variant={form.payment_method === "bank_transfer" ? "default" : "outline"} onClick={() => update("payment_method", "bank_transfer")}>{pick("Bank transfer", "تحويل بنكي")}</Button>}</div>{form.payment_method !== "cash" && <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm"><p className="font-bold">{pick("Transfer details", "بيانات التحويل")}</p>{form.payment_method === "smart_wallet" && <p className="mt-2">{pick("Smart Wallet", "المحفظة الذكية")}: <b>{settings?.smart_wallet_number}</b></p>}{form.payment_method === "instapay" && <p className="mt-2">InstaPay: <b>{settings?.instapay_number}</b></p>}{form.payment_method === "bank_transfer" && <div className="mt-2 space-y-1"><p>{settings?.bank_name}</p><p>{settings?.bank_account_name}</p><p>{settings?.bank_account_number}</p><p>{settings?.bank_iban}</p></div>}<p className="mt-3 text-muted-foreground">{pick("After confirming payment, send the transfer screenshot to the WhatsApp number listed on TapWash.", "بعد تأكيد الدفع، ابعت سكرين التحويل على رقم واتساب الموجود في موقع TapWash.")}</p></div>}<Button size="lg" className="mt-6 w-full" onClick={submit} disabled={submitting || !form.time}>{submitting ? pick("Sending...", "جاري الإرسال...") : pick("Confirm booking", "تأكيد الحجز")}</Button></section>
  </div></div>;
}
