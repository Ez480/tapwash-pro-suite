import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/nfc/$serial")({ component: NfcCardLookup });

type LookupResult = {
  card: { uid: string | null; serial_number: string; status: string; activation_date: string | null } | null;
  customer: { id: string; full_name: string } | null;
  car: { brand: string | null; model: string | null; color: string | null; plate_number: string | null } | null;
  subscription: {
    id: string; status: string; total_washes: number; used_washes: number; remaining_washes: number;
    start_date: string | null; end_date: string | null;
    package: { title_ar: string | null; title_en: string | null; washes_count: number | null } | null;
  } | null;
};

type ScanResult = { success: boolean; remaining_washes: number; customer_name: string | null };

function NfcCardLookup() {
  const { serial } = Route.useParams();
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);

  useEffect(() => {
    let active = true;
    async function scanCard() {
      setLoading(true); setError(null); setResult(null); setScan(null);
      const identifier = decodeURIComponent(serial).trim().toUpperCase();
      if (!identifier) { setError("NFC card identifier is missing."); setLoading(false); return; }

      const { data: scanData, error: scanError } = await supabase.rpc("public_nfc_scan", { p_uid: identifier });
      if (!active) return;
      if (scanError) { setError(scanError.message); setLoading(false); return; }
      setScan(scanData as ScanResult);

      const { data, error: queryError } = await supabase.rpc("public_nfc_lookup", { p_uid: identifier });
      if (!active) return;
      if (queryError) setError(queryError.message);
      else if (!data) setError("This NFC card is not linked to a TapWash customer.");
      else setResult(data as LookupResult);
      setLoading(false);
    }
    void scanCard();
    return () => { active = false; };
  }, [serial]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto w-full max-w-lg"><div className="panel p-6 sm:p-8">
        <p className="text-sm font-medium text-primary">TapWash</p>
        <h1 className="mt-2 text-3xl font-bold">Customer Wash Card</h1>
        {loading ? <div className="mt-6 rounded-xl border p-4 text-sm text-muted-foreground">Processing NFC scan…</div> :
         error ? <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4"><div className="font-semibold text-destructive">Scan failed</div><p className="mt-1 text-sm text-muted-foreground">{error}</p></div> :
         result ? <div className="mt-6 space-y-4">
          {scan?.success && <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4"><div className="font-semibold text-green-600">تم تسجيل الغسلة بنجاح</div><p className="mt-1 text-sm">المتبقي: {scan.remaining_washes} غسلة</p></div>}
          <section className="rounded-xl border p-4"><div className="text-sm text-muted-foreground">Customer</div><div className="mt-1 text-xl font-bold">{result.customer?.full_name ?? scan?.customer_name ?? "—"}</div></section>
          <section className="rounded-xl border p-4"><div className="text-sm text-muted-foreground">Vehicle</div><div className="mt-1 font-semibold">{[result.car?.brand, result.car?.model].filter(Boolean).join(" ") || "—"}</div><div className="mt-1 text-sm text-muted-foreground">{[result.car?.color, result.car?.plate_number].filter(Boolean).join(" • ") || "—"}</div></section>
          <section className="rounded-xl border p-4"><div className="text-sm text-muted-foreground">Subscription</div><div className="mt-1 font-semibold">{result.subscription?.package?.title_ar || result.subscription?.package?.title_en || "—"}</div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Remaining washes</div><div className="mt-1 text-2xl font-bold">{result.subscription?.remaining_washes ?? scan?.remaining_washes ?? 0}</div></div><div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">Status</div><div className="mt-1 font-bold capitalize">{result.subscription?.status ?? "—"}</div></div></div><div className="mt-4 text-sm text-muted-foreground">Valid until: {result.subscription?.end_date ?? "—"}</div></section>
          <div className="text-center text-xs text-muted-foreground">NFC: {result.card?.uid || result.card?.serial_number}</div>
        </div> : null}
      </div></div>
    </main>
  );
}
