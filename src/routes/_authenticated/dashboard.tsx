import { createFileRoute } from "@tanstack/react-router";
import { CustomerDashboard } from "@/features/dashboards/customer/CustomerDashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: CustomerDashboard });
