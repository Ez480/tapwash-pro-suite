# Dashboard feature organization

Dashboard behavior is grouped by user role under this directory. TanStack file-based route files remain in `src/routes` as thin route entry points so public URLs, route IDs, authentication guards, and generated route-tree behavior do not change.

## Role modules

- `customer/CustomerDashboard.tsx`: customer membership, washes, cards, bookings, and customer-facing order status.
- `employee/EmployeeDashboard.tsx`: employee profile, assigned/current orders, archive, NFC workflow, order photos/status, and courier GPS tracking.
- `admin/AdminLayout.tsx`: admin-only navigation and dashboard shell.
- `admin/AdminDashboard.tsx`: admin overview and operational summary.
- `src/routes/_authenticated/admin/*.tsx`: each dedicated admin section remains a separate route module (customers, employees, payments, bookings, reports, settings, and related workflows).

## Shared code

Reusable UI belongs in `src/components/app` or `src/components/ui`; shared data/auth/i18n helpers remain in `src/lib`. Do not duplicate role permissions in shared components. Route guards remain in route entry points and the authenticated parent route.

## Safety rules for future changes

- Keep route file paths and route IDs stable when extracting UI modules.
- Keep customer, employee, and admin queries scoped to their existing RLS permissions.
- Do not change Supabase schema or policies as part of UI-only refactors.
- Keep employee task assignment, NFC check-in, photo upload, status transitions, and location tracking behavior in the employee feature.
- Keep each admin section isolated in its own route; avoid one giant dashboard file.
- Before merging a structural change, run `bun run build` and `bun run lint`, then verify the deployed Cloudflare Worker separately.