import { formatDate } from "@/lib/format";
import { Link } from "@tanstack/react-router";
import { Nfc } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMySubscription } from "@/lib/data";
import { QUIRKFY_LOGO } from "@/components/app/quirkfyLogo";

export function CustomerNfcGlassCard({ cards, customerName, remaining }: { cards?: any[]; customerName?: string | null; remaining: number }) {
  const card = cards?.[0];
  const active = String(card?.status ?? "active").toLowerCase() === "active";
  const { data: subscription } = useMySubscription(card?.customer_id);
  const subscriptionActive = String(subscription?.status ?? "").toLowerCase() === "active";
  const validUntil = subscriptionActive && subscription?.end_date
    ? formatDate(subscription.end_date, { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <section className="tapwash-nfc-card relative mt-4 overflow-hidden rounded-[1.75rem] border border-primary/20 bg-gradient-to-br from-cyan-400/15 via-sky-500/10 to-blue-600/15 p-3 shadow-xl backdrop-blur-xl sm:mt-5 sm:p-4" dir="ltr">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-primary/10" />

      <div className="relative rounded-[1.4rem] border border-white/35 bg-white/25 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/30 text-cyan-600 shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-cyan-300">
              <span className={`absolute -top-1 -end-1 size-2.5 rounded-full ${active ? "bg-blue-500" : "bg-red-500"} animate-pulse`} />
              <Nfc className="size-8" />
            </div>
            <div>
              <p className="text-base font-black">{customerName?.trim() ? `Welcome, ${customerName.trim()}` : "Welcome"}</p>
            </div>
          </div>
          <Badge variant={active ? "default" : "destructive"} className="rounded-full px-3 py-1">
            {active ? "Active" : "Suspended"}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-white/35 bg-white/20 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
            <p className="text-xs font-semibold text-muted-foreground">Washes remaining</p>
            <p className="mt-1 text-lg font-black text-foreground">{remaining.toLocaleString("en-US")}</p>
          </div>
          <div className="rounded-xl border border-white/35 bg-white/20 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
            <p className="text-xs font-semibold text-muted-foreground">Card number</p>
            <p className="mt-1 truncate font-mono text-sm font-black text-foreground">{card?.serial_number || card?.uid || "—"}</p>
          </div>
        </div>
        {validUntil && (
          <div className="mt-3 text-sm font-bold text-muted-foreground">
            Valid until <span className="font-black text-foreground">{validUntil}</span>
          </div>
        )}

        <Link
          to="/nfc-reorder"
          search={{ scan: "1" }}
          aria-label="Tap NFC TapWash"
          className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-black tracking-wide text-white shadow-md transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          Tap NFC TapWash
        </Link>

        <div className="mt-2 flex items-center justify-center gap-2" dir="ltr">
          <span className="inline-flex items-center justify-center rounded-full bg-white/85 p-1">
            <img src={QUIRKFY_LOGO} alt="Quirk.fy" className="h-5 w-auto object-contain" />
          </span>
          <p className="text-center text-sm font-black tracking-wide text-muted-foreground">
            Powered by Quirk.fy
          </p>
        </div>
      </div>
    </section>
  );
}