import { createFileRoute } from "@tanstack/react-router";
import { AdminProblems } from "@/features/dashboards/admin/AdminProblems";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminProblems });
