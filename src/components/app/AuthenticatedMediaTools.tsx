import { useEffect, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useSession, useUserRoles } from "@/lib/auth";
import { useProfile } from "@/lib/data";
import { uploadImage } from "@/lib/media";

export function AuthenticatedMediaTools() {
  const { pick } = useI18n();
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const { data: roles = [] } = useUserRoles(user?.id);
  const [profileOpen, setProfileOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const isEmployee = roles.includes("employee");

  const loadTasks = async () => {
    if (!user?.id || !isEmployee) return;
    const { data, error } = await (supabase as any)
      .from("employee_tasks")
      .select("id,title,serial_number,status,delivery_status,customer_name")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setTasks(data ?? []);
  };

  useEffect(() => {
    void loadTasks();
    if (!isEmployee) return;
    const channel = supabase
      .channel(`employee-media-tools-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks", filter: `employee_id=eq.${user?.id}` }, () => void loadTasks())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, isEmployee]);

  const saveProfileImage = async (file: File) => {
    if (!user?.id) return;
    try {
      setBusy("profile");
      const result = await uploadImage(file, `avatars/${user.id}`);
      const { error } = await supabase.from("profiles").update({ avatar_url: result.url }).eq("id", user.id);
      if (error) throw error;
      toast.success(pick("Profile photo updated", "تم تحديث صورة البروفايل"));
      setProfileOpen(false);
      window.dispatchEvent(new Event("tapwash-profile-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pick("Upload failed", "فشل رفع الصورة"));
    } finally { setBusy(null); }
  };

  const uploadCarPhoto = async (task: any, kind: "before" | "after", file: File) => {
    if (!user?.id) return;
    try {
      setBusy(`${task.id}:${kind}`);
      const result = await uploadImage(file, `orders/${task.id}/${kind}`);
      const { error } = await (supabase as any).from("order_photos").insert({ task_id: task.id, uploaded_by: user.id, kind, path: result.path, url: result.url });
      if (error) throw error;
      toast.success(kind === "before" ? pick("Before-wash photo uploaded", "تم رفع صورة قبل الغسيل") : pick("After-cleaning photo uploaded", "تم رفع صورة بعد التنظيف"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pick("Photo upload failed", "فشل رفع الصورة"));
    } finally { setBusy(null); }
  };

  const setDeliveryStatus = async (task: any, status: string) => {
    try {
      setBusy(`${task.id}:delivery`);
      const { error } = await (supabase as any).from("employee_tasks").update({ delivery_status: status }).eq("id", task.id).eq("employee_id", user?.id);
      if (error) throw error;
      await loadTasks();
    } catch (error) { toast.error(error instanceof Error ? error.message : pick("Could not update delivery", "تعذر تحديث حالة الدليفري")); }
    finally { setBusy(null); }
  };

  return (
    <>
      <div className="fixed bottom-4 end-4 z-50 flex flex-col gap-2">
        <Button size="sm" variant="outline" className="rounded-full border-primary/30 bg-background/95 shadow-lg backdrop-blur" onClick={() => setProfileOpen(true)}>
          <UserRound className="me-1.5 size-4" />{pick("Profile photo", "صورة البروفايل")}
        </Button>
        {isEmployee && <Button size="sm" className="rounded-full shadow-lg" onClick={() => setEmployeeOpen(true)}>
          <Camera className="me-1.5 size-4" />{pick("Vehicle photos", "صور العربية")}
        </Button>}
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{pick("Profile photo", "صورة البروفايل")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="profile" className="mx-auto size-32 rounded-3xl object-cover" /> : <div className="mx-auto flex size-32 items-center justify-center rounded-3xl bg-muted"><UserRound className="size-10" /></div>}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-5 text-sm hover:bg-muted">
              <ImagePlus className="size-5" />{pick("Choose from phone", "اختيار من الهاتف")}
              <Input type="file" accept="image/*" className="hidden" disabled={busy === "profile"} onChange={(e) => { const file = e.target.files?.[0]; if (file) void saveProfileImage(file); e.currentTarget.value = ""; }} />
            </label>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={employeeOpen} onOpenChange={setEmployeeOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{pick("Vehicle photos & delivery", "صور العربية وحالة الدليفري")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {tasks.filter((t) => t.status !== "completed").length === 0 && <p className="rounded-xl bg-muted p-4 text-sm">{pick("No active orders assigned to you.", "لا توجد أوردرات نشطة مسندة إليك.")}</p>}
            {tasks.filter((t) => t.status !== "completed").map((task) => (
              <div key={task.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-center gap-2"><b>{task.title}</b><Badge>{task.status}</Badge><Badge variant="outline">{task.serial_number || task.id.slice(0, 8).toUpperCase()}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{task.customer_name || "—"}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm hover:bg-muted"><Camera className="size-4" />{pick("Take before photo", "تصوير قبل الغسيل")}<Input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy === `${task.id}:before`} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadCarPhoto(task, "before", file); e.currentTarget.value = ""; }} /></label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm hover:bg-muted"><Camera className="size-4" />{pick("Take after photo", "تصوير بعد التنظيف")}<Input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy === `${task.id}:after`} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadCarPhoto(task, "after", file); e.currentTarget.value = ""; }} /></label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[["picked_up", pick("Picked up", "تم الاستلام")], ["on_the_way", pick("On the way", "في الطريق")], ["delivered", pick("Delivered", "تم التسليم")]].map(([status, label]) => <Button key={status} size="sm" variant={task.delivery_status === status ? "default" : "outline"} disabled={busy === `${task.id}:delivery`} onClick={() => void setDeliveryStatus(task, status as string)}>{task.delivery_status === status && <CheckCircle2 className="me-1 size-4" />}{label}</Button>)}
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => setEmployeeOpen(false)}><X className="me-1 size-4" />{pick("Close", "إغلاق")}</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
