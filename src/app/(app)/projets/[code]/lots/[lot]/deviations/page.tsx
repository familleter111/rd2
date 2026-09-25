import type { Metadata } from "next";
import { LotDeviationsView } from "@/components/lots/lot-deviations";

export const metadata: Metadata = { title: "Lot pilote — déviations" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/lots/[lot]/deviations">) {
  const { code, lot } = await params;
  const { declarer } = await searchParams;
  return <LotDeviationsView key={declarer === "1" ? "declare" : "list"} slug={code} lotSlug={lot} declare={declarer === "1"} />;
}
