import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/admin/Crud";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettings,
});

type SettingsForm = {
  company_name_en: string;
  company_name_ar: string;
  logo_url: string;
  phone: string;
  whatsapp: string;
  email: string;
  address_en: string;
  address_ar: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  primary_color: string;
  secondary_color: string;
};

const empty: SettingsForm = {
  company_name_en: "",
  company_name_ar: "",
  logo_url: "",
  phone: "",
  whatsapp: "",
  email: "",
  address_en: "",
  address_ar: "",
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
  primary_color: "#1F6FEB",
  secondary_color: "#0B1220",
};

function AdminSettings() {
  const { t } = useI18n();
  const { data } = useSettings();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(empty);

  useEffect(() => {
    if (!data) return;
    setForm({
      company_name_en: data.company_name_en ?? "",
      company_name_ar: data.company_name_ar ?? "",
      logo_url: data.logo_url ?? "",
      phone: data.phone ?? "",
      whatsapp: data.whatsapp ?? "",
      email: data.email ?? "",
      address_en: data.address_en ?? "",
      address_ar: data.address_ar ?? "",
      facebook_url: data.facebook_url ?? "",
      instagram_url: data.instagram_url ?? "",
      tiktok_url: data.tiktok_url ?? "",
      primary_color: data.primary_color ?? "#1F6FEB",
      secondary_color: data.secondary_color ?? "#0B1220",
    });
  }, [data]);

  const save = async () => {
    const { error } = await supabase.from("site_settings").update(form).eq("id", 1);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("saved"));
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const fields: { key: keyof SettingsForm; label: string; type?: string }[] = [
    { key: "company_name_en", label: t("company_name_en") },
    { key: "company_name_ar", label: t("company_name_ar") },
    { key: "logo_url", label: t("company_logo") },
    { key: "phone", label: t("phone") },
    { key: "whatsapp", label: t("whatsapp") },
    { key: "email", label: t("email") },
    { key: "address_en", label: t("address_en") },
    { key: "address_ar", label: t("address_ar") },
    { key: "facebook_url", label: "Facebook" },
    { key: "instagram_url", label: "Instagram" },
    { key: "tiktok_url", label: "TikTok" },
    { key: "primary_color", label: t("primary_color"), type: "color" },
    { key: "secondary_color", label: t("secondary_color"), type: "color" },
  ];

  return (
    <div>
      <SectionHeader title={t("a_settings")} />
      <div className="panel grid gap-5 p-6 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label>{f.label}</Label>
            <Input
              type={f.type ?? "text"}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <Button onClick={save}>{t("save")}</Button>
        </div>
      </div>
    </div>
  );
}
