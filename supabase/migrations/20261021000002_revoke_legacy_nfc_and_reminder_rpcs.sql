-- Disable obsolete/privileged RPCs for roles that should not invoke them
-- directly. The legacy public_nfc_scan RPC deducts a wash immediately and is
-- no longer used by the current UI (which uses lookup + explicit staff check-in).
revoke all on function public.public_nfc_scan(text) from public, anon, authenticated, service_role;

-- Reminder generation is scheduled by pg_cron and must not be callable by
-- arbitrary authenticated clients, since it can write admin notifications
-- containing customer/order details. The migration/job owner retains execution.
revoke execute on function public.notify_subscription_order_reminders() from public, anon, authenticated, service_role;

-- Employee identity lookup can return national ID and employment details.
-- It is only needed by a signed-in employee session; the function's email
-- fallback must never be usable by an anonymous caller.
revoke execute on function public.get_my_employee() from public, anon;
grant execute on function public.get_my_employee() to authenticated, service_role;

-- These customer/staff RPCs enforce auth.uid() internally, but do not need
-- anonymous EXECUTE. Keep them available to signed-in users where used by UI.
revoke execute on function public.create_customer_nfc_reorder(uuid, timestamptz, text) from public, anon;
grant execute on function public.create_customer_nfc_reorder(uuid, timestamptz, text) to authenticated, service_role;

revoke execute on function public.customer_nfc_reorder_lookup(text) from public, anon;
grant execute on function public.customer_nfc_reorder_lookup(text) to authenticated, service_role;

revoke execute on function public.reassign_nfc_card(uuid, uuid, uuid) from public, anon;
grant execute on function public.reassign_nfc_card(uuid, uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
