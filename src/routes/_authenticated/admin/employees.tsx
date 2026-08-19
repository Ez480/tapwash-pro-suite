import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin/employees")({ component: AdminEmployees });

type Employee = {
  id: string;
  employee_id: string;
  national_id: string | null;
  card_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  branch: string | null;
  status: string;
  user_id: string | null;
  created_at: string;
};

function AdminEmployees() {
  const { t, pick } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>({ status: "active" });

  const employeesQuery = useQuery({
    queryKey: ["admin", "employees", "v2"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const openNew = () => {
    setEditing(null);
    setForm({ status: "active", employee_id: "", national_id: "", card_number: "", full_name: "", email: "", phone: "", job_title: "", branch: "" });
    setOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setForm({ ...employee });
    setOpen(true);
  };

  const save = async () => {
    if (!form.employee_id || !form.full_name || !form.national_id || !form.card_number) {
      toast.error(pick("Employee ID, name, National ID and card number are required.", "رقم الموظف والاسم والرقم القومي ورقم البطاقة حقول مطلوبة."));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employee_id: form.employee_id,
        national_id: form.national_id || null,
        card_number: form.card_number || null,
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        job_title: form.job_title || null,
        branch: form.branch || null,
        status: form.status || "active",
      };
      const result = editing
        ? await supabase.from("employees").update(payload).eq("id", editing.id).select("*").single()
        : await supabase.from("employees").insert(payload).select("*").single();
      if (result.error) throw result.error;

      // Keep the employee dashboard profile synchronized when this employee is linked to a login account.
      const userId = editing?.user_id;
      if (userId) {
        const { error: profileError } = await supabase.from("profiles").update({
          full_name: payload.full_name,
          phone: payload.phone,
        }).eq("id", userId);
        if (profileError) throw profileError;
      }

      toast.success(pick("Employee saved successfully", "تم حفظ بيانات الموظف بنجاح"));
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "employees", "v2"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : pick("Could not save employee", "تعذر حفظ الموظف"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (employee: Employee) => {
    if (!window.confirm(pick(`Delete ${employee.full_name}?`, `حذف الموظف ${employee.full_name}؟`))) return;
    const { error } = await supabase.from("employees").delete().eq("id", employee.id);
    if (error) return void toast.error(error.message);
    toast.success(pick("Employee deleted", "تم حذف الموظف"));
    await queryClient.invalidateQueries({ queryKey: ["admin", "employees", "v2"] });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">{t("a_employees")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{pick("Manage employee accounts and dashboard data.", "إدارة بيانات الموظفين وربطها بلوحة الموظف.")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void employeesQuery.refetch()} disabled={employeesQuery.isFetching}><RefreshCw className={`me-1.5 size-4 ${employeesQuery.isFetching ? "animate-spin" : ""}`} />{pick("Refresh", "تحديث")}</Button>
          <Button onClick={openNew}><Plus className="me-1.5 size-4" />{t("add")}</Button>
        </div>
      </div>

      {employeesQuery.error && <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{employeesQuery.error instanceof Error ? employeesQuery.error.message : pick("Could not load employees", "تعذر تحميل الموظفين")}</div>}

      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{pick("Employee ID", "رقم الموظف")}</TableHead><TableHead>{t("full_name")}</TableHead><TableHead>{t("phone")}</TableHead><TableHead>{t("job_title")}</TableHead><TableHead>{t("branch")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{pick("Dashboard", "لوحة الموظف")}</TableHead><TableHead className="text-end">{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {employeesQuery.isLoading && <TableRow><TableCell colSpan={8}>{t("loading")}</TableCell></TableRow>}
            {!employeesQuery.isLoading && !employeesQuery.error && (employeesQuery.data ?? []).length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">{t("empty")}</TableCell></TableRow>}
            {(employeesQuery.data ?? []).map((employee) => <TableRow key={employee.id}>
              <TableCell className="font-semibold">{employee.employee_id}</TableCell><TableCell>{employee.full_name}</TableCell><TableCell>{employee.phone || "—"}</TableCell><TableCell>{employee.job_title || "—"}</TableCell><TableCell>{employee.branch || "—"}</TableCell><TableCell>{employee.status}</TableCell>
              <TableCell>{employee.user_id ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">{pick("Connected", "متصل")}</span> : <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600">{pick("No login linked", "غير مربوط بحساب")}</span>}</TableCell>
              <TableCell className="text-end"><div className="flex justify-end gap-1.5"><Button variant="ghost" size="icon" onClick={() => openEdit(employee)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => void remove(employee)}><Trash2 className="size-4" /></Button></div></TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? t("edit") : t("add")}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          {[['employee_id', pick('Employee ID', 'رقم الموظف'), true], ['national_id', pick('National ID', 'الرقم القومي'), true], ['card_number', pick('Card number', 'رقم البطاقة'), true], ['full_name', t('full_name'), true], ['email', 'Email', false], ['phone', t('phone'), false], ['job_title', t('job_title'), false], ['branch', t('branch'), false]].map(([key, label, required]) => <div key={key as string} className="space-y-2"><Label>{label as string}</Label><Input required={Boolean(required)} value={String(form[key as keyof Employee] ?? "")} onChange={(e) => setForm((v) => ({ ...v, [key as string]: e.target.value }))} /></div>)}
          <div className="space-y-2"><Label>{t("status")}</Label><Select value={String(form.status ?? "active")} onValueChange={(v) => setForm((x) => ({ ...x, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{t("active")}</SelectItem><SelectItem value="inactive">{t("inactive")}</SelectItem></SelectContent></Select></div>
          {editing?.user_id && <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{pick("This employee is connected to the employee dashboard. Name and phone changes will sync to the dashboard profile.", "الموظف ده مربوط بلوحة الموظف، وأي تعديل على الاسم أو الهاتف هيتزامن مع حسابه.")}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={() => void save()} disabled={saving}>{saving ? pick("Saving…", "جاري الحفظ…") : t("save")}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
