import { Link } from "@tanstack/react-router";
import { Nfc } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

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
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/30 text-cyan-600 shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-cyan-300">
              <Nfc className="size-8" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/80">TapWash NFC</p>
              <h3 className="mt-0.5 text-base font-black">{pick("NFC card", "كارت NFC")}</h3>
            </div>
          </div>
          <Badge variant={active ? "default" : "destructive"} className="rounded-full px-3 py-1">
            <span className={`me-2 inline-block size-2 rounded-full ${active ? "bg-sky-400 animate-pulse" : "bg-red-400 animate-pulse"}`} />
            {active ? pick("Active", "نشط") : pick("Suspended", "موقوف")}
          </Badge>
        </div>

        <Link
          to="/nfc-reorder"
          aria-label={pick("Scan NFC card", "مسح كارت NFC")}
          className="group relative mt-4 flex min-h-28 w-full items-center justify-center overflow-hidden rounded-[1.35rem] border border-white/45 bg-white/25 p-5 shadow-lg backdrop-blur-xl transition-transform duration-150 hover:bg-white/35 active:scale-[0.995] dark:border-white/10 dark:bg-white/[0.06] sm:min-h-32 sm:p-6"
        >
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <Nfc className="size-9 text-primary" />
            <p className="text-sm font-black sm:text-base">{pick("Ready to scan", "جاهز للمسح")}</p>
            <p className="text-xs text-muted-foreground">{pick("Bring the card close to the phone to continue", "قرّب الكارت من الهاتف للمتابعة")}</p>
          </div>
        </Link>
      </div>
    </section>
  );
}
