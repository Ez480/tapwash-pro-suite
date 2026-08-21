import { Link } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-primary/10" />

      <div className="relative rounded-[1.6rem] border border-white/35 bg-white/25 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/30 text-primary shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
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

        <Link
          to="/nfc-reorder"
          aria-label={pick("Ready to scan. Tap your card on the phone to continue", "جاهز للمسح. قرّب الكارت من الهاتف للمتابعة")}
          className="group relative mx-auto mt-4 flex min-h-28 w-full max-w-xl items-center gap-4 overflow-hidden rounded-[1.35rem] border border-white/45 bg-white/25 p-4 shadow-lg backdrop-blur-xl transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/35 active:translate-y-0 dark:border-white/10 dark:bg-white/[0.06] sm:min-h-32 sm:p-5"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/30 text-primary shadow-sm dark:border-white/10 dark:bg-white/10">
            <Smartphone className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black sm:text-base">{pick("Ready to scan", "جاهز للمسح")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{pick("Tap your card on the phone to continue", "قرّب الكارت من الهاتف للمتابعة")}</p>
          </div>
          <NfcMark className="size-11 shrink-0 -rotate-12 text-primary transition-transform duration-150 group-hover:scale-105" />
        </Link>
      </div>
    </section>
  );
}
