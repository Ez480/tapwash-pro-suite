import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, ClipboardList, ExternalLink, MapPin, Plus, Trash2, CarFront, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminTable } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/tasks")({ component: AdminTasks });

type FormState = { employee_id:string; customer_id:string; order_type:"subscription"|"offer"; subscription_id:string; offer_id:string; car_id:string; car_brand:string; car_model:string; car_color:string; plate_number:string; collection_amount:string; location_text:string; location_url:string; scheduled_at:string; notes:string; wash_type:string };
const emptyForm:FormState = { employee_id:"", customer_id:"", order_type:"subscription", subscription_id:"", offer_id:"", car_id:"", car_brand:"", car_model:"", car_color:"", plate_number:"", collection_amount:"", location_text:"", location_url:"", scheduled_at:"", notes:"", wash_type:"car_wash" };

function AdminTasks(){
 const {pick}=useI18n();
 const {data:profiles=[]}=useAdminTable("profiles","id,full_name,phone,email,role,status,address_text,location_url","created_at");
 const {data:cars=[]}=useAdminTable("cars","*","created_at");
 const {data:subscriptions=[],refetch:refetchSubs}=useAdminTable("subscriptions","*, packages(title_en,title_ar,washes_count,duration_days,price)","created_at");
 const {data:offers=[]}=useAdminTable("offers","*","created_at");
 const {data:allTasks=[],refetch}=useAdminTable("employee_tasks","*","created_at");
 const tasks=allTasks.filter((t:any)=>!["completed","cancelled"].includes(String(t.status||"pending").toLowerCase()));
 const [form,setForm]=useState<FormState>(emptyForm);
 const employees=profiles.filter((p:any)=>p.role==="employee"&&p.status!=="suspended");
 const customers=profiles.filter((p:any)=>p.role==="customer"||(!p.role && p.status!=="suspended"));
 const customerLabel=(c:any)=>c?.full_name||c?.phone||c?.email||c?.id;
 const employeeLabel=(e:any)=>e?.full_name||e?.email||e?.id;
 const carLabel=(c:any)=>[c?.brand,c?.model,c?.color,c?.plate_number].filter(Boolean).join(" · ")||c?.id;
 const set=(key:keyof FormState,value:string)=>setForm(f=>({...f,[key]:value}));
 const selectedCustomer=profiles.find((p:any)=>String(p.id)===String(form.customer_id));
 const selectedSub=subscriptions.find((s:any)=>String(s.id)===String(form.subscription_id));
 const selectedOffer=offers.find((o:any)=>String(o.id)===String(form.offer_id));
 const selectedPackage=selectedSub?.packages as any;
 const activeSubs=subscriptions.filter((s:any)=>String(s.customer_id)===String(form.customer_id)&&s.status==="active"&&Number(new Date(`${s.end_date}T23:59:59`))>=Date.now());
 const now=Date.now();
 const availableOffers=offers.filter((o:any)=>String(o.status||"").toLowerCase()==="active"&&(!o.start_date||Number.isNaN(Date.parse(String(o.start_date)))||Date.parse(String(o.start_date))<=now)&&(!o.end_date||Number.isNaN(Date.parse(String(o.end_date)))||Date.parse(String(o.end_date))>=now));
 const selectedSubscriptionCar=cars.find((c:any)=>String(c.id)===String(selectedSub?.car_id));
 const customerLocation={address:selectedCustomer?.address_text||"",url:selectedCustomer?.location_url||""};
 const handleCustomer=(id:string)=>{
   const c=profiles.find((p:any)=>String(p.id)===String(id));
   const subs=subscriptions.filter((s:any)=>String(s.customer_id)===String(id)&&s.status==="active"&&Number(new Date(`${s.end_date}T23:59:59`))>=Date.now());
   const first=subs[0];
   const car=cars.find((x:any)=>String(x.id)===String(first?.car_id));
   setForm(f=>({...emptyForm,employee_id:f.employee_id,customer_id:id,order_type:"subscription",subscription_id:first?.id||"",car_id:first?.car_id||"",car_brand:car?.brand||"",car_model:car?.model||"",car_color:car?.color||"",plate_number:car?.plate_number||"",location_text:c?.address_text||"",location_url:c?.location_url||""}));
 };
 const handleSubscription=(id:string)=>{
   const s=subscriptions.find((x:any)=>String(x.id)===String(id));
   const car=cars.find((x:any)=>String(x.id)===String(s?.car_id));
   setForm(f=>({...f,subscription_id:id,offer_id:"",car_id:s?.car_id||"",car_brand:car?.brand||"",car_model:car?.model||"",car_color:car?.color||"",plate_number:car?.plate_number||""}));
 };
 const handleOffer=(id:string)=>setForm(f=>({...f,offer_id:id,subscription_id:"",car_id:"",car_brand:"",car_model:"",car_color:"",plate_number:""}));
 const createTask=async()=>{
   if(!form.employee_id||!form.customer_id||!form.scheduled_at){toast.error(pick("Fill employee, customer and execution time","اكمل الموظف والعميل وموعد التنفيذ"));return;}
   if(!form.location_text&&!form.location_url){toast.error(pick("Add the customer address or location link","أضف عنوان العميل أو لينك الموقع"));return;}
   if(form.order_type==="subscription"&&!selectedSub){toast.error(pick("Choose an active subscription","اختر اشتراكًا نشطًا للعميل"));return;}
   if(form.order_type==="offer"&&!selectedOffer){toast.error(pick("Choose an available offer","اختر عرضًا متاحًا"));return;}
   if(form.order_type==="offer"&&(!form.car_brand||!form.car_model||!form.car_color||!form.plate_number)){toast.error(pick("Fill the offer car details","اكمل بيانات عربية العرض"));return;}
   const {data:auth}=await supabase.auth.getUser(); if(!auth.user)return;
   const pkg=selectedPackage;
   const title=form.order_type==="offer"?pick(selectedOffer?.title_en||"Offer",selectedOffer?.title_ar||"عرض"):pick(pkg?.title_en||"Subscription wash",pkg?.title_ar||"غسيل اشتراك");
   const car=selectedSubscriptionCar;
   const insertData:any={serial_number:`TW-${Date.now().toString(36).toUpperCase()}`,collection_amount:form.collection_amount?Number(form.collection_amount):0,title,wash_type:form.wash_type,employee_id:form.employee_id,customer_id:form.customer_id,car_id:form.order_type==="subscription"?(selectedSub?.car_id||null):null,subscription_id:form.order_type==="subscription"?form.subscription_id:null,offer_id:form.order_type==="offer"?form.offer_id:null,customer_name:customerLabel(selectedCustomer),customer_phone:selectedCustomer?.phone??null,customer_email:selectedCustomer?.email??null,package_name:form.order_type==="subscription"?(pkg?pick(pkg.title_en||"",pkg.title_ar||""):null):null,offer_name:form.order_type==="offer"?(selectedOffer?pick(selectedOffer.title_en,selectedOffer.title_ar):null):null,total_washes:form.order_type==="subscription"?(selectedSub?.total_washes??pkg?.washes_count??null):null,used_washes:form.order_type==="subscription"?(selectedSub?.used_washes??0):null,remaining_washes:form.order_type==="subscription"?(selectedSub?Math.max(Number(selectedSub.total_washes||0)-Number(selectedSub.used_washes||0),0):null):null,location_text:form.location_text,location_url:form.location_url||null,scheduled_at:form.scheduled_at,notes:form.notes||null,status:"pending",created_by:auth.user.id,car_brand:form.order_type==="offer"?form.car_brand:(car?.brand||null),car_model:form.order_type==="offer"?form.car_model:(car?.model||null),car_color:form.order_type==="offer"?form.car_color:(car?.color||null),plate_number:form.order_type==="offer"?form.plate_number:(car?.plate_number||null)};
   const {error}=await(supabase as any).from("employee_tasks").insert(insertData);
   if(error){toast.error(error.message);return;}
   toast.success(pick("Task assigned","تم تكليف الموظف بالمهمة"));setForm(emptyForm);refetch();refetchSubs();
 };
 const updateStatus=async(id:string,status:string)=>{const {error}=await(supabase as any).from("employee_tasks").update({status,...(status==="completed"?{completed_at:new Date().toISOString()}: {})}).eq("id",id);if(error)toast.error(error.message);else refetch();};
 const removeTask=async(id:string)=>{const {error}=await(supabase as any).from("employee_tasks").delete().eq("id",id);if(error)toast.error(error.message);else refetch();};
 const openLocation=(task:any)=>{const url=task.location_url||(task.location_text?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.location_text)}`:"");if(url)window.open(url,"_blank","noopener,noreferrer");};
 return <div className="space-y-6">
  <div className="flex items-center gap-3"><ClipboardList className="size-6 text-primary"/><div><h1 className="text-2xl font-bold">{pick("Employee tasks & orders","مهام وأوردرات الموظفين")}</h1><p className="text-sm text-muted-foreground">{pick("Assign subscription or offer orders with customer, car and location details.","كلف الموظف بأوردر اشتراك أو عرض مع بيانات العميل والعربية والموقع.")}</p></div></div>
  <section className="panel p-6"><div className="grid gap-4 md:grid-cols-2">
   <div><Label>{pick("Employee","الموظف")}</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.employee_id} onChange={e=>set("employee_id",e.target.value)}><option value="">{pick("Choose employee","اختر الموظف")}</option>{employees.map((e:any)=><option key={e.id} value={e.id}>{employeeLabel(e)}</option>)}</select></div>
   <div><Label>{pick("Customer","العميل")}</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.customer_id} onChange={e=>handleCustomer(e.target.value)}><option value="">{pick("Choose customer","اختر العميل")}</option>{customers.map((c:any)=><option key={c.id} value={c.id}>{customerLabel(c)}</option>)}</select></div>
   <div><Label>{pick("Order type","نوع الأوردر")}</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.order_type} onChange={e=>{const type=e.target.value as "subscription"|"offer";setForm(f=>({...f,order_type:type,subscription_id:type==="subscription"?f.subscription_id:"",offer_id:type==="offer"?f.offer_id:"",car_id:type==="subscription"?f.car_id:"",car_brand:type==="subscription"?f.car_brand:"",car_model:type==="subscription"?f.car_model:"",car_color:type==="subscription"?f.car_color:"",plate_number:type==="subscription"?f.plate_number:""}));}}><option value="subscription">{pick("Subscription","اشتراك")}</option><option value="offer">{pick("Offer","عرض")}</option></select></div>
   {form.order_type==="subscription"?<>
    <div><Label>{pick("Customer subscription / package","اشتراك العميل / الباقة")}</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.subscription_id} onChange={e=>handleSubscription(e.target.value)} disabled={!form.customer_id}><option value="">{activeSubs.length?pick("Choose active subscription","اختر الاشتراك النشط"):pick("No active subscription","لا يوجد اشتراك نشط")}</option>{activeSubs.map((s:any)=>{const p=s.packages as any;return <option key={s.id} value={s.id}>{p?pick(p.title_en,p.title_ar):pick("Package","باقة")} — {s.used_washes??0}/{s.total_washes??0}</option>})}</select>{form.customer_id&&!activeSubs.length&&<p className="mt-1 text-xs text-destructive">{pick("This customer has no active subscription.","العميل ده لا يملك اشتراكًا نشطًا.")}</p>}</div>
    <div><Label>{pick("Car registered in subscription","العربية المسجلة في الباقة")}</Label><div className="mt-2 min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm">{selectedSubscriptionCar?carLabel(selectedSubscriptionCar):pick("Select a subscription to show its registered car","اختر الاشتراك لإظهار العربية المسجلة")}</div></div>
   </>:<>
    <div><Label>{pick("Available offers","العروض المتاحة")}</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.offer_id} onChange={e=>handleOffer(e.target.value)}><option value="">{pick("Choose offer","اختر العرض")}</option>{availableOffers.map((o:any)=><option key={o.id} value={o.id}>{pick(o.title_en,o.title_ar)}{o.new_price!=null?` — ${o.new_price} EGP`:""}</option>)}</select>{!availableOffers.length&&<p className="mt-1 text-xs text-muted-foreground">{pick("No active offers are available right now.","لا توجد عروض نشطة متاحة حاليًا.")}</p>}</div>
    <div className="md:col-span-2 rounded-xl border p-4"><p className="mb-3 font-semibold">{pick("Offer car details — enter manually","بيانات عربية العرض — إدخال يدوي")}</p><div className="grid gap-3 md:grid-cols-2"><div><Label>{pick("Brand","الماركة")}</Label><Input className="mt-1" value={form.car_brand} onChange={e=>set("car_brand",e.target.value)}/></div><div><Label>{pick("Model","الموديل")}</Label><Input className="mt-1" value={form.car_model} onChange={e=>set("car_model",e.target.value)}/></div><div><Label>{pick("Color","اللون")}</Label><Input className="mt-1" value={form.car_color} onChange={e=>set("car_color",e.target.value)}/></div><div><Label>{pick("Plate number","رقم اللوحة")}</Label><Input className="mt-1" value={form.plate_number} onChange={e=>set("plate_number",e.target.value)}/></div></div></div>
   </>}
   <div><Label>{pick("Collection amount","مبلغ التحصيل")}</Label><Input className="mt-2" type="number" min="0" step="0.01" value={form.collection_amount} onChange={e=>set("collection_amount",e.target.value)}/></div>
   <div><Label>{pick("Scheduled time","موعد التنفيذ")}</Label><Input className="mt-2" type="datetime-local" value={form.scheduled_at} onChange={e=>set("scheduled_at",e.target.value)}/></div>
   <div className="md:col-span-2"><Label>{pick("Customer address","عنوان العميل")}</Label><Input className="mt-2" value={form.location_text} onChange={e=>set("location_text",e.target.value)} placeholder={customerLocation.address||pick("Customer address","عنوان العميل")}/></div>
   <div className="md:col-span-2"><Label>{pick("Customer location link","لينك لوكيشن العميل")}</Label><div className="mt-2 flex gap-2"><Input value={form.location_url} onChange={e=>set("location_url",e.target.value)} placeholder={customerLocation.url||"https://maps.google.com/..."}/>{form.location_url&&<Button type="button" variant="outline" size="icon" onClick={()=>window.open(form.location_url,"_blank","noopener,noreferrer")}><ExternalLink className="size-4"/></Button>}</div></div>
   <div className="md:col-span-2"><Label>{pick("Instructions / notes","تعليمات وملاحظات")}</Label><Textarea className="mt-2" value={form.notes} onChange={e=>set("notes",e.target.value)}/></div>
  </div><Button className="mt-5" onClick={createTask}><Plus className="me-2 size-4"/>{pick("Assign task","تكليف الموظف")}</Button></section>
  <section className="panel p-6"><h2 className="text-lg font-bold">{pick("Assigned orders","الأوردرات المكلفة")}</h2><div className="mt-4 space-y-3">{tasks.map((task:any)=>{const emp=profiles.find((p:any)=>String(p.id)===String(task.employee_id));const car=cars.find((c:any)=>String(c.id)===String(task.car_id));return <div key={task.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{task.title} <span className="text-xs text-muted-foreground">#{task.serial_number||String(task.id).slice(0,8).toUpperCase()}</span></p><p className="text-sm text-muted-foreground">{emp?.full_name||emp?.email} · {task.customer_name||"—"} · {task.customer_phone||"—"}</p>{(car||task.car_brand||task.car_model||task.plate_number)&&<p className="mt-1 flex items-center gap-1 text-sm"><CarFront className="size-4"/>{car?carLabel(car):[task.car_brand,task.car_model,task.car_color,task.plate_number].filter(Boolean).join(" · ")}</p>}<p className="mt-1 text-sm">{task.offer_name?pick("Offer","العرض"):pick("Subscription","الاشتراك")}: <b>{task.offer_name||task.package_name||"—"}</b></p>{task.subscription_id&&<p className="mt-1 text-sm">{pick("Remaining washes","الغسلات المتبقية")}: <b>{task.remaining_washes??"—"}</b></p>}<p className="mt-1 flex items-center gap-1 text-sm"><MapPin className="size-4"/>{task.location_text||"—"}</p></div><Badge>{task.status||"pending"}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{(task.location_url||task.location_text)&&<Button size="sm" variant="outline" onClick={()=>openLocation(task)}><MapPin className="me-1 size-4"/>{pick("Open location","فتح الموقع")}</Button>}{!["completed","cancelled"].includes(String(task.status||"pending").toLowerCase())&&<><Button size="sm" onClick={()=>void updateStatus(task.id,"completed")}><CheckCircle2 className="me-1 size-4"/>{pick("Complete","تم التنفيذ")}</Button><Button size="sm" variant="outline" onClick={()=>void updateStatus(task.id,"cancelled")}><XCircle className="me-1 size-4"/>{pick("Cancel","إلغاء")}</Button><Button size="sm" variant="ghost" onClick={()=>void removeTask(task.id)}><Trash2 className="me-1 size-4"/>{pick("Delete","حذف")}</Button></>}</div></div>})}{!tasks.length&&<p className="text-sm text-muted-foreground">{pick("No assigned tasks yet.","لا توجد مهام مكلفة حالياً.")}</p>}</div></section>
 </div>;
}
