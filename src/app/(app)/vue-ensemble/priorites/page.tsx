import type { Metadata } from "next";
import { PrioritiesView } from "@/components/overview/priorities-view";

export const metadata: Metadata = { title: "Vue d'ensemble — Mes priorités" };

export default function Page() {
  return <PrioritiesView />;
}
