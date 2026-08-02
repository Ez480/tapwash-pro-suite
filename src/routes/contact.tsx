import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHero, SiteLayout } from "@/components/site/Chrome";
import { useI18n } from "@/lib/i18n";
import { usePage, useSettings } from "@/lib/data";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact TapWash — WhatsApp, Phone & Address" },
      {
        name: "description",
        content:
          "Talk to the TapWash team on WhatsApp or by phone, daily 9am to 11pm. Serving Cairo and Giza.",
      },
      { property: "og:title", content: "Contact TapWash" },
      { property: "og:description", content: "WhatsApp or call the TapWash team, daily 9am–11pm." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { t, pick } = useI18n();
  const { data: page } = usePage("contact");
  const { data: s } = useSettings();
  const [form, setForm] = useState({ name: "", phone: "", message: "" });

  const wa = (s?.whatsapp ?? "").replace(/[^\d]/g, "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = `${pick("Name", "الاسم")}: ${form.name}\n${pick("Phone", "الهاتف")}: ${form.phone}\n${form.message}`;
    if (wa) {
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "_blank");
    }
    toast.success(t("message_sent"));
    setForm({ name: "", phone: "", message: "" });
  };

  return (
    <SiteLayout>
      <PageHero
        eyebrow={t("nav_contact")}
        title={page ? pick(page.title_en, page.title_ar) : t("nav_contact")}
        subtitle={page ? (pick(page.subtitle_en, page.subtitle_ar) ?? undefined) : undefined}
      />
      <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-lg text-muted-foreground">
            {page ? pick(page.content_en, page.content_ar) : ""}
          </p>
          <div className="mt-8 space-y-4">
            {s?.phone && (
              <a
                href={`tel:${s.phone}`}
                className="panel flex items-center gap-4 p-5 transition-colors hover:bg-secondary/60"
              >
                <Phone className="size-5 text-primary" />
                <span className="font-medium">{s.phone}</span>
              </a>
            )}
            {wa && (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noreferrer"
                className="panel flex items-center gap-4 p-5 transition-colors hover:bg-secondary/60"
              >
                <MessageCircle className="size-5 text-primary" />
                <span className="font-medium">{t("whatsapp")}</span>
              </a>
            )}
            {s?.email && (
              <a
                href={`mailto:${s.email}`}
                className="panel flex items-center gap-4 p-5 transition-colors hover:bg-secondary/60"
              >
                <Mail className="size-5 text-primary" />
                <span className="font-medium">{s.email}</span>
              </a>
            )}
            {s && (
              <div className="panel flex items-center gap-4 p-5">
                <MapPin className="size-5 text-primary" />
                <span className="font-medium">{pick(s.address_en ?? "", s.address_ar ?? "")}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="panel space-y-5 p-7">
          <h2 className="text-2xl font-bold">{t("contact_form_title")}</h2>
          <div className="space-y-2">
            <Label htmlFor="name">{t("full_name")}</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">{t("message")}</Label>
            <Textarea
              id="message"
              rows={5}
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" size="lg">
            {t("send")}
          </Button>
        </form>
      </section>
    </SiteLayout>
  );
}
