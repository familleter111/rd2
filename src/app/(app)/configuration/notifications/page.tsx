import type { Metadata } from "next";
import { NotificationsConfig } from "@/components/config/config-extra";

export const metadata: Metadata = { title: "Configuration — notifications" };

export default function Page() {
  return <NotificationsConfig />;
}
