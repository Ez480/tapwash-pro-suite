import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  customer_id: string | null;
  title: string;
  message: string;
  is_read: boolean | null;
  created_at: string;
};

export function NotificationCenter() {
  const { user } = useSession();
  const { data: roles } = useIsAdmin(user?.id);
  const isAdmin = (roles ?? []).includes("admin");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const unread = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const load = async () => {
    if (!user) return;

    let query = supabase
      .from("notifications")
      .select("id, customer_id, title, message, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    // Admin notifications are intentionally stored with customer_id = null.
    // Customers must only receive their own customer_id notifications.
    query = isAdmin ? query.is("customer_id", null) : query.eq("customer_id", user.id);

    const { data } = await query;
    setItems((data ?? []) as NotificationRow[]);
  };

  useEffect(() => {
    if (!user || !roles) return;
    void load();

    const channel = supabase
      .channel(`tapwash-notifications-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        const next = payload.new as NotificationRow;
        const belongsToCurrentUser = isAdmin ? next.customer_id === null : next.customer_id === user.id;

        if (belongsToCurrentUser) {
          setItems((current) => [next, ...current].slice(0, 20));
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification(next.title, { body: next.message });
          }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, (payload) => {
        const next = payload.new as NotificationRow;
        const belongsToCurrentUser = isAdmin ? next.customer_id === null : next.customer_id === user.id;
        if (belongsToCurrentUser) void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin, Boolean(roles)]);

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") await Notification.requestPermission();
  };

  const markAllRead = async () => {
    const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setItems((current) => current.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="الإشعارات">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,390px)] p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <p className="font-semibold">الإشعارات</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? "إشعارات الإدارة والطلبات والمدفوعات" : "تحديثات طلباتك في TapWash"}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={requestPermission} aria-label="تفعيل إشعارات الجهاز">
              <Bell className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={markAllRead} disabled={!unread} aria-label="تعليم الكل كمقروء">
              <CheckCheck className="size-4" />
            </Button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">لا توجد إشعارات جديدة.</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className={cn("rounded-xl p-3 transition-colors", !n.is_read && "bg-primary/5")}>
                <div className="flex items-start gap-2">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{n.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-EG")}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border p-3">
          <Button asChild variant="outline" className="w-full" onClick={() => setOpen(false)}>
            <Link to={isAdmin ? "/admin/booking-requests" : "/orders"}>{isAdmin ? "فتح طلبات الحجز" : "متابعة حالة الطلبات"}</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
