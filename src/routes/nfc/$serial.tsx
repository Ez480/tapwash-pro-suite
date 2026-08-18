import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, CreditCard, Loader2, LogIn, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/auth";
import { useSettings } from "@/lib/data";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/nfc/$serial")({ component: NfcCardLookup });

type LookupResult = {
  card: { id?: string; uid: string | null; serial_number: string; status: string; activation_date: string | null } | null;
  customer: { id: string; full_name: string } | null;
  car: { id?: string; brand: string | null; model: string | null; color: string | null; plate_number: string | null } | null;
  subscription: { remaining_washes: number; status: string; package: { title_ar: string | null; title_en: string | null } | null } | null;
};

type PreviousOrder = {
  id: string; customer_id: string; package_id: string | null; offer_id: string | null; car_id: string | null;
  wash_type: string | null; amount: number | null; payment_method: string | null; customer_name: string | null;
  customer_phone: string | null; customer_email: string | null; car_type: string | null; car_brand: string | null;
  car_model: string | null; car_color: string | null; plate_number: string | null; address: string | null;
  location_url: string | null; latitude: number | null; longitude: number | null; notes: string | null;
};

function NfcCardLookup() {
  const { serial } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: settings } = useSettings();
  const { pick } = useI18n();
  const [result, setResult] = useState<LookupResult | null>(null);
  const [previous, setPrevious] = useState<PreviousOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [payment, setPayment] = useState("cash");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

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
    async function handleCard() {
      const identifier = decodeURIComponent(serial).trim().toUpperCase();
      if (!identifier) { setError(pick("NFC card identifier is missing.", "بيانات كارت NFC ناقصة.")); setLoading(false); return; }
      const { data, error: lookupError } = await supabase.rpc("public_nfc_lookup", { p_uid: identifier });
      if (!active) return;
      if (lookupError) { setError(lookupError.message); setLoading(false); return; }
      if (!data) { setError(pick("This card is not linked to a TapWash customer.", "الكارت ده غير مربوط بعميل في TapWash.")); setLoading(false); return; }
      setResult(data as LookupResult); setLoading(false);
    }
    void handleCard();
    return () => { active = false; };
  }, [serial, pick]);

  useEffect(() => {
    async function loadPreviousOrder() {
      if (!user || !result?.card?.id) return;
      if (result.customer?.id !== user.id) { setError(pick("This card belongs to another customer. Sign in with the linked account.", "الكارت ده مربوط بعميل تاني. سجل دخول بالحساب المرتبط بالكارت.")); return; }
      const { data, error: orderError } = await supabase.from("booking_requests")
        .select("id,customer_id,package_id,offer_id,car_id,wash_type,amount,payment_method,customer_name,customer_phone,customer_email,car_type,car_brand,car_model,car_color,plate_number,address,location_url,latitude,longitude,notes")
        .eq("customer_id", user.id).eq("card_id", result.card.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (orderError) { toast.error(orderError.message); return; }
      if (data) setPrevious(data as PreviousOrder);
    }
    void loadPreviousOrder();
  }, [user?.id, result?.card?.id, result?.customer?.id, pick]);

  useEffect(() => {
    async function loadSlots() {
      if (!date) return;
      setLoadingSlots(true); setTime("");
      const a = new Date(`${date}T00:00:00`), b = new Date(`${date}T23:59:59`);
      const { data, error: slotError } = await (supabase as any).rpc("get_booked_booking_slots", { p_start: a.toISOString(), p_end: b.toISOString() });
      if (slotError) { setLoadingSlots(false); toast.error(slotError.message); return; }
      const booked = new Set((data ?? []).map((x: any) => new Date(x.scheduled_at).toTimeString().slice(0, 5)));
      const resultSlots: string[] = [];
      let [h, m] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number); const stop = eh * 60 + em;
      while (h * 60 + m < stop) { const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; if (!booked.has(t)) resultSlots.push(t); m += step; h += Math.floor(m / 60); m %= 60; }
      setSlots(resultSlots); setLoadingSlots(false);
    }
    if (previous) void loadSlots();
  }, [date, previous, start, end, step]);

  async function reorder() {
    if (!user || !previous || !result?.card?.id || result.customer?.id !== user.id) return;
    if (!date || !time || !slots.includes(time)) return void toast.error(pick("Choose an available date and time.", "اختار يوم وموعد متاح."));
    setSaving(true);
    const when = new Date(`${date}T${time}:00`);
    const { data: conflict } = await (supabase as any).rpc("get_booked_booking_slots", { p_start: new Date(when.getTime() - 1000).toISOString(), p_end: new Date(when.getTime() + 1000).toISOString() });
    if ((conflict ?? []).length) { setSaving(false); toast.error(pick("This time was just booked. Choose another.", "الموعد اتحجز للتو، اختار موعد تاني.")); return; }
    const { error: insertError } = await (supabase as any).from("booking_requests").insert({
      customer_id: user.id, package_id: previous.package_id, offer_id: previous.offer_id, car_id: previous.car_id,
      wash_type: previous.wash_type ?? "car_wash", scheduled_at: when.toISOString(), customer_name: previous.customer_name ?? result.customer?.full_name ?? "",
      customer_phone: previous.customer_phone, customer_email: previous.customer_email ?? user.email, car_type: previous.car_type, car_brand: previous.car_brand,
      car_model: previous.car_model, car_color: previous.car_color, plate_number: previous.plate_number, address: previous.address ?? "",
      location_url: previous.location_url, latitude: previous.latitude, longitude: previous.longitude, notes: previous.notes,
      amount: Number(previous.amount ?? 0), payment_method: payment, payment_status: payment === "cash" ? "unpaid" : "awaiting_proof",
      status: "pending", card_id: result.card.id, scan_method: "customer_nfc_link",
    });
    setSaving(false);
    if (insertError) return void toast.error(insertError.message);
    toast.success(pick("Order created successfully. Management will confirm it.", "تم إنشاء الطلب بنجاح، وسيقوم المدير بتأكيده."));
    void navigate({ to: "/orders" });
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-8 animate-spin text-primary" /></main>;
  if (error) return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-lg rounded-3xl border p-8 shadow-xl"><h1 className="text-2xl font-bold text-destructive">TapWash NFC</h1><p className="mt-3 text-muted-foreground">{error}</p>{!user && <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/login", search: { redirect: `/nfc/${encodeURIComponent(serial)}` } as any })}><LogIn className="me-2 size-4"/> {pick("Sign in", "تسجيل الدخول")}</Button>}</div></main>;

  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-lg"><div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl dark:bg-white/5"><div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Sparkles className="size-6"/></span><div><p className="text-sm font-medium text-primary">TapWash NFC</p><h1 className="text-2xl font-black">{pick("Order again by tapping your card", "إعادة الطلب من الكارت")}</h1></div></div><div className="mt-6 rounded-2xl border p-4"><p className="font-bold">{result.customer?.full_name}</p><p className="mt-1 text-sm text-muted-foreground">{[result.car?.brand,result.car?.model,result.car?.plate_number].filter(Boolean).join(" · ") || "—"}</p><p className="mt-2 text-xs text-muted-foreground">{pick("No wash is deducted by scanning.", "المسح لا يخصم أي غسلة.")}</p></div>{!user ? <div className="mt-6"><Button className="w-full" onClick={() => void navigate({ to: "/login", search: { redirect: `/nfc/${encodeURIComponent(serial)}` } as any })}><LogIn className="me-2 size-4"/>{pick("Sign in to continue", "سجل دخولك للمتابعة")}</Button></div> : !previous ? <div className="mt-6 rounded-xl border p-4 text-sm text-muted-foreground">{pick("No previous order was found for this card yet.", "مفيش طلب سابق مرتبط بالكارت ده لسه.")}</div> : <div className="mt-6 space-y-5"><div className="space-y-2"><Label><CalendarDays className="me-1 inline size-4"/>{pick("Day", "اليوم")}</Label><Input type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)}/></div><div className="space-y-2"><Label>{pick("Available time", "الساعة المتاحة")}</Label>{loadingSlots?<Loader2 className="size-5 animate-spin"/>:<div className="grid grid-cols-3 gap-2">{slots.map(t=><Button key={t} type="button" variant={time===t?"default":"outline"} onClick={()=>setTime(t)}>{t}</Button>)}</div>}{!loadingSlots&&!slots.length&&<p className="text-sm text-muted-foreground">{pick("No available times. Choose another day.", "مفيش مواعيد متاحة، اختار يوم تاني.")}</p>}</div><div className="space-y-2"><Label><CreditCard className="me-1 inline size-4"/>{pick("Payment", "الدفع")}</Label><div className="grid gap-2">{paymentOptions.map(([value,label])=><Button key={value} type="button" variant={payment===value?"default":"outline"} className="justify-start" onClick={()=>setPayment(value)}>{payment===value&&<Check className="me-2 size-4"/>}{label}</Button>)}</div></div><Button className="w-full" disabled={saving||!time} onClick={()=>void reorder()}>{saving?<Loader2 className="me-2 size-4 animate-spin"/>:<RotateCcw className="me-2 size-4"/>}{pick("Confirm reorder", "تأكيد إعادة الطلب")}</Button></div>}</div></div></main>;
}
