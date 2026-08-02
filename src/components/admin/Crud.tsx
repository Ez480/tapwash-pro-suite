import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRequireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export type Row = Record<string, unknown>;

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "textarea" | "date" | "select" | "list" | "color";
  options?: { value: string; label: string }[];
  required?: boolean;
  defaultValue?: unknown;
};

export type Column = {
  key: string;
  label: string;
  render?: (row: Row) => ReactNode;
};

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const str = value === null || value === undefined ? "" : String(value);

  if (field.type === "textarea")
    return <Textarea rows={4} value={str} onChange={(e) => onChange(e.target.value)} />;

  if (field.type === "select")
    return (
      <Select value={str} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

  if (field.type === "list")
    return (
      <Textarea
        rows={3}
        value={Array.isArray(value) ? value.join(", ") : str}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    );

  return (
    <Input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={field.type === "date" ? str.slice(0, 10) : str}
      onChange={(e) =>
        onChange(field.type === "number" ? Number(e.target.value) : e.target.value)
      }
    />
  );
}

export function CrudTable({
  table,
  title,
  description,
  select = "*",
  orderBy = "created_at",
  columns,
  fields,
  rowActions,
  canCreate = true,
  canDelete = true,
}: {
  table: string;
  title: string;
  description?: string;
  select?: string;
  orderBy?: string;
  columns: Column[];
  fields: Field[];
  rowActions?: (row: Row) => ReactNode;
  canCreate?: boolean;
  canDelete?: boolean;
}) {
  const { t } = useI18n();
const { loading: adminLoading, isAdmin } = useRequireAdmin();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminTable(table, select, orderBy);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Row>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", table] });

  const openNew = () => {
    const d: Row = {};
    fields.forEach((f) => {
      if (f.defaultValue !== undefined) d[f.name] = f.defaultValue;
    });
    setDraft(d);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: Row) => {
    const d: Row = {};
    fields.forEach((f) => (d[f.name] = row[f.name]));
    setDraft(d);
    setEditingId(String(row["id"]));
    setOpen(true);
  };

  const save = async () => {
  if (!isAdmin) {
    toast.error("Unauthorized");
    return;
  }
    const payload: Row = {};
    fields.forEach((f) => {
      const v = draft[f.name];
      payload[f.name] = v === "" ? null : v;
    });
    const query = editingId
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from(table as any).update(payload).eq("id", editingId)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.from(table as any).insert(payload);
    const { error } = await query;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("saved"));
    setOpen(false);
    refresh();
  };

  const remove = async (id: string) => {
  if (!isAdmin) {
    toast.error("Unauthorized");
    return;
  }
    if (!window.confirm(t("confirm_delete"))) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("deleted"));
    refresh();
  };
if (adminLoading) {
  return <p>{t("loading")}</p>;
}

if (!isAdmin) {
  return <p className="text-destructive">Unauthorized</p>;
}
  return (
    <div>
      <SectionHeader
        title={title}
        {...(description ? { description } : {})}
        action={
          canCreate ? (
            <Button onClick={openNew}>
              <Plus className="me-1.5 size-4" />
              {t("add")}
            </Button>
          ) : undefined
        }
      />

      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead className="text-end">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={columns.length + 1}>{t("loading")}</TableCell>
              </TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((row: Row) => (
              <TableRow key={String(row["id"])}>
                {columns.map((c) => (
                  <TableCell key={c.key} className="align-middle">
                    {c.render ? c.render(row) : ((row[c.key] as ReactNode) ?? "—")}
                  </TableCell>
                ))}
                <TableCell className="text-end">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {rowActions?.(row)}
                    {fields.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(row)}
                        aria-label={t("edit")}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(String(row["id"]))}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f.name} className="space-y-2">
                <Label>{f.label}</Label>
                <FieldInput
                  field={f}
                  value={draft[f.name]}
                  onChange={(v) => setDraft((d) => ({ ...d, [f.name]: v }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={save}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
