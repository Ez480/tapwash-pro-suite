import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck, Truck, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NotificationCenter } from "@/components/app/NotificationCenter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LanguageToggle, ThemeToggle } from "@/components/site/Chrome";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useIsAdmin, useSession, useUserRoles } from "@/lib/auth";
import { cn } from "@/lib/utils";

const glassIcon = "inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/50 bg-white/35 text-primary shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/10";
const toolbarButton = "shrink-0 rounded-xl border border-white/45 bg-white/30 text-foreground shadow-sm backdrop-blur-xl hover:bg-white/55 dark:border-white/10 dark:bg-white/[0.07] dark:hover:bg-white/10";

export function useSignOut(){const queryClient=useQueryClient();const navigate=useNavigate();return async()=>{await queryClient.cancelQueries();queryClient.clear();await supabase.auth.signOut();navigate({to:"/login",replace:true});};}

export function AppTopbar({title,extra}:{title:string;extra?:ReactNode}){
  const{t,pick}=useI18n();const signOut=useSignOut();const navigate=useNavigate();const{user}=useSession();const{data:roles}=useIsAdmin(user?.id);const{data:userRoles=[]}=useUserRoles(user?.id);const isAdmin=(roles??[]).includes("admin");const isEmployee=!isAdmin&&userRoles.includes("employee");const pathname=useRouterState({select:state=>state.location.pathname});const isAdminArea=pathname.startsWith("/admin");const mobileEmployee=isEmployee&&pathname==="/dashboard";
  return <header className={cn("app-topbar-glass sticky top-0 z-40 w-full border-b border-white/30 bg-background/85 px-2 text-foreground shadow-lg backdrop-blur-2xl sm:px-4",mobileEmployee&&"px-1 sm:px-4")}>
    <div className={cn("mx-auto flex min-h-16 w-full max-w-7xl items-center gap-2 rounded-b-2xl",mobileEmployee&&"min-h-16")}>
      <Link to="/" aria-label={pick("Home","الرئيسية")} className="flex min-w-0 shrink-0 items-center gap-2 rounded-xl px-1 py-1">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-transparent">
          <img src="/icons/tapwash-logo.svg" alt="TapWash" className="h-10 w-10 object-contain" />
        </span>
        <span className="hidden max-w-32 truncate text-xs font-black sm:block">TapWash</span>
      </Link>
      {!isAdmin&&user&&<Button asChild variant="ghost" size="sm" className={cn(toolbarButton,"h-9 px-2.5 sm:px-3")}><Link to="/orders" title={pick("My orders","طلباتي")}><ClipboardList className="size-4 sm:me-1.5"/><span className="hidden sm:inline">{pick("My orders","طلباتي")}</span></Link></Button>}
      <div className="mx-1 hidden h-7 w-px bg-border/60 md:block"/>
      <h1 className="min-w-0 flex-1 truncate px-1 text-center text-xs font-bold text-muted-foreground sm:text-sm md:text-start">{title}</h1>
      <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
        {extra}
        {isAdmin&&isAdminArea&&<Button type="button" variant="ghost" size="sm" onClick={()=>navigate({to:"/admin/live-orders"})} aria-label="متابعة الأوردرات والدليفري Live" title="متابعة الأوردرات والدليفري Live" className={cn(toolbarButton,"h-9 px-2.5")}><Truck className="size-4 sm:me-1"/><span className="hidden lg:inline">Live</span></Button>}
        {isAdmin&&!isAdminArea&&<Button asChild variant="ghost" size="sm" className={cn(toolbarButton,"h-9 px-2.5")}><Link to="/admin" title={pick("Admin dashboard","لوحة المدير")}><ShieldCheck className="size-4 sm:me-1"/><span className="hidden lg:inline">{pick("Admin","المدير")}</span></Link></Button>}
        <div className="flex h-9 items-center gap-1">
          <NotificationCenter/>
          <LanguageToggle/>
          <ThemeToggle/>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} aria-label={t("logout")} title={t("logout")} className={cn(toolbarButton,"size-9")}><LogOut className="size-4"/></Button>
      </div>
    </div>
  </header>;
}

