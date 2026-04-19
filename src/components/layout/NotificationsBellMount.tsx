"use client";

import { NotificationsBell } from "./NotificationsBell";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationsBellMount() {
  const props = useNotifications();
  return <NotificationsBell {...props} />;
}
