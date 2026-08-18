import { useState } from "react";
import { ScanLine, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

declare global { interface Window { NDEFReader?: any } }

export function NfcCheckin() {
  const { pick } = useI18n();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const scan = async () => {
    if (!window.NDEFReader) return toast.error(pick("Web NFC is not supported. Use Chrome on Android with NFC enabled.", "المتصفح لا يدعم NFC. استخدم Chrome على Android مع تشغيل NFC."));
    try {
      setScanning(true);
      const reader = new window.NDEFReader();
      await reader.scan();
      toast.info(pick("Bring the customer NFC card close to the phone.", "قرّب كارت العميل من الموبايل."));
      reader.onreadingerror = () => { setScanning(false); toast.error(pick("Could not read the NFC card.", "تعذر قراءة كارت العميل.")); };
      reader.onreading = async (event: any) => {
        let raw = "";
        for (const record of event.message.records) {
          try { raw += new TextDecoder(record.encoding || "utf-8").decode(record.data); } catch {}
        }
        let cardValue = raw.trim();
        try { const parsed = JSON.parse(raw); cardValue = String(parsed.uid || parsed.card_serial || parsed.serial_number || raw).trim(); } catch {}
        if (!cardValue) { setScanning(false); return toast.error(pick("The card has no readable NFC value.", "الكارت لا يحتوي على قيمة NFC قابلة للقراءة.")); }
        const { data, error } = await (supabase as any).rpc("checkin_nfc_card", { p_card_value: cardValue, p_booking_id: null });
        setScanning(false);
        if (error) return toast.error(error.message);
        setResult(data);
        toast.success(pick("Card checked in. One wash was deducted.", "تم تسجيل الكارت وخصم غسلة واحدة."));
      };
    } catch (error) {
      setScanning(false);
      toast.error(error instanceof Error ? error.message : pick("NFC scan failed", "فشل مسح NFC"));
    }
  };

  return <section className="panel mb-6 p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold"><ScanLine className="size-5 text-primary" />{pick("Customer NFC check-in", "تسجيل استلام العميل بالكارت")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{pick("Scan the customer's NFC card when the car is received. Booking alone never deducts a wash.", "اعمل Scan لكارت العميل عند استلام السيارة. الحجز وحده لا يخصم أي غسلة.")}</p>
      </div>
      <Button onClick={() => void scan()} disabled={scanning} className="gap-2"><ScanLine className="size-4" />{scanning ? pick("Scanning...", "جاري المسح...") : pick("Scan NFC card", "مسح كارت NFC")}</Button>
    </div>
    {result ? <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-300/40 bg-emerald-100/20 p-4 dark:bg-emerald-400/[0.06]"><CheckCircle2 className="size-5 text-emerald-600" /><span className="font-semibold">{pick("Check-in completed", "تم تسجيل الاستلام")}</span><Badge variant="outline">{pick("Remaining washes", "الغسلات المتبقية")}: {result.remaining_washes ?? "—"}</Badge><Badge variant="outline">#{String(result.booking_id ?? "").slice(0, 8).toUpperCase()}</Badge></div> : null}
  </section>;
}
