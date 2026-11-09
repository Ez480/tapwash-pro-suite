import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/features/dashboards/admin/AdminLayout";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminLayout });
