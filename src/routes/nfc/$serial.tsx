import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Car, CreditCard, Droplets, Loader2, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession, useUserRoles } from "@/lib/auth";
import { useSettings } from "@/lib/data";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/nfc/$serial")({ component: NfcCardLookup });

type LookupResult = {
  card: { id?: string; uid: string | null; serial_number: string; status: string; activation_date: string | null } | null;
  customer: { id: string; full_name: string } | null;
  car: { id?: string; brand: string | null; model: string | null; color: string | null; plate_number: string | null } | null;
  subscription: { remaining_washes: number; status: string; package: { title_ar: string | null; title_en: string | null } | null } | null;
};

type BookingDefaults = {
  customer: { id: string; full_name: string; phone: string | null; email: string | null } | null;
  car: { id?: string; brand: string | null; model: string | null; color: string | null; plate_number: string | null } | null;
  last_order: {
    id: string; package_id: string | null; offer_id: string | null; car_id: string | null; wash_type: string | null;
    amount: number | null; payment_method: string | null; customer_phone: string | null; customer_email: string | null;
    car_type: string | null; car_brand: string | null; car_model: string | null; car_color: string | null; plate_number: string | null;
    address: string | null; location_url: string | null; notes: string | null;
  } | null;
};

const today = new Date().toISOString().slice(0, 10);

