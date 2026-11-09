import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/features/dashboards/admin/AdminDashboard";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminDashboard });
