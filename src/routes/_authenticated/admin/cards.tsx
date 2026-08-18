import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudTable } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { ContactlessCard, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/cards")({ component: AdminCards });

function AdminCards() {
  const { t, fmtDate, pick } = useI18n();
  const { data: customers } = useAdminTable("profiles", "id, full_name, phone", "created_at");
  const { data: cards } = useAdminTable("nfc_cards", "id,uid,serial_number,customer_id,status", "created_at");
  const [open, setOpen] = useState(false);
  const [cardId, setCardId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [saving, setSaving] = useState(false);

  const customerOptions = (customers ?? []).map((c) => ({ value: String(c.id), label: String(c.full_name ?? c.phone ?? c.id) }));
  const typeLabel = (v: unknown) => v === "card" ? t("card") : v === "sticker" ? t("sticker") : t("keychain");

  const reassign = async () => {
    if (!cardId || !customerId) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc("reassign_nfc_card", { p_card_id: cardId, p_new_customer_id: customerId, p_new_car_id: null });
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success(pick("Card reassigned successfully. NFC scan is now linked to the new customer.", "تم إعادة ربط الكارت بنجاح، وأصبح الـNFC مرتبطًا بالعميل الجديد فورًا."));
    setOpen(false); setCardId(""); setCustomerId("");
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/40 bg-gradient-to-br from-cyan-500/15 via-background to-blue-500/10 p-6 shadow-[0_18px_60px_rgba(8,145,178,0.12)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-400/15 shadow-lg shadow-cyan-500/10"><ContactlessCard className="size-8 text-cyan-600 dark:text-cyan-300" /></div>
            <div><h2 className="text-xl font-bold">{pick("NFC Card Center", "مركز كروت NFC")}</h2><p className="text-sm text-muted-foreground">{pick("Manage cards, assignments and secure reassignment.", "إدارة الكروت وربطها وإعادة ربطها بشكل آمن.")}</p></div>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2 rounded-xl"><Link2 className="size-4" />{pick("Reassign card", "إعادة ربط الكارت")}</Button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{pick("Reassign NFC card", "إعادة ربط كارت NFC")}</DialogTitle><DialogDescription>{pick("The UID stays unchanged. The old customer is detached and the new customer becomes the only active owner.", "الـUID لن يتغير. سيتم فك الكارت من العميل القديم وربطه بالعميل الجديد فقط.")}</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><label className="text-sm font-medium">{pick("Card / UID", "الكارت / UID")}</label><Select value={cardId} onValueChange={setCardId}><SelectTrigger><SelectValue placeholder={pick("Select card", "اختر الكارت")} /></SelectTrigger><SelectContent>{(cards ?? []).map((c) => <SelectItem key={String(c.id)} value={String(c.id)}>{String(c.serial_number || c.uid || c.id)} — UID: {String(c.uid || "—")}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><label className="text-sm font-medium">{pick("New customer", "العميل الجديد")}</label><Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder={pick("Select customer", "اختر العميل الجديد")} /></SelectTrigger><SelectContent>{customerOptions.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={() => void reassign()} disabled={!cardId || !customerId || saving}>{saving ? <RefreshCw className="me-2 size-4 animate-spin" /> : <Link2 className="me-2 size-4" />}{pick("Confirm reassignment", "تأكيد إعادة الربط")}</Button></DialogFooter></DialogContent></Dialog>

      <CrudTable
        table="nfc_cards"
        title={t("a_cards")}
        columns={[
          { key: "serial_number", label: t("serial_number") },
          { key: "card_type", label: t("card_type"), render: (r) => typeLabel(r["card_type"]) },
          { key: "status", label: t("status"), render: (r) => <Badge variant={r["status"] === "assigned" ? "default" : "secondary"}>{r["status"] === "assigned" ? t("assigned") : r["status"] === "blocked" ? t("blocked") : t("available")}</Badge> },
          { key: "customer_id", label: t("customer"), render: (r) => customerOptions.find((c) => c.value === String(r["customer_id"]))?.label ?? "—" },
          { key: "activation_date", label: t("activation_date"), render: (r) => fmtDate(r["activation_date"] ? String(r["activation_date"]) : null) },
        ]}
        fields={[
          { name: "serial_number", label: t("serial_number") },
          { name: "uid", label: t("uid") },
          { name: "card_type", label: t("card_type"), type: "select", defaultValue: "card", options: [{ value: "card", label: t("card") }, { value: "sticker", label: t("sticker") }, { value: "keychain", label: t("keychain") }] },
          { name: "status", label: t("status"), type: "select", defaultValue: "available", options: [{ value: "available", label: t("available") }, { value: "assigned", label: t("assigned") }, { value: "blocked", label: t("blocked") }] },
          { name: "activation_date", label: t("activation_date"), type: "date" },
        ]}
      />
    </div>
  );
}
