import { formatDate, formatTime } from "@/lib/format";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

type SupportMessage = {
  id: string;
  employee_id: string;
  sender_id: string;
  sender_role: "employee" | "admin";
  body: string;
  attachment_path: string | null;
  created_at: string;
  read_at: string | null;
  attachmentUrl?: string | null;
};

type Props = {
  employeeId: string;
  isAdmin: boolean;
  employeeName?: string;
  focusDate?: string | null;
};

const BUCKET = "support-media";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function localDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function SupportChatThread({ employeeId, isAdmin, employeeName, focusDate }: Props) {
  const { pick, lang } = useI18n();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const db = supabase as any;

  const load = async () => {
    let query = db.from("support_messages").select("*").eq("employee_id", employeeId).order("created_at", { ascending: true });
    if (focusDate) {
      const start = new Date(`${focusDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query = query.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
    }
    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const withUrls = await Promise.all((data ?? []).map(async (message: SupportMessage) => {
      if (!message.attachment_path) return message;
      const { data: signed, error: signedError } = await supabase.storage.from(BUCKET).createSignedUrl(message.attachment_path, 3600);
      if (signedError) console.warn("Support image signing failed", signedError);
      return { ...message, attachmentUrl: signed?.signedUrl ?? null };
    }));
    setMessages(withUrls);
    setLoading(false);
    if (isAdmin) {
      await db.from("support_messages").update({ read_at: new Date().toISOString() })
        .eq("employee_id", employeeId).eq("sender_role", "employee").is("read_at", null);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
    const channel = supabase.channel(`support-thread-${employeeId}-${isAdmin ? "admin" : "employee"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `employee_id=eq.${employeeId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [employeeId, isAdmin, focusDate]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const grouped = useMemo(() => {
    const groups: { key: string; label: string; items: SupportMessage[] }[] = [];
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    for (const message of messages) {
      const key = localDayKey(message.created_at);
      let label = formatDate(message.created_at, { day: "numeric", month: "long", year: "numeric" });
      if (key === localDayKey(today.toISOString())) label = pick("Today", "اليوم");
      else if (key === localDayKey(yesterday.toISOString())) label = pick("Yesterday", "أمس");
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, label, items: [] };
        groups.push(group);
      }
      group.items.push(message);
    }
    return groups;
  }, [messages, lang]);

  const send = async (file?: File) => {
    const messageBody = body.trim();
    if (!messageBody && !file) return;
    if (!isAdmin && file && !file.type.startsWith("image/")) return toast.error(pick("Only images are allowed.", "يسمح بالصور فقط."));
    if (file && (!file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE)) return toast.error(pick("Choose an image up to 5MB.", "اختر صورة لا يتجاوز حجمها 5 ميجابايت."));
    setBusy(true);
    try {
      let attachmentPath: string | null = null;
      if (file) {
        const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        attachmentPath = `${employeeId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(attachmentPath, file, { contentType: file.type, cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error } = await db.from("support_messages").insert({
        employee_id: employeeId,
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        sender_role: isAdmin ? "admin" : "employee",
        body: messageBody,
        attachment_path: attachmentPath,
      });
      if (error) throw error;
      setBody("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pick("Could not send message.", "تعذر إرسال الرسالة."));
    } finally {
      setBusy(false);
    }
  };

  return <section className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-card">
    <div className="flex items-center gap-2 border-b px-4 py-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="size-5" /></span>
      <div className="min-w-0 flex-1"><h3 className="truncate font-bold">{isAdmin ? employeeName || pick("Employee support", "دعم الموظف") : pick("TapWash support", "دعم TapWash")}</h3><p className="text-xs text-muted-foreground">{pick("Private support conversation", "محادثة دعم خاصة")}</p></div>
    </div>
    <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
      {loading ? <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : grouped.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{pick("No messages yet. Send the first message.", "لا توجد رسائل حتى الآن. ابدأ المحادثة برسالة.")}</p> : grouped.map(group => <div key={group.key} className="space-y-3">
        <div className="sticky top-0 z-10 flex justify-center"><span className="rounded-full border bg-background/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur">{group.label}</span></div>
        {group.items.map(message => {
          const mine = message.sender_role === (isAdmin ? "admin" : "employee");
          return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <article className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${mine ? "rounded-ee-md bg-primary text-primary-foreground" : "rounded-es-md border bg-card"}`}>
              {message.body && <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>}
              {message.attachmentUrl && <a href={message.attachmentUrl} target="_blank" rel="noreferrer"><img src={message.attachmentUrl} alt={pick("Support attachment", "مرفق الدعم")} className="mt-2 max-h-64 rounded-xl object-contain" /></a>}
              <p className={`mt-1 text-end text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{formatTime(message.created_at)}{mine && message.read_at ? " ✓✓" : ""}</p>
            </article>
          </div>;
        })}
      </div>)}
    </div>
    <form className="flex items-end gap-2 border-t bg-background p-3" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border text-muted-foreground transition hover:bg-muted" title={pick("Attach image", "إرفاق صورة")}>
        <ImagePlus className="size-5" />
        <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void send(file); event.currentTarget.value = ""; }} />
      </label>
      <Input value={body} onChange={event => setBody(event.target.value)} placeholder={pick("Write a message…", "اكتب رسالة…")} disabled={busy} />
      <Button type="submit" size="icon" disabled={busy || !body.trim()} aria-label={pick("Send", "إرسال")}><Send className="size-4" /></Button>
    </form>
  </section>;
}
