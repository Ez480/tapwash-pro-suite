import { formatDate } from "@/lib/format";
import { Link } from "@tanstack/react-router";
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
    <section className="tapwash-nfc-card relative mt-4 overflow-hidden rounded-[1.75rem] border border-white/45 bg-gradient-to-br from-cyan-400/15 via-sky-500/10 to-blue-600/15 p-3 shadow-lg sm:mt-5 sm:p-4" dir="ltr">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-primary/10" />

      <div className="relative rounded-[1.4rem] border border-white/35 bg-white/25 p-4 shadow-md dark:border-white/10 dark:bg-white/[0.06] sm:p-5">
        <div className="relative flex aspect-[1.586/1] w-full flex-col rounded-2xl border border-white/35 bg-white/20 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.05] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="relative flex size-11 shrink-0 items-center justify-center">
              <span className={`absolute -top-1 -end-1 size-2.5 rounded-full ${active ? "bg-blue-500" : "bg-red-500"} animate-pulse`} />
              <img src="/icons/tapwash-logo.svg" alt="TapWash" className="size-11 object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={active ? "default" : "destructive"} className="rounded-full px-3 py-1">
                {active ? "Active" : "Suspended"}
              </Badge>
              <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-muted-foreground"><path d="M7 8a6 6 0 0 1 0 8M11 5a10 10 0 0 1 0 14M15 2a14 14 0 0 1 0 20" /></svg>
            </div>
          </div>

          <p className="mt-auto truncate font-mono text-xl font-black tracking-[0.14em] text-foreground sm:text-2xl">{card?.serial_number || card?.uid || "—"}</p>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Card holder</p>
              <p className="mt-0.5 line-clamp-2 break-words text-xs font-black uppercase leading-tight text-foreground sm:text-sm">{customerName?.trim() || "—"}</p>
            </div>
            <div className="shrink-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Valid until</p>
              <p className="mt-0.5 text-sm font-black text-foreground">{validUntil || "—"}</p>
            </div>
            <div className="shrink-0 text-end">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Washes left</p>
              <p className="mt-0.5 text-sm font-black text-foreground">{remaining.toLocaleString("en-US")}</p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-sm font-black">{customerName?.trim() ? `Welcome, ${customerName.trim()}` : "Welcome"}</p>

        <Link
          to="/nfc-reorder"
          search={{ scan: "1" }}
          aria-label="Tap NFC TapWash"
          className="mt-3 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-black tracking-wide text-white shadow-md transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          Tap NFC TapWash
        </Link>

        <div className="mt-2 flex items-center justify-center gap-1.5" dir="ltr">
          <img src={QUIRKFY_LOGO} alt="Quirk.fy" className="h-3.5 w-auto object-contain dark:brightness-0 dark:invert" />
          <p className="text-center text-[10px] font-bold tracking-wide text-muted-foreground">
            Powered by Quirk.fy
          </p>
        </div>
      </div>
    </section>
  );
}