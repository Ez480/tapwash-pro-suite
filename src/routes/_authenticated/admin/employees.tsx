import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

type Employee = { id: string; employee_id: string; full_name: string; birth_date: string | null; qualification: string | null; national_id: string | null; email: string | null; phone: string | null; branch: string | null; job_title: string | null; status: string; user_id: string | null; created_at: string };
export const Route = createFileRoute("/_authenticated/admin/employees")({ component: AdminEmployees });

function AdminEmployees() {
  const { t, pick } = useI18n();
  const queryClient = useQueryClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>({ status: "active" });

  const loadEmployees = async () => {
    setIsLoading(true); setError(null);
    const { data, error: loadError } = await supabase.rpc("admin_list_employees");
    if (loadError) { console.error("Employee list failed", loadError); setError(loadError); setEmployees([]); }
    else setEmployees((data ?? []) as Employee[]);
    setIsLoading(false);
  };
  useEffect(() => { void loadEmployees(); }, []);

  const openNew = () => { setEditing(null); setForm({ status: "active", employee_id: "", full_name: "", birth_date: "", qualification: "", national_id: "", email: "", phone: "", branch: "", job_title: "" }); setOpen(true); };
  const openEdit = (employee: Employee) => { setEditing(employee); setForm({ ...employee, birth_date: employee.birth_date?.slice(0, 10) ?? "" }); setOpen(true); };

  const selectEmail = async (email: string) => {
    setForm(cur => ({ ...cur, email }));
    if (editing || !email.trim()) return;
    try {
      const { data, error } = await supabase.rpc("admin_next_employee_id");
      if (error) throw error;
      setForm(cur => ({ ...cur, email, employee_id: String(data ?? "") }));
    } catch (e) {
      console.error("Employee ID generation failed", e);
      toast.error(pick("Could not generate Employee ID.", "تعذر توليد رقم ID الموظف."));
    }
  };

  const save = async () => {
    const employeeId = String(form.employee_id ?? "").trim(); const fullName = String(form.full_name ?? "").trim();
    if (!employeeId || !fullName) { toast.error(pick("Employee ID and full name are required.", "رقم ID الموظف والاسم الكامل مطلوبان.")); return; }
    setSaving(true);
    try {
      const { data, error: saveError } = await supabase.rpc("admin_save_employee", {
        p_id: editing?.id ?? null, p_employee_id: employeeId, p_full_name: fullName,
        p_birth_date: String(form.birth_date ?? "").trim() || null, p_qualification: String(form.qualification ?? "").trim() || null,
        p_national_id: String(form.national_id ?? "").trim() || null, p_email: String(form.email ?? "").trim().toLowerCase() || null,
        p_phone: String(form.phone ?? "").trim() || null, p_branch: String(form.branch ?? "").trim() || null,
        p_job_title: String(form.job_title ?? "").trim() || null, p_status: String(form.status ?? "active"),
      });
      if (saveError) throw saveError;
      if (!data) throw new Error(pick("Employee was not returned by the database.", "قاعدة البيانات لم تُرجع الموظف بعد الحفظ."));
      toast.success(pick("Employee saved successfully.", "تم حفظ بيانات الموظف بنجاح.")); setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "employees"] }); await loadEmployees();
    } catch (saveError) { console.error("Employee save failed", saveError); toast.error(saveError instanceof Error ? saveError.message : pick("Could not save employee.", "تعذر حفظ الموظف.")); }
    finally { setSaving(false); }
  };
  const remove = async (employee: Employee) => {
    if (!window.confirm(pick(`Delete ${employee.full_name}?`, `حذف الموظف ${employee.full_name}؟`))) return;
    const { error: deleteError } = await supabase.rpc("admin_delete_employee", { p_id: employee.id });
    if (deleteError) { toast.error(deleteError.message); return; }
    toast.success(pick("Employee deleted.", "تم حذف الموظف.")); await loadEmployees();
  };
  const fields: Array<[keyof Employee, string, boolean, string]> = [
    ["employee_id", pick("Employee ID", "رقم ID الموظف"), true, "text"], ["full_name", pick("Full name", "الاسم كامل"), true, "text"],
    ["birth_date", pick("Date of birth", "تاريخ الميلاد"), false, "date"], ["qualification", pick("Qualification", "المؤهل"), false, "text"],
    ["national_id", pick("National ID", "الرقم القومي"), false, "text"], ["email", "Email", false, "email"],
    ["phone", t("phone"), false, "tel"], ["branch", t("branch"), false, "text"], ["job_title", t("job_title"), false, "text"],
  ];

  return <div>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-bold">{t("a_employees")}</h2><p className="mt-1 text-sm text-muted-foreground">{pick("Manage employee accounts and dashboard data.", "إدارة بيانات الموظفين وربطها بلوحة الموظف.")}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void loadEmployees()} disabled={isLoading}><RefreshCw className={`me-1.5 size-4 ${isLoading ? "animate-spin" : ""}`} />{pick("Refresh", "تحديث")}</Button><Button onClick={openNew}><Plus className="me-1.5 size-4" />{t("add")}</Button></div></div>
    {error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error.message}</div>}
    <div className="panel overflow-x-auto"><Table><TableHeader><TableRow><TableHead>{pick("Employee ID", "رقم ID الموظف")}</TableHead><TableHead>{pick("Full name", "الاسم كامل")}</TableHead><TableHead>{pick("National ID", "الرقم القومي")}</TableHead><TableHead>{t("job_title")}</TableHead><TableHead>{t("branch")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{pick("Dashboard", "لوحة الموظف")}</TableHead><TableHead className="text-end">{t("actions")}</TableHead></TableRow></TableHeader><TableBody>{isLoading && <TableRow><TableCell colSpan={8}>{t("loading")}</TableCell></TableRow>}{!isLoading && !error && employees.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">{t("empty")}</TableCell></TableRow>}{employees.map(e => <TableRow key={e.id}><TableCell className="font-semibold">{e.employee_id || "—"}</TableCell><TableCell>{e.full_name || "—"}</TableCell><TableCell>{e.national_id || "—"}</TableCell><TableCell>{e.job_title || "—"}</TableCell><TableCell>{e.branch || "—"}</TableCell><TableCell>{e.status}</TableCell><TableCell>{e.user_id ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">{pick("Connected", "متصل")}</span> : <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600">{pick("No login linked", "غير مربوط بحساب")}</span>}</TableCell><TableCell className="text-end"><div className="flex justify-end gap-1.5"><Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => void remove(e)}><Trash2 className="size-4" /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle></DialogHeader><div className="grid gap-4">{fields.map(([key,label,required,type]) => <div key={String(key)} className="space-y-2"><Label>{label}</Label><Input type={type} required={required} value={String(form[key] ?? "")} onChange={ev => key === "email" ? void selectEmail(ev.target.value) : setForm(cur => ({ ...cur, [key]: ev.target.value }))} /></div>)}<div className="space-y-2"><Label>{t("status")}</Label><Select value={String(form.status ?? "active")} onValueChange={v => setForm(cur => ({ ...cur, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{t("active")}</SelectItem><SelectItem value="inactive">{t("inactive")}</SelectItem></SelectContent></Select></div><p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{pick("Selecting an employee email automatically generates the next Employee ID. You can edit it before saving and later from the employee record.", "بمجرد اختيار إيميل الموظف يتم توليد رقم ID تلقائيًا، ويمكنك تعديله قبل الحفظ وبعد ذلك من بيانات الموظف.")}</p></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={() => void save()} disabled={saving}>{saving ? pick("Saving…", "جاري الحفظ…") : t("save")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
