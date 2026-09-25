import type { Metadata } from "next";
import { ResourcesConfig } from "@/components/config/config-extra";

export const metadata: Metadata = { title: "Configuration — ressources" };

export default function Page() {
  return <ResourcesConfig />;
}
