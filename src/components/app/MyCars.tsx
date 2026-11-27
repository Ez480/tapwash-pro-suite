import { useCallback, useEffect, useState } from "react";
import { Car, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

type CustomerCar = {
  id: string;
  customer_id: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  plate_number: string | null;
  notes?: string | null;
};

type CarForm = {
  plate_number: string;
  brand: string;
  model: string;
  color: string;
};

const emptyForm: CarForm = { plate_number: "", brand: "", model: "", color: "" };

function normalizePlate(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[a-z]/gi, (letter) => letter.toUpperCase());
}

function plateKey(value: string) {
  return value.trim().replace(/\s+/g, "").replace(/[a-z]/gi, (letter) => letter.toUpperCase());
}

export function MyCars({ customerId }: { customerId?: string }) {
  const { pick } = useI18n();
  const [cars, setCars] = useState<CustomerCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<CustomerCar | null>(null);
  const [form, setForm] = useState<CarForm>(emptyForm);

  const loadCars = useCallback(async () => {
    if (!customerId) {
      setCars([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("cars")
      .select("id,customer_id,brand,model,color,plate_number,notes")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setCars([]);
    } else {
      setCars((data ?? []) as CustomerCar[]);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => { void loadCars(); }, [loadCars]);

  const openAdd = () => {
    setEditingCar(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (car: CustomerCar) => {
    setEditingCar(car);
    setForm({
      plate_number: car.plate_number ?? "",
      brand: car.brand ?? "",
      model: car.model ?? "",
      color: car.color ?? "",
    });
    setDialogOpen(true);
  };

  const saveCar = async () => {
    if (!customerId) return;
    const plate = normalizePlate(form.plate_number);
    const brand = form.brand.trim();
    const model = form.model.trim();
    if (!plate || !brand || !model) {
      toast.error(pick("Complete all required car details.", "اكمل بيانات العربية المطلوبة."));
      return;
    }

    const duplicate = cars.some((car) =>
      car.id !== editingCar?.id && plateKey(car.plate_number ?? "") === plateKey(plate)
    );
    if (duplicate) {
      toast.error(pick("This plate number is already saved.", "رقم اللوحة ده متسجل بالفعل."));
      return;
    }

    setSaving(true);
    const values = {
      plate_number: plate,
      brand,
      model,
      color: form.color.trim() || null,
    };
    const result = editingCar
      ? await (supabase as any).from("cars").update(values).eq("id", editingCar.id).eq("customer_id", customerId)
      : await (supabase as any).from("cars").insert({ ...values, customer_id: customerId });

    setSaving(false);
    if (result.error) {
      toast.error(result.error.code === "23505"
        ? pick("Could not save this plate number. Check the plate and try again.", "تعذر حفظ رقم اللوحة ده. راجع الرقم وحاول تاني.")
        : result.error.message);
      return;
    }

    toast.success(pick(editingCar ? "Car updated successfully." : "Car added successfully.", editingCar ? "تم تحديث العربية بنجاح." : "تمت إضافة العربية بنجاح."));
    setDialogOpen(false);
    await loadCars();
  };

  const deleteCar = async (car: CustomerCar) => {
    const { data: linkedSubscriptions, error: subscriptionError } = await (supabase as any)
      .from("subscriptions")
      .select("id")
      .eq("car_id", car.id)
      .in("status", ["active", "pending"])
      .limit(1);
    if (subscriptionError) {
      toast.error(subscriptionError.message);
      return;
    }
    if ((linkedSubscriptions ?? []).length > 0) {
      toast.error(pick(
        "This car is linked to an active subscription and can't be deleted.",
        "العربية دي مربوطة باشتراك فعّال ومينفعش تتحذف.",
      ));
      return;
    }
    if (typeof window !== "undefined" && !window.confirm(pick("Delete this car?", "حذف العربية دي؟"))) return;

    const { error } = await (supabase as any).from("cars").delete().eq("id", car.id).eq("customer_id", customerId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(pick("Car deleted successfully.", "تم حذف العربية بنجاح."));
    await loadCars();
  };

  return (
    <section className="panel mt-6 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Car className="size-5 text-primary" />
          {pick("My cars", "عرباتي")}
        </h3>
        <Button type="button" size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          {pick("Add car", "إضافة عربية")}
        </Button>
      </div>

      {loading ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">{pick("Loading cars...", "جاري تحميل العربيات...")}</p>
      ) : cars.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {pick("No cars yet. Add your first car.", "لسه مفيش عربيات. ضيف أول عربية.")}
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {cars.map((car) => (
            <article key={car.id} className="min-w-0 rounded-xl border bg-card p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p dir="ltr" className="break-words text-start font-semibold">{car.plate_number || "—"}</p>
                  <p className="mt-1 break-words font-medium">{[car.brand, car.model].filter(Boolean).join(" ") || "—"}</p>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{car.color || pick("Color not specified", "اللون غير محدد")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={pick("Edit car", "تعديل العربية")} onClick={() => openEdit(car)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label={pick("Delete car", "حذف العربية")} onClick={() => void deleteCar(car)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="z-[1100] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pick(editingCar ? "Edit car" : "Add car", editingCar ? "تعديل العربية" : "إضافة عربية")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>{pick("Plate number", "رقم اللوحة")} *</Label>
              <Input autoFocus value={form.plate_number} onChange={(event) => setForm((current) => ({ ...current, plate_number: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{pick("Brand", "الماركة")} *</Label>
              <Input value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{pick("Model", "الموديل")} *</Label>
              <Input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{pick("Color (optional)", "اللون (اختياري)")}</Label>
              <Input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{pick("Cancel", "إلغاء")}</Button>
            <Button type="button" onClick={() => void saveCar()} disabled={saving}>
              {saving ? pick("Saving...", "جاري الحفظ...") : pick("Save car", "حفظ العربية")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
