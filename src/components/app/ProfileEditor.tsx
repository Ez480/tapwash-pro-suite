import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, KeyRound, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useProfile, useSession } from "@/lib/data";

export function ProfileEditor({ compact = false }: { compact?: boolean }) {
  const { pick, t } = useI18n();
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const [open, setOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [form, setForm] = useState({ full_name: "", phone: "", avatar_url: "" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({ full_name: profile.full_name ?? "", phone: profile.phone ?? "", avatar_url: profile.avatar_url ?? "" });
    setPreview(profile.avatar_url ?? "");
  }, [profile]);

  useEffect(() => () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  const chooseImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error(pick("Please select an image file.", "اختار صورة فقط."));
    if (file.size > 10 * 1024 * 1024) return toast.error(pick("Image must be 10MB or smaller.", "حجم الصورة لازم يكون 10 ميجابايت أو أقل."));
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      let avatarUrl = form.avatar_url || null;
      if (avatarFile) {
        const uploaded = await uploadImage(avatarFile, `avatars/${user.id}`);
        avatarUrl = uploaded.url;
      }
      const { error } = await supabase.from("profiles").update({ full_name: form.full_name, phone: form.phone, avatar_url: avatarUrl }).eq("id", user.id);
      if (error) throw error;
      toast.success(t("saved"));
      setAvatarFile(null);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("tapwash-profile-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pick("Could not save profile.", "تعذر حفظ الملف الشخصي."));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (password.length < 6) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return void toast.error(error.message);
    toast.success(t("password_changed"));
    setPassword("");
    setPassOpen(false);
  };

  return <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={compact ? "sm" : "default"} className="gap-1.5">
          <UserCog className="size-4" />
          <span>{t("edit_profile")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("edit_profile")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border p-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
              {preview ? <img src={preview} alt={form.full_name || "avatar"} className="size-full object-cover" /> : <Camera className="size-7" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{pick("Profile picture", "صورة الملف الشخصي")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{pick("Choose a picture from your device.", "اختار صورة من جهازك.")}</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => chooseImage(e.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => fileRef.current?.click()}><ImagePlus className="me-1.5 size-4" />{pick("Choose image", "اختيار صورة")}</Button>
            </div>
          </div>
          <div className="space-y-2"><Label>{t("full_name")}</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => void saveProfile()} disabled={saving}>{saving ? pick("Saving…", "جاري الحفظ…") : t("save")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={passOpen} onOpenChange={setPassOpen}>
      <DialogTrigger asChild><Button variant="outline" size={compact ? "sm" : "default"} className="gap-1.5"><KeyRound className="size-4" />{t("change_password")}</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>{t("change_password")}</DialogTitle></DialogHeader><div className="space-y-2"><Label>{t("new_password")}</Label><Input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></div><DialogFooter><Button onClick={() => void changePassword()} disabled={password.length < 6}>{t("save")}</Button></DialogFooter></DialogContent>
    </Dialog>
  </>;
}
