import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigation, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerProfileDialog } from "@/components/admin/CustomerProfile";
import type { Row } from "@/components/admin/Crud";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/customer-monitor")({ component: CustomerMonitor });

const PAGE_TITLE_AR = "مونيتور العملاء";

function openLocation(r: Row) {
  const base = "https://www.google.com/maps/search/?api=1" + String.fromCharCode(38) + "query=";
  const direct = String(r["location_url"] || "");
  const coords = r["latitude"] != null && r["longitude"] != null ? base + String(r["latitude"]) + "," + String(r["longitude"]) : "";
  const url = direct || coords || base + encodeURIComponent(String(r["address_text"] || ""));
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
const hasLocation = (r: Row) => Boolean(r["location_url"] || r["latitude"] != null || r["address_text"]);

function CustomerMonitor() {
  const { pick, fmtDate } = useI18n();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [profile, setProfile] = useState<Row | null>(null);
  const customers = useQuery({
    queryKey: ["admin", "customer-monitor", "profiles"],
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
  const cars = useQuery({
    queryKey: ["admin", "customer-monitor", "cars"],
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await (supabase as any).from("cars").select("customer_id");
      const counts: Record<string, number> = {};
      for (const c of (data ?? []) as Array<{ customer_id: string | null }>) { if (c.customer_id) counts[c.customer_id] = (counts[c.customer_id] ?? 0) + 1; }
      return counts;
    },
  });
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = customers.data ?? [];
    if (!term) return all;
    return all.filter((r) => [r["full_name"], r["phone"], r["email"]].some((v) => String(v ?? "").toLowerCase().includes(term)));
  }, [customers.data, q]);
  const carCount = (r: Row) => cars.data?.[String(r["id"])] ?? 0;
  const statusBadge = (r: Row) => <Badge variant={r["status"] === "active" ? "default" : "destructive"}>{r["status"] === "active" ? pick("Active", "نشط") : pick("Suspended", "موقوف")}</Badge>;
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["admin", "customer-monitor"] }); };
  const loading = customers.isLoading;
  const err = customers.error as Error | null;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">{pick("Customer monitor", PAGE_TITLE_AR)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{pick("Find any customer and open their profile.", "ابحث عن أي عميل وافتح ملفه.")}</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={customers.isFetching}><RefreshCw className={customers.isFetching ? "me-1.5 size-4 animate-spin" : "me-1.5 size-4"} />{pick("Refresh", "تحديث")}</Button>
      </div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={pick("Search by name, phone or email", "ابحث بالاسم أو الموبايل أو الإيميل")} className="ps-9" />
      </div>
      {err && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{err.message}</div>}
      <div className="panel hidden overflow-x-auto md:block">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{pick("Name", "الاسم")}</TableHead><TableHead>{pick("Phone", "الموبايل")}</TableHead><TableHead>{pick("Address", "العنوان")}</TableHead><TableHead>{pick("Cars", "السيارات")}</TableHead><TableHead>{pick("Status", "الحالة")}</TableHead><TableHead>{pick("Joined", "تاريخ الانضمام")}</TableHead><TableHead className="text-end">{pick("Profile", "الملف")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="text-muted-foreground">{pick("Loading…", "جاري التحميل…")}</TableCell></TableRow>}
            {!loading && !err && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">{pick("No customers found.", "مفيش عملاء مطابقين.")}</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={String(r["id"])}>
                <TableCell className="font-semibold">{String(r["full_name"] || "—")}</TableCell>
                <TableCell><span dir="ltr" className="inline-block">{String(r["phone"] || "—")}</span></TableCell>
                <TableCell>{String(r["address_text"] || "—")}</TableCell>
                <TableCell>{carCount(r)}</TableCell>
                <TableCell>{statusBadge(r)}</TableCell>
                <TableCell>{r["created_at"] ? fmtDate(String(r["created_at"])) : "—"}</TableCell>
                <TableCell className="text-end"><div className="flex justify-end gap-1.5">{hasLocation(r) && <Button size="sm" variant="ghost" onClick={() => openLocation(r)}><Navigation className="me-1 size-3.5" />{pick("Location", "الموقع")}</Button>}<Button size="sm" onClick={() => setProfile(r)}>{pick("Open profile", "فتح الملف")}</Button></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex flex-col gap-3 md:hidden">
        {loading && <div className="panel rounded-2xl p-4 text-sm text-muted-foreground">{pick("Loading…", "جاري التحميل…")}</div>}
        {!loading && !err && rows.length === 0 && <div className="panel rounded-2xl p-4 text-sm text-muted-foreground">{pick("No customers found.", "مفيش عملاء مطابقين.")}</div>}
        {rows.map((r) => (
          <div key={String(r["id"])} className="panel space-y-3 rounded-2xl p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">{String(r["full_name"] || "").trim().charAt(0) || "—"}</div>
              <div className="min-w-0 flex-1 text-start">
                <div className="truncate font-semibold">{String(r["full_name"] || "—")}</div>
                <div className="truncate text-xs text-muted-foreground" dir="ltr">{[r["phone"], r["email"]].filter(Boolean).join(" · ") || "—"}</div>
              </div>
            </div>
            {Boolean(r["address_text"]) && <div className="text-start text-sm text-muted-foreground">{pick("Address", "العنوان")}: {String(r["address_text"])}</div>}
            <div className="flex flex-wrap items-center gap-1.5">
              {statusBadge(r)}
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{carCount(r)} {pick("cars", "سيارات")}</span>
              {hasLocation(r) && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openLocation(r)}><Navigation className="me-1 size-3.5" />{pick("Location", "الموقع")}</Button>}
            </div>
            <Button className="w-full" onClick={() => setProfile(r)}>{pick("Open profile", "فتح الملف")}</Button>
          </div>
        ))}
      </div>
      <CustomerProfileDialog customer={profile} onClose={() => setProfile(null)} />
    </div>
  );
}