export function StatCard({label,value,hint,tone="default"}:{label:string;value:ReactNode;hint?:string;tone?:"default"|"primary"|"ink"}){return <div className={cn("animate-fade-up rounded-2xl border p-6 shadow-sm backdrop-blur-xl",tone==="primary"&&"border-sky-300/45 bg-sky-200/35 dark:border-sky-400/20 dark:bg-sky-400/10",tone==="ink"&&"border-amber-300/45 bg-amber-200/35 dark:border-amber-400/20 dark:bg-amber-400/10",tone==="default"&&"border-white/50 bg-white/40 dark:border-white/10 dark:bg-white/5")}><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-3 font-display text-3xl font-extrabold text-foreground">{value}</p>{hint&&<p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>;}

export function AdminNav({items,mode="all"}:{items:{to:string;label:string;icon:React.ElementType}[];mode?:"all"|"desktop"|"mobile"}) {
  const pathname=useRouterState({select:s=>s.location.pathname});
  const {dir,pick}=useI18n();
  const [open,setOpen]=useState(false);
  const [pendingPayments,setPendingPayments]=useState(0);
  const [pendingBookings,setPendingBookings]=useState(0);
  const [pendingSubscriptions,setPendingSubscriptions]=useState(0);
  const [unreadMessages,setUnreadMessages]=useState(0);
  useEffect(()=>{
    const load=async()=>{
      const [{count:paymentCount},{count:manualCount},{count:bookingCount},{count:messageCount},{count:subscriptionCount}]=await Promise.all([
        supabase.from("payments").select("id",{count:"exact",head:true}).in("status",["pending","awaiting","unpaid"]),
        supabase.from("booking_requests").select("id",{count:"exact",head:true}).eq("payment_status","awaiting_proof"),
        supabase.from("booking_requests").select("id",{count:"exact",head:true}).in("status",["pending","new","awaiting"]),
        supabase.from("customer_messages").select("id",{count:"exact",head:true}).eq("is_read",false),
        (supabase as any).from("subscription_requests").select("id",{count:"exact",head:true}).eq("status","pending")
      ]);
      setPendingPayments((paymentCount??0)+(manualCount??0));setPendingBookings(bookingCount??0);setUnreadMessages(messageCount??0);setPendingSubscriptions(subscriptionCount??0);
    };
    void load();
    const ch=supabase.channel(`admin-nav-badges-${mode}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"payments"},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"booking_requests"},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"customer_messages"},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"subscription_requests"},()=>void load()).subscribe();
    return()=>{void supabase.removeChannel(ch);};
  },[]);
  const renderLinks=(close?:()=>void)=><nav className="flex flex-col gap-1.5">{items.map(i=>{
    const active=pathname===i.to;
    const isPayments=i.to==="/admin/payments",isBookings=i.to==="/admin/booking-requests",isMessages=i.to==="/admin/messages",isSubscriptions=i.to==="/admin/subscriptions";
    const badgeCount=isPayments?pendingPayments:isBookings?pendingBookings:isMessages?unreadMessages:isSubscriptions?pendingSubscriptions:0;
    return <Link key={i.to} to={i.to} onClick={close} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",active?"bg-white/20 text-white shadow-sm ring-1 ring-white/20 dark:bg-white/10 dark:ring-white/15":"text-white/85 hover:bg-white/10 hover:text-white dark:hover:bg-white/5")}>
      <i.icon className="size-5 shrink-0"/><span className="min-w-0 flex-1">{i.label}</span>
      {badgeCount>0&&<span className={cn("inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",active?"bg-white text-blue-700 dark:text-blue-300":"bg-red-500 text-white")}>{badgeCount>99?"99+":badgeCount}</span>}
    </Link>;
  })}</nav>;
  const brand=<div className="mb-6 flex items-center gap-3 border-b border-white/20 px-2 pb-5 dark:border-white/10"><img src="/icons/tapwash-logo.svg" alt="TapWash" className="size-11 object-contain"/><span className="text-xl font-black tracking-tight text-white">TapWash</span></div>;
  return <>
    {mode!=="mobile"&&<aside className="hidden min-h-[calc(100vh-4rem)] w-[260px] shrink-0 flex-col border border-transparent bg-gradient-to-b from-[#2461E9] via-[#273FC7] to-[#273FC7] px-4 py-6 text-white shadow-xl dark:from-[#0c1a45] dark:via-[#0b1536] dark:to-[#070d22] dark:border dark:border-white/10 lg:flex">
      {brand}{renderLinks()}
    </aside>}
    {mode!=="desktop"&&<div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild><Button variant="outline" size="icon" aria-label={pick("Open admin menu","فتح قائمة الإدارة")} className="border-white/30 bg-primary text-white hover:bg-primary/90"><span className="text-xl leading-none">☰</span></Button></SheetTrigger>
        <SheetContent side={dir==="rtl"?"right":"left"} className="w-[min(88vw,320px)] border border-transparent bg-gradient-to-b from-[#2461E9] via-[#273FC7] to-[#273FC7] p-5 text-white dark:from-[#0c1a45] dark:via-[#0b1536] dark:to-[#070d22] dark:border dark:border-white/10 [&>button]:text-white">
          {brand}{renderLinks(()=>setOpen(false))}
        </SheetContent>
      </Sheet>
    </div>}
  </>;
}
