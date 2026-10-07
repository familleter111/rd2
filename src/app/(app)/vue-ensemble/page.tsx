import type { Metadata } from "next";
import { OverviewView } from "@/components/overview/overview-view";

export const metadata: Metadata = { title: "Vue d'ensemble" };

export default async function Page({ searchParams }: PageProps<"/vue-ensemble">) {
  const { filtres } = await searchParams;
  return <OverviewView key={filtres === "1" ? "filtres" : "vue"} openFilters={filtres === "1"} />;
}
