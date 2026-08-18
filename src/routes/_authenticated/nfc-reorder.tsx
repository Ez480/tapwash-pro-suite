import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, CreditCard, ScanLine, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { AppTopbar } from "@/components/app/Shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/auth";
import { useSettings } from "@/lib/data";

declare global { interface Window { NDEFReader?: any } }

export const Route = createFileRoute("/_authenticated/nfc-reorder")({ component: NfcReorderPage });

const today = new Date().toISOString().slice(0, 10);

function extractValue(event: any) {
  for (const record of event?.message?.records ?? []) {
    try {
      const value = new TextDecoder(record.encoding || "utf-8").decode(record.data).trim();
      try { const parsed = JSON.parse(value); const id = parsed.uid || parsed.card_serial || parsed.serial_number || parsed.url; if (id) return String(id).trim(); } catch {}
      try { const url = new URL(value); const parts = url.pathname.split("/").filter(Boolean); const i = parts.findIndex((x) => x.toLowerCase() === "nfc"); if (i >= 0 && parts[i + 1]) return decodeURIComponent(parts[i + 1]).trim(); } catch {}
      if (value.replace(/^\u0000+/, "").trim()) return value.replace(/^\u0000+/, "").trim();
    } catch {}
  }
  return "";
}

function NfcReorderPage() {
  const { pick, fmtMoney } = useI18n();
  const { user } = useSession();
  const { data: settings } = useSettings();
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [card, setCard] = useState<any>(null);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [booked, setBooked] = useState<string[]>([]);
  const [payment, setPayment] = useState("cash");

  const s: any = settings;
  const start = (s?.booking_start_time ?? "09:00:00").slice(0, 5);
  const end = (s?.booking_end_time ?? "21:00:00").slice(0, 5);
  const step = Number(s?.booking_slot_minutes ?? 60);
  const slots = useMemo(() => { const out: string[] = []; let [h, m] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number); const stop = eh * 60 + em; while (h * 60 + m < stop) { out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`); m += step; h += Math.floor(m / 60); m %= 60; } return out; }, [start, end, step]);

  useEffect(() => {
    let live = true;
    if (!date) return;
    (async () => { const a = new Date(`${date}T00:00:00`).toISOString(); const b = new Date(`${date}T23:59:59`).toISOString(); const { data, error } = await (supabase as any).rpc("get_booked_booking_slots", { p_start: a, p_end: b }); if (live) { if (error) toast.error(error.message); setBooked((data ?? []).map((x: any) => new Date(x.scheduled_at).toTimeString().slice(0, 5))); } })();
    return () => { live = false; };
  }, [date]);

  const scan = async () => {
    if (!window.NDEFReader) return toast.error(pick("Web NFC is not supported. Use Chrome on Android with NFC enabled.", "المتصفح لا يدعم NFC. استخدم Chrome على Android مع تشغيل NFC."));
    try {
      setScanning(true); const reader = new window.NDEFReader(); await reader.scan();
      toast.info(pick("Bring your TapWash card, sticker or keychain close to the phone.", "قرّب كارت أو استيكر أو ميدالية TapWash من الموبايل."));
      reader.onreadingerror = () => { setScanning(false); toast.error(pick("Could not read the NFC tag.", "تعذر قراءة الـNFC.")); };
      reader.onreading = async (event: any) => {
        setScanning(false); const uid = extractValue(event); if (!uid || !user) return toast.error(pick("No readable NFC value.", "لم يتم العثور على قيمة NFC قابلة للقراءة."));
        const { data, error } = await (supabase as any).rpc("customer_nfc_reorder_lookup", { p_uid: uid });
        if (error) return toast.error(error.message);
        if (!data) return toast.error(pick("This card is not registered.", "الكارت ده غير مسجل في TapWash."));
        if (!data.owned) return toast.error(pick("This NFC tag belongs to another customer.", "الكارت ده مربوط بعميل آخر."));
        if (!data.last_order) return toast.error(pick("No previous order is linked to this tag.", "مفيش طلب سابق مرتبط بالكارت ده."));
        setCard(data); setDate(today); setTime("");
        toast.success(pick("Card verified. Choose a new date, time and payment method.", "تم التحقق من الكارت. اختار اليوم والساعة وطريقة الدفع."));
      };
    } catch (error) { setScanning(false); toast.error(error instanceof Error ? error.message : pick("NFC scan failed.", "فشل مسح NFC.")); }
  };

  const paymentConfigured = (method: string) => method === "cash" || (method === "smart_wallet" && !!s?.smart_wallet_number) || (method === "instapay" && !!s?.instapay_number) || (method === "bank_transfer" && !!s?.bank_account_number);

  const reorder = async () => {
    if (!card || !time || saving) return toast.error(pick("Choose a date and available time.", "اختار اليوم والموعد المتاح."));
    if (!paymentConfigured(payment)) return toast.error(pick("This payment method is not configured yet.", "طريقة الدفع دي لسه مش متفعلة."));
    const when = new Date(`${date}T${time}:00`);
    const { data: exists } = await (supabase as any).rpc("get_booked_booking_slots", { p_start: new Date(when.getTime() - 1000).toISOString(), p_end: new Date(when.getTime() + 1000).toISOString() });
    if ((exists ?? []).length) { setBooked((x) => [...x, time]); return toast.error(pick("This time was just booked. Choose another one.", "الموعد اتحجز للتو. اختار موعد تاني.")); }
    setSaving(true);
    const { error } = await (supabase as any).rpc("create_customer_nfc_reorder", { p_card_id: card.card_id, p_scheduled_at: when.toISOString(), p_payment_method: payment });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(pick("Your reorder request has been sent to TapWash.", "تم إرسال طلب إعادة الطلب لتاب وش."));
    setCard(null); setTime("");
  };

  return <div className="min-h-screen bg-background"><AppTopbar title={pick("NFC Reorder", "إعادة الطلب بالكارت")} /><main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
    <section className="panel p-6 text-center sm:p-8"><div className="mx-auto flex size-16 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary"><Smartphone className="size-8" /></div><h1 className="mt-4 text-2xl font-black">{pick("Scan your TapWash NFC tag", "اعمل Scan لكارت TapWash")}</h1><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{pick("Use your NFC card, sticker or keychain. Scanning never deducts a wash; it only prepares a new booking from your previous order.", "استخدم كارت أو استيكر أو ميدالية NFC. الـScan مش بيخصم غسلة؛ هو بس بيجهز إعادة الطلب من طلبك السابق.")}</p><Button className="mt-6 gap-2" onClick={() => void scan()} disabled={scanning || saving}><ScanLine className="size-5" />{scanning ? pick("Scanning…", "جاري المسح…") : pick("Scan NFC", "مسح NFC")}</Button></section>
    {card && <section className="panel mt-6 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><Badge>{pick("Verified tag", "كارت متحقق منه")}</Badge><h2 className="mt-2 text-xl font-bold">{card.last_order.wash_type || pick("TapWash service", "خدمة TapWash")}</h2><p className="text-sm text-muted-foreground">{[card.car?.brand, card.car?.model, card.car?.plate_number].filter(Boolean).join(" · ") || "—"}</p></div><p className="text-xl font-black text-primary">{fmtMoney(card.last_order.amount)}</p></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><div><Label>{pick("New date", "اليوم الجديد")}</Label><Input className="mt-2" type="date" min={today} value={date} onChange={e => { setDate(e.target.value); setTime(""); }} /><Label className="mt-5 block">{pick("Available time", "الساعة المتاحة")}</Label><div className="mt-2 grid grid-cols-3 gap-2">{slots.map(x => <Button key={x} type="button" disabled={booked.includes(x)} variant={time === x ? "default" : "outline"} onClick={() => setTime(x)}>{x}{booked.includes(x) ? " · محجوز" : ""}</Button>)}</div></div><div><Label>{pick("Payment method", "طريقة الدفع")}</Label><div className="mt-2 grid gap-2"><Button variant={payment === "cash" ? "default" : "outline"} onClick={() => setPayment("cash")}><CreditCard className="me-1.5 size-4" />{pick("Cash on service", "دفع عند الغسيل")}</Button><Button variant={payment === "smart_wallet" ? "default" : "outline"} onClick={() => setPayment("smart_wallet")}>{pick("Smart Wallet", "محفظة ذكية")}</Button><Button variant={payment === "instapay" ? "default" : "outline"} onClick={() => setPayment("instapay")}>{pick("InstaPay", "إنستا باي")}</Button><Button variant={payment === "bank_transfer" ? "default" : "outline"} onClick={() => setPayment("bank_transfer")}>{pick("Bank transfer", "تحويل بنكي")}</Button></div></div></div><Button className="mt-6 w-full gap-2" disabled={saving || !time} onClick={() => void reorder()}>{saving ? pick("Sending…", "جاري الإرسال…") : pick("Confirm reorder", "تأكيد إعادة الطلب")}</Button></section>}
    <div className="mt-6 text-center"><Button asChild variant="ghost"><Link to="/orders">{pick("Back to orders", "العودة للطلبات")}</Link></Button></div>
  </main></div>;
}
