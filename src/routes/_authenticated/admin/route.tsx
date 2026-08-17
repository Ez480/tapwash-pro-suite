import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign, Bell, ClipboardCheck, ClipboardList, CreditCard, FileText, Gift, LayoutDashboard, Package, PieChart, Settings, Users, UserSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AdminNav, AppTopbar } from "@/components/app/Shell";
import { useI18n } from "@/lib/i18n";
import { useIsAdmin, useSession } from "@/lib/auth";
import { adminExists, claimAdmin } from "@/lib/admin.functions";

export const Route=createFileRoute("/_authenticated/admin")({component:AdminLayout});
function AdminLayout(){
 const{t}=useI18n();const{user}=useSession();const{data:roles,isLoading}=useIsAdmin(user?.id);const queryClient=useQueryClient();const checkAdmin=useServerFn(adminExists);const claim=useServerFn(claimAdmin);const isAdmin=(roles??[]).includes("admin");const{data:existing}=useQuery({queryKey:["admin-exists"],enabled:!isLoading&&!isAdmin,queryFn:()=>checkAdmin()});
 const items=[{to:"/admin",label:t("a_dashboard"),icon:LayoutDashboard},{to:"/admin/booking-requests",label:"طلبات الحجز",icon:ClipboardCheck},{to:"/admin/tasks",label:"المهام / Tasks",icon:ClipboardList},{to:"/admin/customers",label:t("a_customers"),icon:Users},{to:"/admin/cards",label:t("a_cards"),icon:CreditCard},{to:"/admin/subscriptions",label:t("a_subscriptions"),icon:Package},{to:"/admin/packages",label:t("a_packages"),icon:Package},{to:"/admin/offers",label:t("a_offers"),icon:Gift},{to:"/admin/payments",label:t("a_payments"),icon:BadgeDollarSign},{to:"/admin/employees",label:t("a_employees"),icon:UserSquare},{to:"/admin/notifications",label:t("a_notifications"),icon:Bell},{to:"/admin/reports",label:t("a_reports"),icon:PieChart},{to:"/admin/pages",label:t("a_pages"),icon:FileText},{to:"/admin/settings",label:t("a_settings"),icon:Settings}];
 if(isLoading)return <div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("loading")}</div>;
 if(!isAdmin)return <div className="min-h-screen bg-background"><AppTopbar title={t("admin_panel")}/><div className="mx-auto max-w-lg px-4 py-20 text-center"><h2 className="font-display text-2xl font-bold">{t("admin_only")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("admin_only_d")}</p>{existing&&!existing.exists&&<div className="panel mt-8 p-6"><p className="text-sm text-muted-foreground">{t("claim_admin_d")}</p><Button className="mt-4" onClick={async()=>{try{await claim();toast.success(t("saved"));queryClient.invalidateQueries({queryKey:["role",user?.id]})}catch(e){toast.error(e instanceof Error?e.message:t("error"))}}}>{t("claim_admin")}</Button></div>}<div className="mt-6"><Button asChild variant="outline"><Link to="/dashboard">{t("nav_dashboard")}</Link></Button></div></div></div>;
 return <div className="min-h-screen bg-background"><AppTopbar title={t("admin_panel")} extra={<Button asChild variant="outline" size="sm" className="hidden sm:inline-flex"><Link to="/dashboard">{t("nav_dashboard")}</Link></Button>}/><div className="border-b border-border bg-card/40 px-4 py-3 sm:px-6"><div className="mx-auto max-w-7xl"><AdminNav items={items}/></div></div><div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><Outlet/></div></div>;
}
