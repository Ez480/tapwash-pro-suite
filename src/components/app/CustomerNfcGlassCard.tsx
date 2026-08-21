import { Link } from "@tanstack/react-router";
import { ScanLine, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

function NfcMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M18 42c10-10 18-20 28-30" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M27 49c13-13 22-24 31-34" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".72" />
      <path d="M9 35c7-7 13-14 19-21" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

export function CustomerNfcGlassCard({ cards }: { cards?: any[] }) {
  const { pick } = useI18n();
  const card = cards?.[0];
  const active = String(card?.status ?? "active").toLowerCase() === "active";

  return (
    <section className="relative mt-4 overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-cyan-400/15 via-sky-500/10 to-blue-600/15 p-4 shadow-xl backdrop-blur-xl sm:mt-5 sm:p-5">
      <div className="pointer-events-none absolute -left-16 -top-20 size-48 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 size-56 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 blur-3xl dark:bg-cyan-200/10" />

      <div className="relative rounded-[1.6rem] border border-white/35 bg-white/25 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/30 text-primary shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
              <NfcMark className="size-8 -rotate-12" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/80">TapWash NFC</p>
              <h3 className="mt-0.5 text-base font-black">{pick("NFC card", "كارت NFC")}</h3>
            </div>
          </div>
          <Badge variant={active ? "default" : "destructive"} className="rounded-full px-3 py-1">
            {active ? pick("Active", "شغال") : pick("Suspended", "موقوف")}
          </Badge>
        </div>

        <div className="relative mx-auto mt-4 max-w-xl overflow-hidden rounded-[1.35rem] border border-white/45 bg-white/20 p-4 shadow-inner backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/20 sm:p-5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-primary/10 dark:from-white/10" />
          <div className="relative flex min-h-28 items-center gap-4 rounded-2xl border border-white/35 bg-white/30 p-4 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] sm:min-h-32 sm:p-5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/30 text-primary shadow-sm dark:border-white/10 dark:bg-white/10">
              <Smartphone className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black sm:text-base">{pick("Scan NFC TapWash", "سكان NFC تاب ووش")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{pick("Tap your card to continue", "قرّب الكارت من الهاتف للمتابعة")}</p>
            </div>
            <NfcMark className="size-10 shrink-0 -rotate-12 text-primary/80" />
          </div>

          <Button asChild size="lg" className="relative mt-4 w-full rounded-xl font-bold shadow-lg">
            <Link to="/nfc-reorder">
              <ScanLine className="me-2 size-5" />
              {pick("Scan card", "تشغيل مسح الكارت")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