function NfcCardLookup() {
  const { serial } = Route.useParams();
  const { user } = useSession();
  const { data: roles = [] } = useUserRoles(user?.id);
  const { data: settings } = useSettings();
  const { pick } = useI18n();
  const [result, setResult] = useState<LookupResult | null>(null);
  const [defaults, setDefaults] = useState<BookingDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState("cash");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deducting, setDeducting] = useState(false);
  const staffMode = roles.includes("admin") || roles.includes("employee");
  const start = String((settings as any)?.booking_start_time ?? "09:00:00").slice(0, 5);
  const end = String((settings as any)?.booking_end_time ?? "21:00:00").slice(0, 5);
  const step = Number((settings as any)?.booking_slot_minutes ?? 60);
  const paymentOptions = useMemo(() => [
    ["cash", pick("Pay on service", "دفع عند الغسيل")],
    ...((settings as any)?.smart_wallet_number ? [["smart_wallet", pick("Smart Wallet", "محفظة")]] : []),
    ...((settings as any)?.instapay_number ? [["instapay", "InstaPay"]] : []),
    ...((settings as any)?.bank_account_number ? [["bank_transfer", pick("Bank transfer", "تحويل بنكي")]] : []),
  ] as [string, string][], [settings, pick]);

  useEffect(() => {
    let active = true;
    (async () => {
      const identifier = decodeURIComponent(serial).trim().toUpperCase();
      if (!identifier) { setError(pick("NFC card identifier is missing.", "بيانات كارت NFC ناقصة.")); setLoading(false); return; }
      const [{ data, error: lookupError }, { data: bookingData, error: defaultsError }] = await Promise.all([
        supabase.rpc("public_nfc_lookup", { p_uid: identifier }),
        supabase.rpc("public_nfc_booking_defaults", { p_uid: identifier }),
      ]);
      if (!active) return;
      if (lookupError) { setError(lookupError.message); setLoading(false); return; }
      if (!data) { setError(pick("This card is not linked to a TapWash customer.", "الكارت ده غير مربوط بعميل في TapWash.")); setLoading(false); return; }
      setResult(data as LookupResult);
      if (!defaultsError && bookingData) {
        const d = bookingData as BookingDefaults;
        setDefaults(d);
        setPhone(d.customer?.phone ?? d.last_order?.customer_phone ?? "");
        setAddress(d.last_order?.address ?? "");
        setLocationUrl(d.last_order?.location_url ?? "");
        setNotes(d.last_order?.notes ?? "");
        setPayment(d.last_order?.payment_method ?? "cash");
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [serial, pick]);

  useEffect(() => {
    if (!date || staffMode) return;
    let active = true;
    (async () => {
      setLoadingSlots(true); setTime("");
      const from = new Date(`${date}T00:00:00`).toISOString();
      const to = new Date(`${date}T23:59:59`).toISOString();
      const { data, error: slotsError } = await (supabase as any).rpc("public_nfc_booked_slots", { p_start: from, p_end: to });
      if (!active) return;
      if (slotsError) toast.error(slotsError.message);
      const booked = new Set((data ?? []).map((x: any) => new Date(x.scheduled_at).toTimeString().slice(0, 5)));
      const generated: string[] = [];
      let [h, m] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const stop = eh * 60 + em;
      while (h * 60 + m < stop) {
        const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (!booked.has(value)) generated.push(value);
        m += step; h += Math.floor(m / 60); m %= 60;
      }
      setSlots(generated); setLoadingSlots(false);
    })();
    return () => { active = false; };
  }, [date, staffMode, start, end, step]);

  async function deductWash() {
    if (!user || !result?.card?.id || deducting) return;
    if ((result.subscription?.remaining_washes ?? 0) <= 0) return void toast.error(pick("No washes remaining.", "مفيش غسلات متبقية."));
    if (!window.confirm(pick("Confirm this wash? One wash will be deducted.", "تأكيد تسجيل الغسلة؟ سيتم خصم غسلة واحدة."))) return;
    setDeducting(true);
    const { error: e } = await (supabase as any).rpc("checkin_nfc_card", { p_card_value: result.card.uid || result.card.serial_number, p_booking_id: null });
    setDeducting(false);
    if (e) return void toast.error(e.message);
    const { data: refreshed, error: re } = await (supabase as any).rpc("public_nfc_lookup", { p_uid: result.card.uid || result.card.serial_number });
    if (re) return void toast.error(re.message);
    if (refreshed) setResult(refreshed as LookupResult);
    toast.success(pick("Wash recorded successfully. One wash deducted.", "تم تسجيل الغسلة بنجاح وخصم غسلة واحدة."));
  }

  async function submitBooking() {
    if (!result?.card?.uid && !result?.card?.serial_number) return;
    if (!date || !time || !slots.includes(time)) return void toast.error(pick("Choose an available date and time.", "اختار يوم وموعد متاح."));
    if (!phone.trim() || !address.trim()) return void toast.error(pick("Phone and address are required.", "رقم الهاتف والعنوان مطلوبين."));
    setSaving(true);
    const when = new Date(`${date}T${time}:00`);
    const { data: bookingId, error: bookingError } = await (supabase as any).rpc("public_nfc_create_booking", {
      p_uid: result.card.uid || result.card.serial_number,
      p_scheduled_at: when.toISOString(),
      p_phone: phone.trim(),
      p_address: address.trim(),
      p_location_url: locationUrl.trim() || null,
      p_notes: notes.trim() || null,
      p_payment_method: payment,
      p_wash_type: defaults?.last_order?.wash_type || "car_wash",
    });
    setSaving(false);
    if (bookingError) return void toast.error(bookingError.message);
    toast.success(pick("Booking request sent successfully. Management will confirm it.", "تم إرسال طلب الحجز بنجاح، وسيقوم المدير بتأكيده."));
    setTime("");
    setDate(today);
    void bookingId;
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-8 animate-spin text-primary" /></main>;
  if (error) return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-lg rounded-3xl border p-8 shadow-xl"><h1 className="text-2xl font-bold text-destructive">TapWash NFC</h1><p className="mt-3 text-muted-foreground">{error}</p></div></main>;

  if (staffMode) return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-lg"><div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl dark:bg-white/5"><div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Droplets className="size-6" /></span><div><p className="text-sm font-medium text-primary">TapWash NFC</p><h1 className="text-2xl font-black">{pick("Customer wash check-in", "تسجيل غسلة العميل")}</h1></div></div><div className="mt-6 rounded-2xl border p-4"><p className="font-bold">{result?.customer?.full_name}</p><p className="mt-1 text-sm text-muted-foreground">{[result?.car?.brand, result?.car?.model, result?.car?.plate_number].filter(Boolean).join(" · ") || "—"}</p><div className="mt-3 text-sm">{pick("Remaining washes", "الغسلات المتبقية")}: <strong>{result?.subscription?.remaining_washes ?? 0}</strong></div></div><Button className="mt-6 w-full" disabled={deducting || (result?.subscription?.remaining_washes ?? 0) <= 0} onClick={() => void deductWash()}>{deducting ? <Loader2 className="me-2 size-4 animate-spin" /> : <Droplets className="me-2 size-4" />}{pick("Record wash — deduct 1", "تسجيل الغسلة — خصم 1")}</Button><p className="mt-3 text-center text-xs text-muted-foreground">{pick("Simply opening the NFC link never deducts a wash.", "فتح رابط NFC وحده لا يخصم غسلة.")}</p></div></div></main>;

  const carText = [result?.car?.brand, result?.car?.model, result?.car?.color, result?.car?.plate_number].filter(Boolean).join(" · ");
  const amount = Number(defaults?.last_order?.amount ?? 0);
  const subscriptionStatus = String(result?.subscription?.status ?? "").toLowerCase();
  const subscriptionActive = subscriptionStatus === "active";
  const subscriptionLabel = subscriptionActive ? pick("Active", "نشط") : pick("Suspended", "موقوف");
  const subscriptionDot = subscriptionActive ? "bg-blue-500" : "bg-red-500";
  const packageName = result?.subscription?.package ? pick(result.subscription.package.title_en ?? "Package", result.subscription.package.title_ar ?? "الباقة") : pick("No active package", "لا توجد باقة نشطة");
  const remainingWashes = Number(result?.subscription?.remaining_washes ?? 0);

  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-lg">
    <div className="rounded-[2rem] border border-primary/20 bg-gradient-to-br from-cyan-400/15 via-sky-500/10 to-blue-600/15 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/35 bg-white/25 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] sm:p-6">
        <div className="pointer-events-none absolute -left-16 -top-20 size-48 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 size-56 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">TapWash Customer Card</p>
              <h1 className="mt-1 truncate text-xl font-black">{result?.customer?.full_name || "—"}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/30 bg-white/25 px-3 py-1.5 text-xs font-black shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
              <span className={`size-2.5 rounded-full ${subscriptionDot} animate-pulse`} />
              {subscriptionLabel}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/30 bg-white/20 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/30 text-primary shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
                <Car className="size-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{pick("Customer vehicle", "سيارة العميل")}</p>
                <p className="mt-0.5 truncate font-black">{carText || "—"}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/25 bg-white/20 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-[10px] text-muted-foreground">{pick("Package", "الباقة")}</p>
                <p className="mt-1 truncate text-sm font-bold">{packageName}</p>
              </div>
              <div className="rounded-xl border border-white/25 bg-white/20 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-[10px] text-muted-foreground">{pick("Remaining washes", "الغسلات المتبقية")}</p>
                <p className="mt-1 text-lg font-black">{remainingWashes}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/20 pt-4 text-xs text-muted-foreground">
            <span>{pick("NFC card", "كارت NFC")}</span>
            <span dir="ltr" className="font-black tracking-wider">{result?.card?.serial_number || result?.card?.uid || "—"}</span>
          </div>
        </div>
      </div>
    </div>

    <div className="mt-6 rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-2xl dark:bg-white/5 sm:p-6">
      <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Sparkles className="size-6" /></span><div><p className="text-sm font-medium text-primary">TapWash NFC</p><h2 className="text-xl font-black">{pick("Book your next wash", "احجز ميعاد الغسيل")}</h2></div></div>
      <p className="mt-4 text-xs text-muted-foreground">{pick("You are booking directly from your NFC card. No login is required.", "أنت بتحجز مباشرة من كارت NFC، ومش محتاج تسجيل دخول.")}</p>
      {amount > 0 && <p className="mt-3 font-bold text-primary">{pick("Previous service amount", "قيمة الخدمة السابقة")}: {amount} EGP</p>}
      <div className="mt-6 space-y-5"><div className="space-y-2"><Label><CalendarDays className="me-1 inline size-4" />{pick("Appointment date", "تاريخ الغسيل")}</Label><Input type="date" min={today} value={date} onChange={e => setDate(e.target.value)} /></div><div className="space-y-2"><Label>{pick("Available time", "الموعد المتاح")}</Label><div className="grid grid-cols-3 gap-2">{loadingSlots ? <span className="col-span-3 text-sm text-muted-foreground">{pick("Loading available times…", "جاري تحميل المواعيد…")}</span> : slots.length === 0 ? <span className="col-span-3 text-sm text-muted-foreground">{pick("No free times for this date.", "مفيش مواعيد متاحة في اليوم ده.")}</span> : slots.map(x => <Button key={x} type="button" variant={time === x ? "default" : "outline"} onClick={() => setTime(x)}>{x}</Button>)}</div></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>{pick("Phone number", "رقم الهاتف")}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01xxxxxxxxx" /></div><div className="space-y-2"><Label>{pick("Address", "العنوان")}</Label><div className="flex gap-2"><MapPin className="mt-2 size-5 text-primary" /><Input value={address} onChange={e => setAddress(e.target.value)} /></div></div></div><div className="space-y-2"><Label>{pick("Map link", "لينك الموقع")}</Label><Input value={locationUrl} onChange={e => setLocationUrl(e.target.value)} placeholder="https://maps.google.com/..." /></div><div className="space-y-2"><Label>{pick("Notes", "ملاحظات")}</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div><div className="space-y-2"><Label><CreditCard className="me-1 inline size-4" />{pick("Payment method", "طريقة الدفع")}</Label><div className="grid grid-cols-2 gap-2">{paymentOptions.map(([value, label]) => <Button key={value} type="button" variant={payment === value ? "default" : "outline"} onClick={() => setPayment(value)}>{label}</Button>)}</div></div><Button className="w-full" size="lg" disabled={saving || !time} onClick={() => void submitBooking()}>{saving ? <Loader2 className="me-2 size-4 animate-spin" /> : <CalendarDays className="me-2 size-4" />}{saving ? pick("Sending…", "جاري إرسال الحجز…") : pick("Confirm appointment", "تأكيد حجز الموعد")}</Button><p className="text-center text-xs text-muted-foreground">{pick("Scanning the card does not deduct a wash. A wash is deducted only during staff check-in.", "مسح الكارت لا يخصم غسلة. الخصم بيتم فقط عند تسجيل الغسلة بواسطة الموظف.")}</p></div>
    </div>
  </div></main>;
}
