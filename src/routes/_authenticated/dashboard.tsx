import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, CreditCard, KeyRound, MessageCircle, Phone, RefreshCw, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AppTopbar, StatCard } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useIsAdmin, useSession } from "@/lib/auth";
import {
  useMyCards,
  useMyNotifications,
  useMySubscription,
  useMyWashes,
  useProfile,
  useSettings,
} from "@/lib/data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: CustomerDashboard;
});

function CustomerDashboard() {
  return null;
}
