import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrudTable, type Row } from "@/components/admin/Crud";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/customers")({ component: AdminCustomers });

function AdminCustomers() {
  const { t, fmtDate } = useI18n();
  const openLocation=(r:Row)=>{const url=String(r["location_url"]||"")||(r["latitude"]!=null&&r["longitude"]!=null?`https://www.google.com/maps/search/?api=1&query=${r["latitude"]},${r["longitude"]}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(r["address_text"]||""))}`);if(url)window.open(url,"_blank","noopener,noreferrer");};
  return <CrudTable table="profiles" title={t("a_customers")} orderBy="created_at" canCreate={false} columns={[
    {key:"full_name",label:t("full_name")},{key:"email",label:"Email / البريد الإلكتروني"},{key:"phone",label:t("phone")},
    {key:"address_text",label:"العنوان",render:(r)=>String(r["address_text"]||"—")},
    {key:"customer_location",label:"اللوكيشن",render:(r)=>(r["location_url"]||r["latitude"]!=null||r["address_text"])?<Button size="sm" variant="ghost" onClick={()=>openLocation(r)}><Navigation className="me-1 size-3.5"/>فتح الموقع</Button>:<span className="text-muted-foreground">—</span>},
    {key:"status",label:t("status"),render:(r:Row)=><Badge variant={r["status"]==="active"?"default":"destructive"}>{r["status"]==="active"?t("active"):t("suspended")}</Badge>},
    {key:"created_at",label:t("activation_date"),render:r=>fmtDate(String(r["created_at"]))}
  ]} fields={[
    {name:"full_name",label:t("full_name")},{name:"phone",label:t("phone")},{name:"avatar_url",label:t("avatar_url")},
    {name:"address_text",label:"عنوان العميل"},{name:"location_url",label:"لينك اللوكيشن / Google Maps"},{name:"latitude",label:"خط العرض",type:"number"},{name:"longitude",label:"خط الطول",type:"number"},
    {name:"status",label:t("status"),type:"select",options:[{value:"active",label:t("active")},{value:"suspended",label:t("suspended")}]},
    {name:"language",label:t("language"),type:"select",options:[{value:"ar",label:"العربية"},{value:"en",label:"English"}]}
  ]}/>;
}
