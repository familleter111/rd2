import type { Metadata } from "next";
import { TemplatesView } from "@/components/config/templates-view";

export const metadata: Metadata = { title: "Modèles de parcours" };

export default function Page() {
  return <TemplatesView />;
}
