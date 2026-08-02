import { createFileRoute } from "@tanstack/react-router";

import { PageHero, SiteLayout } from "@/components/site/Chrome";
import { PackageCard } from "@/components/site/Cards";
import { useI18n } from "@/lib/i18n";
import { usePackages } from "@/lib/data";

export const Route = createFileRoute("/packages")({
  head: () => ({
    meta: [
      { title: "Membership Packages & Prices — TapWash" },
      {
        name: "description",
        content:
          "Compare TapWash monthly car wash memberships: Silver, Gold and Platinum plans with NFC cards, keychains and stickers.",
      },
      { property: "og:title", content: "Membership Packages & Prices — TapWash" },
      {
        property: "og:description",
        content: "Silver, Gold and Platinum NFC car wash memberships in Egypt.",
      },
    ],
  }),
  component: Packages,
});

function Packages() {
  const { t, pick } = useI18n();
  const { data, isLoading } = usePackages();
  const active = (data ?? []).filter((p) => p.status === "active");

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("nav_packages")}
        title={t("featured_packages")}
        subtitle={pick(
          "Every membership includes an NFC card, keychain or sticker linked to your account.",
          "كل عضوية تشمل كارت أو ميدالية أو ستيكر NFC مرتبط بحسابك.",
        )}
      />
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        {isLoading ? (
          <p className="text-muted-foreground">{t("loading")}</p>
        ) : active.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {active.map((p, i) => (
              <PackageCard key={p.id} pkg={p} featured={active.length === 3 && i === 1} />
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
