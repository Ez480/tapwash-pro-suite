import { useState } from "react";
import { ScanLine, CheckCircle2, Droplets } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

declare global {
  interface Window {
    NDEFReader?: any;
  }
}

type LookupResult = {
  card?: { uid?: string | null; serial_number?: string | null } | null;
  customer?: { id?: string; full_name?: string | null } | null;
  car?: { brand?: string | null; model?: string | null; color?: string | null; plate_number?: string | null } | null;
  subscription?: {
    id?: string;
    status?: string;
    remaining_washes?: number;
    total_washes?: number;
    used_washes?: number;
  } | null;
};

function extractCardValue(event: any): string {
  const values: string[] = [];

  for (const record of event?.message?.records ?? []) {
    try {
      const type = String(record.recordType ?? "").toLowerCase();
      const decoder = new TextDecoder(record.encoding || "utf-8");
      const text = decoder.decode(record.data).trim();

      // Web NFC exposes URI records separately. This also handles cards that
      // store the TapWash customer URL instead of a raw UID.
      if (type === "url" || type === "absolute-url") {
        values.push(text);
        continue;
      }

      if (type === "text") {
        values.push(text);
        continue;
      }

      values.push(text);
    } catch {
      // Ignore an unreadable NDEF record and continue with the next one.
    }
  }

  for (const value of values) {
    try {
      const parsed = JSON.parse(value);
      const jsonValue = parsed.uid || parsed.card_serial || parsed.serial_number || parsed.url;
      if (jsonValue) return String(jsonValue).trim();
    } catch {
      // Not JSON; continue below.
    }

    // If the card contains the TapWash URL, use the serial in the final path segment.
    try {
      const url = new URL(value);
      const parts = url.pathname.split("/").filter(Boolean);
      const nfcIndex = parts.findIndex((part) => part.toLowerCase() === "nfc");
      if (nfcIndex >= 0 && parts[nfcIndex + 1]) {
        return decodeURIComponent(parts[nfcIndex + 1]).trim();
      }
    } catch {
      // Plain UID/serial value.
    }

    // Some URI NDEF payloads contain a leading URI-prefix byte. Remove it
    // when the decoded value is still a valid TapWash URL.
    const cleaned = value.replace(/^\u0000+/, "").trim();
    if (cleaned) return cleaned;
  }

  return "";
}

export function NfcCheckin() {
  const { pick } = useI18n();
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [cardValue, setCardValue] = useState("");

  const lookupCard = async (value: string) => {
    const identifier = value.trim();
    if (!identifier) {
      toast.error(pick("The card has no readable NFC value.", "الكارت لا يحتوي على قيمة NFC قابلة للقراءة."));
      return;
    }

    // IMPORTANT: scanning is lookup-only. It must NEVER deduct a wash.
    const { data, error } = await (supabase as any).rpc("public_nfc_lookup", {
      p_uid: identifier,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data) {
      setResult(null);
      toast.error(pick("NFC card not found.", "كارت NFC غير موجود."));
      return;
    }

    setCardValue(identifier);
    setResult(data as LookupResult);
    toast.success(pick("Card found. No wash was deducted.", "تم العثور على الكارت. لم يتم خصم أي غسلة."));
  };

  const scan = async () => {
    if (!window.NDEFReader) {
      return toast.error(
        pick(
          "Web NFC is not supported. Use Chrome on Android with NFC enabled.",
          "المتصفح لا يدعم NFC. استخدم Chrome على Android مع تشغيل NFC.",
        ),
      );
    }

    try {
      setScanning(true);
      const reader = new window.NDEFReader();
      await reader.scan();
      toast.info(pick("Bring the customer NFC card close to the phone.", "قرّب كارت العميل من الموبايل."));

      reader.onreadingerror = () => {
        setScanning(false);
        toast.error(pick("Could not read the NFC card.", "تعذر قراءة كارت العميل."));
      };

      reader.onreading = async (event: any) => {
        const value = extractCardValue(event);
        setScanning(false);
        await lookupCard(value);
      };
    } catch (error) {
      setScanning(false);
      toast.error(error instanceof Error ? error.message : pick("NFC scan failed", "فشل مسح NFC"));
    }
  };

  const deductWash = async () => {
    if (!cardValue || processing) return;

    const confirmed = window.confirm(
      pick(
        "Confirm recording this wash? One wash will be deducted from the customer's subscription.",
        "هل تريد تأكيد تسجيل الغسلة؟ سيتم خصم غسلة واحدة من اشتراك العميل.",
      ),
    );
    if (!confirmed) return;

    setProcessing(true);
    const { data, error } = await (supabase as any).rpc("checkin_nfc_card", {
      p_card_value: cardValue,
      p_booking_id: null,
    });
    setProcessing(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(pick("Wash recorded successfully.", "تم تسجيل الغسلة بنجاح."));

    // Refresh the lookup so the remaining-washes counter is immediately updated.
    const { data: refreshed } = await (supabase as any).rpc("public_nfc_lookup", {
      p_uid: cardValue,
    });
    if (refreshed) setResult(refreshed as LookupResult);

    void data;
  };

  const customerName = result?.customer?.full_name ?? "—";
  const remaining = result?.subscription?.remaining_washes ?? 0;
  const vehicle = [result?.car?.brand, result?.car?.model].filter(Boolean).join(" ") || "—";

  return (
    <section className="panel mb-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ScanLine className="size-5 text-primary" />
            {pick("Customer NFC check-in", "تسجيل استلام العميل بالكارت")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {pick(
              "Scan the customer's NFC card to view the customer. Scanning alone never deducts a wash.",
              "اعمل Scan لكارت العميل لعرض بياناته. المسح وحده لا يخصم أي غسلة.",
            )}
          </p>
        </div>
        <Button onClick={() => void scan()} disabled={scanning || processing} className="gap-2">
          <ScanLine className="size-4" />
          {scanning ? pick("Scanning...", "جاري المسح...") : pick("Scan NFC card", "مسح كارت NFC")}
        </Button>
      </div>

      {result ? (
        <div className="mt-4 space-y-4 rounded-xl border border-emerald-300/40 bg-emerald-100/20 p-4 dark:bg-emerald-400/[0.06]">
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <span className="font-semibold">{pick("Card found — no wash deducted", "تم العثور على الكارت — لم يتم خصم أي غسلة")}</span>
            <Badge variant="outline">{pick("Remaining washes", "الغسلات المتبقية")}: {remaining}</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{pick("Customer", "العميل")}</div>
              <div className="mt-1 font-semibold">{customerName}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{pick("Vehicle", "السيارة")}</div>
              <div className="mt-1 font-semibold">{vehicle}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{pick("Card", "الكارت")}</div>
              <div className="mt-1 truncate font-semibold">{result.card?.serial_number || result.card?.uid || cardValue}</div>
            </div>
          </div>

          <Button onClick={() => void deductWash()} disabled={processing || remaining <= 0} className="gap-2">
            <Droplets className="size-4" />
            {processing ? pick("Recording...", "جاري التسجيل...") : pick("Record wash — deduct 1", "تسجيل الغسلة — خصم 1")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
