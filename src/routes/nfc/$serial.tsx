import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/nfc/$serial")({
  component: NfcCardLookup,
});

type NfcCard = {
  id: string;
  serial_number: string;
  uid: string | null;
  card_type: string;
  status: string;
  customer_id: string | null;
  activation_date: string | null;
};

function NfcCardLookup() {
  const { serial } = Route.useParams();
  const [card, setCard] = useState<NfcCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function lookupCard() {
      setLoading(true);
      setError(null);
      setCard(null);

      const normalizedSerial = decodeURIComponent(serial).trim().toUpperCase();

      if (!normalizedSerial) {
        if (active) {
          setError("NFC card serial is missing.");
          setLoading(false);
        }
        return;
      }

      const { data, error: queryError } = await supabase
        .from("nfc_cards")
        .select(
          "id, serial_number, uid, card_type, status, customer_id, activation_date",
        )
        .eq("serial_number", normalizedSerial)
        .maybeSingle();

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError(`No NFC card was found for ${normalizedSerial}.`);
        setLoading(false);
        return;
      }

      setCard(data as NfcCard);
      setLoading(false);
    }

    void lookupCard();

    return () => {
      active = false;
    };
  }, [serial]);

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-lg">
        <div className="panel p-6 sm:p-8">
          <p className="text-sm font-medium text-primary">TapWash NFC</p>
          <h1 className="mt-2 text-2xl font-bold">NFC Card Lookup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Temporary route for testing NFC tags against the TapWash database.
          </p>

          <div className="mt-6 rounded-xl border p-4">
            <div className="text-xs text-muted-foreground">Card serial</div>
            <div className="mt-1 font-mono text-lg font-semibold">
              {decodeURIComponent(serial)}
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-xl border p-4 text-sm text-muted-foreground">
              Searching Supabase for this NFC card…
            </div>
          ) : error ? (
            <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <div className="font-semibold text-destructive">Lookup failed</div>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          ) : card ? (
            <div className="mt-6 space-y-3 rounded-xl border p-4 text-sm">
              <div className="font-semibold text-green-600">Card found in Supabase</div>
              <div>
                <span className="text-muted-foreground">Serial:</span> {card.serial_number}
              </div>
              <div>
                <span className="text-muted-foreground">UID:</span> {card.uid ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span> {card.card_type}
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span> {card.status}
              </div>
              <div>
                <span className="text-muted-foreground">Customer ID:</span>{" "}
                {card.customer_id ?? "—"}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
