import type { Metadata } from "next";
import { PortfolioView } from "@/components/overview/portfolio-view";

export const metadata: Metadata = { title: "Vue d'ensemble — Portefeuille" };

export default async function Page({ searchParams }: PageProps<"/vue-ensemble">) {
  const { filtres } = await searchParams;
  return <PortfolioView key={filtres === "1" ? "filtres" : "portefeuille"} openFilters={filtres === "1"} />;
}
